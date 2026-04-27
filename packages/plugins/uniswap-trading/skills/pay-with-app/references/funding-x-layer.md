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
| USDT0 (`0x779Ded0c…`) | ✅ default                    | Deepest Uniswap v3 liquidity (USDT0/USDG and USDT0/WOKB pools; additional pools at other fee tiers may be deployed, and the Trading API will pick the optimal route across all available pools). Use this if the 402 challenge accepts USDT0.                                                                                                        |
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
> # Non-zero OKB sanity check. This does not guarantee enough gas to broadcast
> # a swap; it only catches the common "wallet has literally zero OKB" case.
> # Replace with a real threshold (e.g. 0.001 OKB) if you want to gate on
> # usable gas.
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
  -H "x-universal-router-version: 2.1.1" \
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

> **Important: Across coverage gap (verified 2026-04-27).** The Uniswap
> Trading API uses Across Protocol for cross-chain routing. **Across
> does not currently include X Layer (chain 196) in its destination
> list.** Live `/quote` calls with `tokenOutChainId=196` and a different
> `tokenInChainId` return `ResourceNotFound: No quotes available` for
> every source chain we tested (Ethereum, Base, Arbitrum, native ETH).
> Same-chain X Layer swaps (Phase A) work normally.
>
> **What this means for the agent.** Until Across adds X Layer, the
> Trading API cannot bridge tokens onto X Layer in a single quote. If
> the user holds funds on a chain other than X Layer, the cross-chain
> leg must be done through a bridge service that supports X Layer as a
> destination (the user must run that step outside this skill, then
> re-invoke for the same-chain swap + 402 settlement).
>
> **TODO (research before mid-May launch follow-up):** confirm and
> document the recommended X-Layer-supporting bridge for Uniswap+OKX
> co-marketing alignment. Until then, do not prescribe a specific bridge
> service in user-facing responses; surface the limitation honestly and
> let the user choose.

The block below describes the design intent: a single Trading API quote
that handles swap + bridge into X Layer. It is preserved so the skill
works without code changes the day Across adds X Layer. Today, expect
the quote call to return `ResourceNotFound`. When that happens, fall
through to the user-handoff path documented at the end of this section.

Apply a **0.5% buffer** to compute `X402_AMOUNT_WITH_BUFFER` from
`X402_AMOUNT` to absorb bridge fees. If the shortfall is < $5 worth,
top up to $5 to amortize source chain gas.

```bash
set -euo pipefail

# Apply 0.5% buffer (uint256-safe integer math via python)
X402_AMOUNT_WITH_BUFFER=$(python3 -c "print(($X402_AMOUNT * 1005) // 1000)")
[[ "$X402_AMOUNT_WITH_BUFFER" =~ ^[0-9]+$ ]] || { echo "buffer math failed" >&2; exit 1; }

QUOTE_FETCHED_AT=$(date +%s)

# Capture HTTP status and body separately so we can distinguish:
#   (a) HTTP 200 success      -> proceed with the original Phase B flow
#   (b) errorCode=ResourceNotFound (Across coverage gap) -> deferred-bridge handoff
#   (c) network errors / 5xx  -> surface as transient, advise retry
#
# IMPORTANT: do NOT use `curl -f` here. Under `set -e` a non-zero curl
# exit would terminate the script before we read $? into QUOTE_HTTP_STATUS,
# making the deferred-bridge branch unreachable on the exact failure
# path it is designed to handle. We capture status with `-w` instead.
QUOTE_BODY_FILE=$(mktemp)
trap 'rm -f "$QUOTE_BODY_FILE"' EXIT

QUOTE_HTTP_STATUS=$(curl -sS -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -o "$QUOTE_BODY_FILE" \
  -w '%{http_code}' \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.1.1" \
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
    }')") || {
  # curl itself failed (DNS, TLS, network unreachable, etc.) -> case (c)
  echo "ERROR: Trading API call failed at the network layer (curl exit \$? = $?)." >&2
  echo "This is most likely a transient connectivity issue (DNS, TLS, network)." >&2
  echo "Advise the user to retry; do NOT route them to an external bridge for this case." >&2
  exit 1
}

QUOTE=$(cat "$QUOTE_BODY_FILE")
QUOTE_ERROR_CODE=$(echo "$QUOTE" | jq -r '.errorCode // empty' 2>/dev/null || echo "")
```

Branch on the result:

```bash
set -euo pipefail

if [ "$QUOTE_HTTP_STATUS" = "200" ] && [ -z "$QUOTE_ERROR_CODE" ]; then
  : # success -> continue with permitData + /swap on the source chain
elif [ "$QUOTE_ERROR_CODE" = "ResourceNotFound" ]; then
  : # case (b): the deferred-bridge handoff below
elif [ "$QUOTE_HTTP_STATUS" -ge 500 ] 2>/dev/null; then
  echo "ERROR: Trading API returned HTTP $QUOTE_HTTP_STATUS (server error)." >&2
  echo "This is most likely transient. Advise the user to retry shortly." >&2
  exit 1
else
  echo "ERROR: Trading API returned HTTP $QUOTE_HTTP_STATUS, errorCode=$QUOTE_ERROR_CODE." >&2
  echo "Body: $QUOTE" >&2
  echo "Surface raw body to the user; do not route to an external bridge automatically." >&2
  exit 1
fi
```

