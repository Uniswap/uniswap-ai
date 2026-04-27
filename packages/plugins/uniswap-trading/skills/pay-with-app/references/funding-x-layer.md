# Funding USDT0 on X Layer via the Uniswap Trading API

When the wallet lacks the asset required by an APP Pay Per Use 402
challenge, acquire it on X Layer (chain 196) using the Uniswap Trading
API. The API supports both same-chain swaps on X Layer and cross-chain
routing into X Layer (powered by Across).

## Table of Contents

- [Decide the funding target](#decide-the-funding-target)
- [Pick the source chain and token](#pick-the-source-chain-and-token)
- [Phase A — Same-chain swap on X Layer](#phase-a--same-chain-swap-on-x-layer)
- [Phase B — Cross-chain bridge into X Layer](#phase-b--cross-chain-bridge-into-x-layer)
- [Verify the destination balance](#verify-the-destination-balance)

## Decide the Funding Target

| Asset on X Layer      | Recommended?                  | Notes                                                                                                                                                                                          |
| --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USDT0 (`0x779Ded0c…`) | ✅ default                    | Deepest Uniswap v3 liquidity (USDT0/USDG 0.01%, USDT0/WOKB 0.3%). Use this if the 402 challenge accepts USDT0.                                                                                 |
| USDG (`0x4ae46a50…`)  | ✅ supported                  | Reachable via direct Trading API quote, or one-hop USDT0 → USDG.                                                                                                                               |
| USDC (`0x74b7F163…`)  | ❌ not via Uniswap on X Layer | No usable v3 liquidity. If the merchant requires USDC, bridge USDC directly from a chain where it is liquid (Base, Arbitrum, Mainnet) using the Trading API and skip the swap step on X Layer. |

> **Default funding target = USDT0.** Override only when the 402
> challenge demands a different specific asset and that asset is funded
> by an entry above with ✅.

## Pick the Source Chain and Token

Inspect the user's ERC-20 holdings across supported source chains and
prefer cheapest gas + deepest liquidity to the destination.

```bash
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

1. Source already holds USDT0 on X Layer → skip funding entirely
2. Wallet has a stablecoin on Base / Arbitrum / Mainnet → cross-chain
   route directly to USDT0 on X Layer (Phase B)
3. Wallet has native ETH on Base / Mainnet → cross-chain route from ETH
   (zero address `0x0000000000000000000000000000000000000000`) to
   USDT0 on X Layer (Phase B handles swap + bridge in one quote)
4. Wallet only holds tokens on X Layer → same-chain swap (Phase A)

## Phase A — Same-Chain Swap on X Layer

Use this when the wallet already holds a token on X Layer (e.g. WOKB or
USDG) and needs to convert it to the asset required by the 402
challenge. Skip if the wallet has no relevant tokens on X Layer.

> **Confirmation gate** before approval and before broadcast.

```bash
QUOTE=$(curl -s -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
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
    }')")
```

Then `check_approval` (only if `tokenIn` is not native), build the
permit signature when required, and broadcast via `/swap`. Detailed
`check_approval` + permit + `/swap` flow is identical to the
[`pay-with-any-token`](../../pay-with-any-token/references/trading-api-flows.md)
flow — see that reference and substitute the X Layer chain ID and
addresses.

## Phase B — Cross-Chain Bridge into X Layer

Use when the wallet holds tokens on a different chain. The Trading API
handles the swap-and-bridge in one quote.

```bash
QUOTE=$(curl -s -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
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
    }')")
```

Apply a **0.5% buffer** to `X402_AMOUNT_WITH_BUFFER` to absorb bridge
fees. If the shortfall is < $5 worth, top up to $5 to amortize source
chain gas.

Quote response contains `permitData` (sign with EIP-712) and the
`/swap` endpoint then returns the calldata to broadcast on the source
chain. Across handles the X Layer arrival.

> **Bridge recipient.** The Trading API delivers funds to the same
> `swapper` address on chain 196. If the user wants the funds at a
> different X Layer address (e.g. an OKX Agentic Wallet they custody
> separately), an extra transfer transaction on X Layer is required
> after the bridge confirms.
>
> **Quotes expire in ~60 seconds.** Re-fetch if any delay before
> broadcast.

## Verify the Destination Balance

After the bridge or same-chain swap completes, poll for the asset
arrival on X Layer before returning to the EIP-3009 signing step:

```bash
for i in {1..20}; do
  XLAYER_BAL=$(cast call "$X402_ASSET" \
    "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
    --rpc-url https://rpc.xlayer.tech)
  if [ "$XLAYER_BAL" -ge "$X402_AMOUNT" ]; then
    echo "Funded. Balance: $XLAYER_BAL"
    break
  fi
  echo "Waiting for arrival... attempt $i/20 (balance: $XLAYER_BAL base units)"
  sleep 30
done

[ "$XLAYER_BAL" -ge "$X402_AMOUNT" ] || \
  { echo "Bridge not confirmed after 10 minutes. Do not re-submit."; exit 1; }
```

Once funded, return to
[`app-x402-flow.md`](app-x402-flow.md) to sign the EIP-3009
authorization and retry the original request.
