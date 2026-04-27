# Funding USDT0 on X Layer via the Uniswap Trading API

When the wallet lacks the asset required by an APP Pay Per Use 402
challenge, acquire it on X Layer (chain 196) using the Uniswap Trading
API. The API supports both same-chain swaps on X Layer and cross-chain
routing into X Layer (powered by Across).

## Table of Contents

- [Decide the funding target](#decide-the-funding-target)
- [Pick the source chain and token](#pick-the-source-chain-and-token)
- [Phase A: Same-chain swap on X Layer](#phase-a-same-chain-swap-on-x-layer)
- [Phase B: Cross-chain bridge into X Layer](#phase-b-cross-chain-bridge-into-x-layer)
- [Verify the destination balance](#verify-the-destination-balance)

## Decide the Funding Target

| Asset on X Layer      | Recommended?                  | Notes                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USDT0 (`0x779Ded0c…`) | ✅ default                    | Deepest Uniswap v3 liquidity (USDT0/USDG and USDT0/WOKB pools: fee tiers may shift over time; the Trading API will pick the optimal route). Use this if the 402 challenge accepts USDT0.                                                                                                                                                             |
| USDG (`0x4ae46a50…`)  | ✅ supported                  | Reachable via direct Trading API quote, or one-hop USDT0 to USDG.                                                                                                                                                                                                                                                                                    |
| USDC (`0x74b7F163…`)  | ❌ not via Uniswap on X Layer | Trading API does not consistently return routes for USDC swaps on X Layer despite pools at 0.05% and 0.3% existing: TVL is too thin for reliable execution. If the merchant requires USDC, bridge USDC directly from a chain where it is liquid (Base, Arbitrum, Mainnet) using the Trading API rather than attempting a same-chain swap on X Layer. |

> **Default funding target = USDT0.** Override only when the 402
> challenge demands a different specific asset and that asset is funded
> by an entry above with ✅.

## Pick the Source Chain and Token

Inspect the user's ERC-20 holdings across supported source chains and
prefer cheapest gas + deepest liquidity to the destination.

```bash
set -euo pipefail

# USDC on Base (cheapest bridge gas)
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://mainnet.base.org

# USDC on Ethereum
cast call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://eth.llamarpc.com

# Native ETH on Base / Ethereum (use zero address for the swap input)
cast balance "$WALLET_ADDRESS" --rpc-url https://mainnet.base.org
```

Path priority for landing **USDT0** on X Layer:

1. Source already holds USDT0 on X Layer, skip funding entirely.
2. Source holds USDG on X Layer, same-chain swap USDG to USDT0 (Phase
   A, single hop).
3. Source holds USDT0 on a different chain, Phase B cross-chain
   (likely cheapest).
4. Wallet has a stablecoin (USDC) on Base / Arbitrum / Mainnet,
   cross-chain route to USDT0 on X Layer (Phase B).
5. Wallet has native ETH on Base / Mainnet, cross-chain route from
   native (zero address `0x0000000000000000000000000000000000000000`)
   to USDT0 on X Layer (Phase B handles swap + bridge in one quote).
6. Wallet only holds non-USDT0 tokens on X Layer, same-chain swap
   (Phase A).

## Phase A: Same-Chain Swap on X Layer

Use this when the wallet already holds a token on X Layer (e.g. WOKB or
USDG) and needs to convert it to the asset required by the 402
challenge. Skip if the wallet has no relevant tokens on X Layer.

> **Confirmation gate** before approval and before broadcast.
>
> **Pre-flight: OKB balance check.** Same-chain X Layer swap requires
> OKB for gas. Confirm the wallet has OKB before proceeding:
>
> ```bash
> set -euo pipefail
> OKB_BAL=$(cast balance "$WALLET_ADDRESS" \
>   --rpc-url "${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}")
> [ "$OKB_BAL" != "0" ] || {
>   echo "Same-chain X Layer swap requires OKB for gas. Wallet has 0 OKB. Either acquire OKB first, or route entirely cross-chain (Phase B) which only needs source-chain gas." >&2
>   exit 1
> }
> ```

```bash
set -euo pipefail

QUOTE_FETCHED_AT=$(date +%s)
QUOTE=$(curl -fsS -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.1" \
  -d "$(jq -n \
    --arg type           "EXACT_OUTPUT" \
    --argjson tokenInChainId  196 \
    --argjson tokenOutChainId 196 \
    --arg tokenIn       "$SOURCE_TOKEN_XLAYER" \
    --arg tokenOut      "$X402_ASSET" \
    --arg amount        "$X402_AMOUNT" \
    --arg swapper       "$WALLET_ADDRESS" \
    '{
      type:             $type,
      tokenInChainId:   $tokenInChainId,
      tokenOutChainId:  $tokenOutChainId,
      tokenIn:          $tokenIn,
      tokenOut:         $tokenOut,
      amount:           $amount,
      swapper:          $swapper,
      urgency:          "normal"
    }')") || { echo "Trading API quote failed" >&2; exit 1; }
```

Then `check_approval` (only if `tokenIn` is not native), build the
permit signature when required, and broadcast via `/swap`. Detailed
`check_approval` + permit + `/swap` flow is identical to the
[`pay-with-any-token`](../../pay-with-any-token/references/trading-api-flows.md)
flow. See that reference and substitute the X Layer chain ID and
addresses.

Before broadcasting via `/swap`, gate on quote freshness:

```bash
set -euo pipefail

ELAPSED=$(($(date +%s) - QUOTE_FETCHED_AT))
[ "$ELAPSED" -lt 45 ] || {
  echo "Quote is $ELAPSED seconds old; refetch before broadcasting." >&2
  exit 1
}
```

## Phase B: Cross-Chain Bridge into X Layer

Use when the wallet holds tokens on a different chain. The Trading API
handles the swap-and-bridge in one quote.

Apply a **0.5% buffer** to compute `X402_AMOUNT_WITH_BUFFER` from
`X402_AMOUNT` to absorb bridge fees. If the shortfall is < $5 worth,
top up to $5 to amortize source chain gas.

```bash
set -euo pipefail

# Apply 0.5% buffer (uint256-safe integer math via python)
X402_AMOUNT_WITH_BUFFER=$(python3 -c "print(($X402_AMOUNT * 1005) // 1000)")
[[ "$X402_AMOUNT_WITH_BUFFER" =~ ^[0-9]+$ ]] || { echo "buffer math failed" >&2; exit 1; }

QUOTE_FETCHED_AT=$(date +%s)
QUOTE=$(curl -fsS -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.1" \
  -d "$(jq -n \
    --arg type           "EXACT_OUTPUT" \
    --argjson tokenInChainId  "$SOURCE_CHAIN_ID" \
    --argjson tokenOutChainId 196 \
    --arg tokenIn       "$SOURCE_TOKEN" \
    --arg tokenOut      "$X402_ASSET" \
    --arg amount        "$X402_AMOUNT_WITH_BUFFER" \
    --arg swapper       "$WALLET_ADDRESS" \
    '{
      type:             $type,
      tokenInChainId:   $tokenInChainId,
      tokenOutChainId:  $tokenOutChainId,
      tokenIn:          $tokenIn,
      tokenOut:         $tokenOut,
      amount:           $amount,
      swapper:          $swapper,
      urgency:          "normal"
    }')") || { echo "Trading API cross-chain quote failed" >&2; exit 1; }
```

Quote response contains `permitData` (sign with EIP-712) and the
`/swap` endpoint then returns the calldata to broadcast on the source
chain. Across handles the X Layer arrival.

Before broadcasting via `/swap`, gate on quote freshness:

```bash
set -euo pipefail

ELAPSED=$(($(date +%s) - QUOTE_FETCHED_AT))
[ "$ELAPSED" -lt 45 ] || {
  echo "Quote is $ELAPSED seconds old; refetch before broadcasting." >&2
  exit 1
}
```

When you broadcast the source-chain transaction, capture the resulting
hash into `SOURCE_TX_HASH` (used in the bridge timeout message below).

> **Bridge recipient.** The Trading API delivers funds to the same
> `swapper` address on chain 196. If the user wants the funds at a
> different X Layer address (e.g. an OKX Agentic Wallet they custody
> separately), an extra transfer transaction on X Layer is required
> after the bridge confirms.
>
> **Quotes expire in ~60 seconds.** Re-fetch if any delay before
> broadcast (the freshness gate above enforces a 45s ceiling).

## Verify the Destination Balance

After the bridge or same-chain swap completes, poll for the asset
arrival on X Layer before returning to the EIP-3009 signing step. The
loop tolerates transient RPC failures and validates that the returned
balance is a non-negative integer:

```bash
set -euo pipefail

# Canonical USDC on X Layer (USDC.e variant addresses may differ).
# TODO: confirm USDC.e address if Across delivers the bridged variant
# instead of native USDT0.
USDC_XLAYER="0x74b7F16337b8972027F6196A17a631aC6dE26d22"

XLAYER_BAL=""
USDC_BAL=""

for i in {1..20}; do
  XLAYER_BAL=$(cast call "$X402_ASSET" \
    "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
    --rpc-url "${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}") || {
    echo "RPC failure on attempt $i, retrying..." >&2
    sleep 5
    continue
  }
  [[ "$XLAYER_BAL" =~ ^[0-9]+$ ]] || {
    echo "Non-integer balance: $XLAYER_BAL" >&2
    sleep 5
    continue
  }
  if [ "$XLAYER_BAL" -ge "$X402_AMOUNT" ]; then
    echo "Funded. Balance: $XLAYER_BAL"
    break
  fi

  # Parallel check: did the bridge deliver USDC.e instead of USDT0?
  USDC_BAL=$(cast call "$USDC_XLAYER" \
    "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
    --rpc-url "${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}") || USDC_BAL=""
  if [[ "$USDC_BAL" =~ ^[0-9]+$ ]] && [ "$USDC_BAL" -ge "$X402_AMOUNT" ]; then
    echo "Bridge delivered USDC.e instead of USDT0; an additional same-chain swap step (USDC.e to USDT0 via Uniswap v3 on chain 196) is required." >&2
    exit 2
  fi

  echo "Waiting for arrival... attempt $i/20 (balance: $XLAYER_BAL base units)"
  sleep 30
done

[[ "${XLAYER_BAL:-0}" =~ ^[0-9]+$ ]] && [ "${XLAYER_BAL:-0}" -ge "$X402_AMOUNT" ] || {
  echo "Bridge not confirmed after 10 minutes. Source tx: ${SOURCE_TX_HASH:-unknown}. Check https://app.across.to/transactions or https://www.oklink.com/x-layer/address/$WALLET_ADDRESS to see if the destination transfer is pending. Do not re-submit the source-chain transaction." >&2
  exit 1
}
```

Once funded, return to
[`app-x402-flow.md`](app-x402-flow.md) to sign the EIP-3009
authorization and retry the original request.

> **Retry target URL.** When the funding flow ends and we return to
> the EIP-3009 signing in `app-x402-flow.md`, the URL to retry is
> `accepts[].resource` if present in the original 402 challenge,
> otherwise the original request URL.