If `errorCode` is `ResourceNotFound`, **the Trading API cannot currently
deliver to X Layer cross-chain.** This is the expected state today
(Across does not list X Layer as a destination). Surface a clear
message to the user via `AskUserQuestion`:

> "The Uniswap Trading API does not currently support X Layer as a
> cross-chain destination via Across Protocol (verified
> 2026-04-27). To pay this APP merchant, please bridge USDT0 (or
> another stablecoin that lands as USDT0 on X Layer) to your wallet
> using a bridge service that supports X Layer destinations. Once
> the funds arrive on X Layer, re-invoke this skill and we will
> handle the same-chain swap (if needed) and the 402 settlement."

Do NOT recommend a specific bridge product to the user in this skill
version; the v1.0.0 stance is "any bridge that supports X Layer is
fine; pick what you trust." A future skill version may add a
co-marketing-aligned bridge recommendation once verified.

If the quote call DOES succeed (i.e. Across has shipped X Layer
support since this doc was written), continue with the original flow:
quote response contains `permitData` (sign with EIP-712), the `/swap`
endpoint returns the calldata to broadcast on the source chain, and
Across handles the X Layer arrival.

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
hash into `SOURCE_TX_HASH` (used in the bridge timeout message below):

```bash
SOURCE_TX_HASH=$(echo "$SWAP_RESPONSE" | jq -r '.transactionHash // empty')
[[ "$SOURCE_TX_HASH" =~ ^0x[a-fA-F0-9]{64}$ ]] || {
  echo "no tx hash from /swap response" >&2
  exit 1
}
```

> **Bridge recipient.** The Trading API delivers funds to the same
> `swapper` address on chain 196. If the user wants the funds at a
> different X Layer address (e.g. an OKX Agentic Wallet they custody
> separately), an extra transfer transaction on X Layer is required
> after the bridge confirms.
>
> **Quotes expire in ~60 seconds.** Re-fetch if any delay before
> broadcast (the freshness gate above enforces a 45s ceiling).
>
> **Retry hygiene.** On any retry of the quote-then-broadcast cycle,
> re-derive both `QUOTE_FETCHED_AT` (the freshness timestamp) and
> `X402_AMOUNT_WITH_BUFFER` (the buffered output amount) from the new
> quote. Reusing stale values from an earlier attempt will either trip
> the freshness gate or quote against an outdated buffer.

## Verify the Destination Balance

After the bridge or same-chain swap completes, poll for the asset
arrival on X Layer before returning to the EIP-3009 signing step. The
loop tolerates transient RPC failures and validates that the returned
balance is a non-negative integer.

If after 10 minutes the wallet still has insufficient `$X402_ASSET`,
the funds may have arrived at a different token address (rare for
current Across paths to X Layer) or the bridge may have failed.
Surface the ambiguity to the user with the source-chain tx hash and
the Across explorer link, and ask them to verify on-chain. v1.0.0
does not auto-detect alternate-token arrival on X Layer.

```bash
set -euo pipefail

# Assert prerequisites are set. SOURCE_TX_HASH must have been captured
# from the /swap response before entering the polling loop.
: "${SOURCE_TX_HASH:?missing, capture from /swap response before polling}"
: "${X402_ASSET:?missing}"
: "${X402_AMOUNT:?missing}"
: "${WALLET_ADDRESS:?missing}"

# Track successful RPC reads so we can distinguish "20 RPC failures" from
# "20 successful reads, all under target" at the end.
RPC_SUCCESS_COUNT=0

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
  RPC_SUCCESS_COUNT=$((RPC_SUCCESS_COUNT + 1))
  if [ "$XLAYER_BAL" -ge "$X402_AMOUNT" ]; then
    echo "Funded. Balance: $XLAYER_BAL"
    break
  fi

  echo "Waiting for arrival... attempt $i/20 (balance: $XLAYER_BAL base units)"
  sleep 30
done

# If every attempt was an RPC failure, surface that distinctly before the
# generic "no usable balance" check below.
[ "$RPC_SUCCESS_COUNT" -gt 0 ] || {
  echo "ERROR: all 20 attempts were RPC failures; bridge state unknown." >&2
  echo "Source tx: $SOURCE_TX_HASH. Check https://app.across.to/transactions before re-submitting." >&2
  exit 1
}

# Assert we have a usable balance reading. No `:-0` defaults here, those
# would defeat `set -u` and silently coerce a missing read into "below
# target".
[[ -n "${XLAYER_BAL:-}" && "$XLAYER_BAL" =~ ^[0-9]+$ ]] || {
  echo "ERROR: bridge polling completed without a successful RPC read." >&2
  echo "20 RPC failures or non-integer responses; cannot determine arrival state." >&2
  echo "Source tx: $SOURCE_TX_HASH. Check https://app.across.to/transactions before re-submitting." >&2
  exit 1
}

[ "$XLAYER_BAL" -ge "$X402_AMOUNT" ] || {
  echo "Bridge not confirmed after 10 minutes. Wallet still holds $XLAYER_BAL of $X402_ASSET on X Layer (need $X402_AMOUNT)." >&2
  echo "Source tx: $SOURCE_TX_HASH." >&2
  echo "The funds may have arrived at a different token address (rare for current Across paths to X Layer) or the bridge may have failed." >&2
  echo "Verify on-chain via https://app.across.to/transactions and https://www.oklink.com/x-layer/address/$WALLET_ADDRESS before re-submitting." >&2
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
