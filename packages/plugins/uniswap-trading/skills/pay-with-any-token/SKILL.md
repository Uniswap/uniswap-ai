---
name: pay-with-any-token
description: >
  Pay HTTP 402 payment challenges using tokens via the Uniswap Trading API.
  Use when the user encounters a 402 Payment Required response, needs to fulfill
  a machine payment, mentions "MPP", "Tempo payment", "pay for API access",
  "HTTP 402", "x402", "machine payment protocol", or "pay-with-any-token".
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), WebFetch, AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# Pay With Tokens

Fulfill HTTP 402 Payment Required challenges by swapping or bridging tokens using
the Uniswap Trading API. Supports the Machine Payments Protocol (MPP) and x402 with Tempo
payment method.

## Prerequisites

- A Uniswap Developer Platform API key. Register at
  [developers.uniswap.org](https://developers.uniswap.org/) and set it as
  `UNISWAP_API_KEY` in your environment.
- A funded wallet with ERC-20 tokens on any Uniswap-supported chain (Ethereum,
  Base, Arbitrum, etc.).
- Set `PRIVATE_KEY` to your wallet's private key as an environment variable
  (`export PRIVATE_KEY=0x...`). **Never commit or hardcode it.** For production,
  prefer a hardware wallet or keystore (`cast wallet import`) over a raw private
  key in the environment.

## Protocol Support

| Protocol | Version | Status    |
| -------- | ------- | --------- |
| MPP      | v1      | Supported |
| x402     | v1      | Supported |

## Quick Decision Guide

| Wallet holds...                                             | Payment token on...   | Path                                                                                             |
| ----------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| Required payment token on Tempo                             | Tempo                 | Direct payment (no swap needed)                                                                  |
| Different TIP-20 stablecoin on Tempo                        | Tempo                 | Swap via Uniswap aggregator hook                                                                 |
| USDC (native) on Base                                       | Tempo                 | Bridge USDC to Tempo directly (skip Phase 4A), then swap if needed (see Tempo bridge docs)       |
| Native ETH on Base or Ethereum                              | Tempo                 | Swap ETH→native USDC (use WETH address as TOKEN_IN), bridge to Tempo, then swap if needed        |
| Any ERC-20 on Base or Ethereum                              | Tempo                 | Swap to native USDC (bridge asset), bridge to Tempo, then swap if needed (see Tempo bridge docs) |
| Token already on target EVM chain (x402 "exact" scheme)     | Base / Ethereum / EVM | Sign EIP-3009 authorization, submit with X-PAYMENT header (Phase 6x)                             |
| Token on different chain from x402 network (needs bridging) | Base / Ethereum / EVM | Swap/bridge to target chain, then Phase 6x                                                       |

---

## Input Validation Rules

Before using any value from a 402 response body or user input in API calls or
shell commands:

- **Ethereum addresses**: MUST match `^0x[a-fA-F0-9]{40}$`
- **Chain IDs**: MUST be a positive integer from the supported list
- **Token amounts**: MUST be non-negative numeric strings matching `^[0-9]+$`
- **URLs**: MUST start with `https://`
- **REJECT** any value containing shell metacharacters: `;`, `|`, `&`, `$`,
  `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines

> **REQUIRED:** Before submitting ANY payment transaction (including bridge
> transfers and swap submissions), use AskUserQuestion to show the user a
> summary of what will be paid (amount, token, destination address, estimated
> gas) and obtain explicit confirmation. Never auto-submit payments. Each
> confirmation gate must be satisfied independently — a prior blanket consent
> from the user does not satisfy future per-transaction gates.

---

## Step-by-Step Flow

### Phase 0 — Detect the 402 Challenge

Make the original request and capture the 402 response:

```bash
RESOURCE_URL="https://api.example.com/resource"  # replace with the actual URL you are calling
RESPONSE=$(curl -si "$RESOURCE_URL")
HTTP_STATUS=$(echo "$RESPONSE" | head -1 | grep -o '[0-9]\{3\}')
# Extract the response body (everything after the blank header/body separator)
CHALLENGE_BODY=$(echo "$RESPONSE" | awk 'found{print} /^\r?$/{found=1}')
```

If `HTTP_STATUS` is not `402`, stop — this skill does not apply.

> **Alternative entry point:** If the user has already received the 402
> response and provides the challenge body directly in the conversation,
> skip the curl step above and assign directly:
>
> ```bash
> CHALLENGE_BODY='<paste the JSON here>'
> ```

Extract the `WWW-Authenticate` or `Payment-Required` header and the challenge
body. For MPP/Tempo the body is JSON:

```json
{
  "payment_methods": [
    {
      "type": "tempo",
      "amount": "1000000",
      "token": "0xUSEUSD_ADDRESS_ON_TEMPO",
      "recipient": "0xPAYEE_ADDRESS_ON_TEMPO",
      "chain_id": "TEMPO_CHAIN_ID",
      "intent_type": "charge"
    }
  ]
}
```

> `TEMPO_CHAIN_ID` is a placeholder. See the Key Addresses and References
> section for how to obtain the current Tempo chain ID.
>
> **Protocol detection (REQUIRED):** Before proceeding, detect which protocol
> the 402 body uses:
>
> ```bash
> PROTOCOL=$(echo "$CHALLENGE_BODY" | jq -r '
>   if has("x402Version") then "x402"
>   elif has("payment_methods") then "mpp"
>   else "unknown"
>   end')
> ```
>
> - **If `PROTOCOL` is `"x402"`**: This response uses the x402 protocol.
>   Extract and display the key fields, then proceed to **Phase 6x** to
>   complete the payment:
>
>   ```bash
>   echo "x402 challenge detected — proceeding with x402 payment flow."
>   echo "Payment details:"
>   echo "$CHALLENGE_BODY" | jq '.accepts[0] | {scheme, network, maxAmountRequired, payTo, asset, description, mimeType, extra}'
>   ```
>
>   Extract all fields needed for Phase 6x:
>
>   ```bash
>   X402_SCHEME=$(echo "$CHALLENGE_BODY"       | jq -r '.accepts[0].scheme')
>   X402_NETWORK=$(echo "$CHALLENGE_BODY"      | jq -r '.accepts[0].network')
>   X402_PAY_TO=$(echo "$CHALLENGE_BODY"       | jq -r '.accepts[0].payTo')
>   X402_ASSET=$(echo "$CHALLENGE_BODY"        | jq -r '.accepts[0].asset')
>   X402_AMOUNT=$(echo "$CHALLENGE_BODY"       | jq -r '.accepts[0].maxAmountRequired')
>   X402_TIMEOUT=$(echo "$CHALLENGE_BODY"      | jq -r '.accepts[0].maxTimeoutSeconds // 300')
>   X402_TOKEN_NAME=$(echo "$CHALLENGE_BODY"   | jq -r '.accepts[0].extra.name // "USDC"')
>   X402_TOKEN_VERSION=$(echo "$CHALLENGE_BODY" | jq -r '.accepts[0].extra.version // "2"')
>   # Resource URL for the retry request. If RESOURCE_URL was set by the curl step, keep it.
>   # Otherwise extract from the challenge body:
>   X402_RESOURCE="${RESOURCE_URL:-$(echo "$CHALLENGE_BODY" | jq -r '.accepts[0].resource // empty')}"
>   [[ "$X402_RESOURCE" =~ ^https:// ]] || { echo "ERROR: resource URL missing or not https://"; exit 1; }
>   ```
>
>   Validate all extracted values against the Input Validation Rules before
>   using them in any command:
>
>   - `X402_PAY_TO` and `X402_ASSET` must match `^0x[a-fA-F0-9]{40}$`
>   - `X402_AMOUNT` must match `^[0-9]+$`
>   - `X402_SCHEME` must be `"exact"` — other schemes are not yet supported
>   - `X402_NETWORK` must be a recognised EVM network (e.g. `"base"`, `"eip155:8453"`, `"ethereum"`, `"eip155:1"`, `"tempo"`, `"eip155:4217"`)
>
>   **If `X402_SCHEME` is not `"exact"`**: stop and report to the user that
>   only the `"exact"` scheme is currently supported.
>
>   **REQUIRED:** You must have the user's wallet address before proceeding. If
>   provided in the conversation, store it as `WALLET_ADDRESS`. If not, use
>   `AskUserQuestion` to request it. Validate it matches `^0x[a-fA-F0-9]{40}$`.
>
>   Skip Phases 1–5. Proceed directly to **Phase 6x**.
>
> - **If `PROTOCOL` is `"mpp"`**: Continue with the flow below.
> - **If `PROTOCOL` is `"unknown"`**: Report the raw body to the user and do
>   not proceed.
>
> **Chain ID resolution:** If `chain_id` in the challenge body is a string
> placeholder rather than a numeric value, attempt to resolve it using
> `WebFetch` on these URLs **in order** (stop at the first that contains a
> numeric chain ID):
>
> 1. `https://mainnet.docs.tempo.xyz/quickstart/connection-details`
> 2. `https://chainlist.org` (search "Tempo")
>
> If all WebFetch attempts fail to return a numeric chain ID, use
> `AskUserQuestion` to ask the user to provide it directly. They can find it
> at `https://chainlist.org` (search "Tempo") or from the Tempo team. Store as
> `TEMPO_CHAIN_ID`.
>
> ```bash
> # Fail fast if chain ID is still unresolved or not a positive integer:
> [ -z "$TEMPO_CHAIN_ID" ] && echo "ERROR: TEMPO_CHAIN_ID not set — cannot proceed" && exit 1
> [[ "$TEMPO_CHAIN_ID" =~ ^[0-9]+$ ]] || { echo "ERROR: TEMPO_CHAIN_ID must be a positive integer, got: $TEMPO_CHAIN_ID"; exit 1; }
> ```
>
> The Tempo mainnet chain ID is `4217` (confirmed in the Uniswap SDK). Use
> this as the fallback if WebFetch resolution fails. Dynamic resolution is
> preferred to stay current with any future changes.

Validate and extract fields. The `amount` is the exact output required (in
token base units). This skill is **exact-output oriented** — the payee specifies
the amount; the payer finds tokens to cover it.

### Phase 1 — Identify Payment Token and Required Amount

> **x402 path:** If `PROTOCOL` is `"x402"`, all required variables were
> extracted in Phase 0. Skip Phases 1–5 and proceed directly to **Phase 6x**.

From the challenge body, extract and assign shell variables:

```bash
REQUIRED_AMOUNT=$(echo "$CHALLENGE_BODY" | jq -r '.payment_methods[0].amount')
PAYMENT_TOKEN=$(echo "$CHALLENGE_BODY" | jq -r '.payment_methods[0].token')
RECIPIENT=$(echo "$CHALLENGE_BODY" | jq -r '.payment_methods[0].recipient')
# Only overwrite TEMPO_CHAIN_ID if it was not already resolved to a numeric
# value in Phase 0. If Phase 0's WebFetch or AskUserQuestion already produced
# a real chain ID, retain that value — do not clobber it with the placeholder.
if [ -z "$TEMPO_CHAIN_ID" ] || [[ ! "$TEMPO_CHAIN_ID" =~ ^[0-9]+$ ]]; then
  TEMPO_CHAIN_ID=$(echo "$CHALLENGE_BODY" | jq -r '.payment_methods[0].chain_id')
fi
INTENT_TYPE=$(echo "$CHALLENGE_BODY" | jq -r '.payment_methods[0].intent_type')

# Sanity-check the amount so the user can verify
echo "Amount : $REQUIRED_AMOUNT base units"
echo "Payment token : $PAYMENT_TOKEN"
echo "Recipient     : $RECIPIENT"
echo "Chain ID      : $TEMPO_CHAIN_ID"
echo "Intent        : $INTENT_TYPE"
```

> **Decimal note:** `amount` is in token base units. For USDC (6 decimals):
> `1000000` = 1.00 USDC, `500000` = 0.50 USDC. Confirm with the user before
> proceeding.

- `REQUIRED_AMOUNT`: token amount in base units (e.g., `"1000000"` = 1 USDC)
- `PAYMENT_TOKEN`: TIP-20 token address on Tempo. Verify this address at
  `https://mainnet.docs.tempo.xyz/tokens` before proceeding — an unrecognized
  token will cause the Phase 5 swap quote to fail.
- `RECIPIENT`: payee wallet address on Tempo
- `TEMPO_CHAIN_ID`: Tempo chain ID (may be a placeholder — see Phase 0 resolution)
- `INTENT_TYPE`: `"charge"` (one-time) or `"session"` (pay-as-you-go)

### Phase 2 — Check Wallet Balances

> **REQUIRED:** Before checking balances, you must have the user's wallet
> address. If the user has not provided one, use `AskUserQuestion` to ask
> now — **do not proceed further until you have it.** Never assume, guess,
> or use a placeholder address. Store as `WALLET_ADDRESS`.

Check the user's token balances on the chains where they hold funds. Use
`WebFetch` to query block explorer APIs or RPC endpoints for ERC-20 balances.
Set `USDC_E_ADDRESS` based on the source chain (see Key Addresses section for
per-chain USDC-e addresses). Identify the most cost-effective source token:

**Balance check examples (Base chain 8453)**:

```bash
# Native ETH balance
cast balance "$WALLET_ADDRESS" --rpc-url https://mainnet.base.org

# ERC-20 balance (e.g. USDC on Base)
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://mainnet.base.org
```

Or via Basescan API (no local tooling required):

```bash
# Replace TOKEN_ADDRESS with the ERC-20 contract you want to check.
# The API key is optional for basic balance queries — omit the &apikey= parameter
# for unauthenticated (rate-limited) access. Register at https://basescan.org/apis
# for a free API key with higher rate limits.
WebFetch "https://api.basescan.org/api?module=account&action=tokenbalance&contractaddress=TOKEN_ADDRESS&address=$WALLET_ADDRESS&tag=latest"
```

1. Prefer tokens already on Tempo (no bridge needed)
2. Then prefer USDC-e on Base (minimal bridge path)
3. Then use any liquid ERC-20 on Ethereum or Base

### Phase 3 — Plan the Payment Path

Choose a path based on what the wallet holds:

#### Path A — Already on Tempo

If wallet holds a TIP-20 stablecoin on Tempo:

1. If token matches the required payment token → proceed to Phase 5 directly
2. If different stablecoin → swap via Uniswap aggregator hook on Tempo (see Phase 5)

#### Path B — Cross-Chain (Base or Ethereum)

For tokens on Base or Ethereum, the full cross-chain path is:

```text
Source token (Base/Ethereum)
  → [Uniswap Trading API swap] → native USDC (bridge asset — see Key Addresses)
  → [Tempo bridge] → pathUSD or target TIP-20 on Tempo
  → [Uniswap aggregator hook on Tempo, if needed] → required payment token
```

> **Skip condition:** If the source token IS already the bridge asset (for
> example, you hold native USDC on Base for a Base→Tempo path), skip Phase 4A
> entirely and proceed directly to Phase 4B. No swap is needed.

### Phase 4A — Swap on Source Chain (if needed)

Use the Uniswap Trading API to swap the source token to USDC-e (the bridge
asset). This is an EXACT_OUTPUT swap — the payee's amount determines how much
USDC-e to acquire.

**Variable Setup** (fill these before running any steps in Phase 4A):

```bash
SOURCE_CHAIN_ID=8453              # Chain where you hold the source token (e.g. Base = 8453)
TOKEN_IN_ADDRESS="0x..."          # Address of your source token on SOURCE_CHAIN_ID
# For native ETH, use the WETH address for your chain (recommended — well-supported):
#   Base (8453):     0x4200000000000000000000000000000000000006
#   Ethereum (1):    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
# The Universal Router wraps ETH before the swap, so msg.value (SWAP_VALUE) will be
# non-zero in the swap response. The ETH sentinel 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEEE
# is also supported but try WETH first; use the sentinel only if WETH returns a 400.
USDC_E_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base — update for other chains (see Key Addresses)
REQUIRED_AMOUNT_IN="0"            # Use "0" for the initial approval check (Step 4A-1);
                                  # replace with the actual amountIn after Step 4A-2 (quote)
USDC_E_AMOUNT_NEEDED="$REQUIRED_AMOUNT"  # For EXACT_OUTPUT: target = payment amount
# Buffer decision: check Tempo bridge docs to confirm whether fees are deducted
# from the deposited amount (input-side fees) or charged separately on top.
# - Input-side fees: apply the 0.5% buffer — $(echo "$REQUIRED_AMOUNT * 1005 / 1000" | bc)
#   (integer arithmetic — avoids decimal output from bc)
# - Output-side or no fees: exact amount is fine, no buffer needed.
# When in doubt or docs are unavailable, apply the buffer to avoid arriving short.
```

> `slippageTolerance: 0.5` in the quote body means **0.5%** (not 0.005). The
> Trading API accepts slippage as a percentage value.

**Base URL**: `https://trade-api.gateway.uniswap.org/v1`

**Required headers**:

```text
Content-Type: application/json
x-api-key: <UNISWAP_API_KEY>
x-universal-router-version: 2.0
```

**Step 4A-1 — Check approval**:

```bash
# Build the request body safely using jq to avoid shell injection.
# The `amount` is used to determine whether the existing allowance is
# sufficient. Include it to receive an accurate approval status.
APPROVAL_BODY=$(jq -n \
  --arg wallet "$WALLET_ADDRESS" \
  --arg token "$TOKEN_IN_ADDRESS" \
  --arg amount "$REQUIRED_AMOUNT_IN" \
  --argjson chainId "$SOURCE_CHAIN_ID" \
  '{walletAddress: $wallet, token: $token, amount: $amount, chainId: $chainId}')

curl -s -X POST https://trade-api.gateway.uniswap.org/v1/check_approval \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
  -d "$APPROVAL_BODY"
```

> **REQUIRED:** If the `approval` field is non-null, use `AskUserQuestion` to
> show the user the approval details (token address, spender, amount, estimated
> gas) and obtain explicit confirmation before submitting the approval
> transaction.

**Step 4A-2 — Get exact-output quote for native USDC (bridge asset)**:

> **Address note:** `USDC_E_ADDRESS` in the code below refers to the bridge
> asset for the source chain. For Base (chain 8453), use native USDC:
> `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For Ethereum (chain 1), use
> USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. See Key Addresses section.

```bash
# Build the request body safely using jq. Chain IDs are integers; addresses
# and amounts are strings.
QUOTE_BODY=$(jq -n \
  --arg swapper "$WALLET_ADDRESS" \
  --arg tokenIn "$TOKEN_IN_ADDRESS" \
  --arg tokenOut "$USDC_E_ADDRESS" \
  --argjson tokenInChainId "$SOURCE_CHAIN_ID" \
  --argjson tokenOutChainId "$SOURCE_CHAIN_ID" \
  --arg amount "$USDC_E_AMOUNT_NEEDED" \
  --argjson slippage 0.5 \
  '{
    swapper: $swapper,
    tokenIn: $tokenIn,
    tokenOut: $tokenOut,
    tokenInChainId: $tokenInChainId,
    tokenOutChainId: $tokenOutChainId,
    amount: $amount,
    type: "EXACT_OUTPUT",
    slippageTolerance: $slippage,
    routingPreference: "BEST_PRICE"
  }')

curl -s -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
  -d "$QUOTE_BODY"
```

Note: `tokenInChainId` and `tokenOutChainId` must be **integers**, not strings.

Store the full quote response as `QUOTE_RESPONSE`. Then extract the actual input
amount and re-run the approval check with the real value:

```bash
REQUIRED_AMOUNT_IN=$(echo "$QUOTE_RESPONSE" | jq -r '.quote.amountIn')
# Re-run Step 4A-1 with REQUIRED_AMOUNT_IN set to the quoted amount
# to confirm the existing allowance covers the swap.
```

> **ETH/WETH approval note:** When `TOKEN_IN` is native ETH (WETH address), no
> ERC-20 approval is required. `REQUIRED_AMOUNT_IN` is the ETH value sent with
> the transaction — the approval re-check in Step 4A-1 is a no-op. Skip it and
> proceed directly to Step 4A-2.5.

**Step 4A-2.5 — Sign the permitData**:

If the quote response contains a non-null `permitData` field, you must sign it
off-chain before executing the swap.

> **ETH/WETH note:** When swapping native ETH (using the WETH address as
> `TOKEN_IN`), `permitData` is typically `null` — skip this step if so.
> Proceed directly to Step 4A-3.

- **For CLASSIC routing**: if `permitData` is non-null, sign it using the
  Permit2 contract's EIP-712 typed data signing scheme. The wallet's private
  key or connected signing method is required. See the Permit2 documentation
  or the [swap-integration](../swap-integration/SKILL.md) skill for signing
  details.
- **For UniswapX (DUTCH_V2, DUTCH_V3, PRIORITY)**: sign the `permitData`
  from the quote response using the same EIP-712 typed data approach.

Store the resulting signature as `PERMIT2_SIGNATURE`.

> **REQUIRED:** Use `AskUserQuestion` to confirm the signing step with the
> user before proceeding. Show the permit details (token, spender, amount,
> deadline) so the user understands what they are authorizing.

**Step 4A-3 — Execute the swap**:

```bash
# Strip permitData; re-attach only if non-null and routing is CLASSIC
ROUTING=$(echo "$QUOTE_RESPONSE" | jq -r '.routing')
CLEAN_QUOTE=$(echo "$QUOTE_RESPONSE" | jq 'del(.permitData, .permitTransaction)')

if [ "$ROUTING" = "CLASSIC" ]; then
  PERMIT_DATA=$(echo "$QUOTE_RESPONSE" | jq '.permitData')
  if [ "$PERMIT_DATA" != "null" ]; then
    # Guard: ensure PERMIT2_SIGNATURE was obtained in Step 4A-2.5
    if [ -z "$PERMIT2_SIGNATURE" ]; then
      echo "ERROR: permitData is present but PERMIT2_SIGNATURE is empty. Complete Step 4A-2.5 first."
      exit 1
    fi
    # Include signature + permitData in swap body
    SWAP_BODY=$(echo "$CLEAN_QUOTE" | jq \
      --arg sig "$PERMIT2_SIGNATURE" \
      --argjson pd "$PERMIT_DATA" \
      '. + {signature: $sig, permitData: $pd}')
  else
    SWAP_BODY="$CLEAN_QUOTE"
  fi
else
  # UniswapX (DUTCH_V2, DUTCH_V3, PRIORITY): signature only (no permitData in swap body)
  if [ -z "$PERMIT2_SIGNATURE" ]; then
    echo "ERROR: UniswapX order requires PERMIT2_SIGNATURE. Complete Step 4A-2.5 first."
    exit 1
  fi
  SWAP_BODY=$(echo "$CLEAN_QUOTE" | jq --arg sig "$PERMIT2_SIGNATURE" '. + {signature: $sig}')
fi

curl -s -X POST https://trade-api.gateway.uniswap.org/v1/swap \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
  -d "$SWAP_BODY"
```

Store the swap response as `SWAP_RESPONSE`. The `/swap` endpoint returns
**unsigned calldata** — you must broadcast it yourself. After validating
`swap.data` is non-empty, present the transaction summary to the user via
`AskUserQuestion` then broadcast:

```bash
# Extract the transaction fields from the swap response
SWAP_TO=$(echo "$SWAP_RESPONSE" | jq -r '.swap.to')
SWAP_DATA=$(echo "$SWAP_RESPONSE" | jq -r '.swap.data')
SWAP_VALUE=$(echo "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')

# Validate before broadcasting
[ -z "$SWAP_DATA" ] || [ "$SWAP_DATA" = "null" ] && echo "ERROR: swap.data is empty — quote may have expired. Re-fetch from Step 4A-2." && exit 1
# For native ETH swaps (TOKEN_IN is WETH address or ETH sentinel), SWAP_VALUE must
# be non-zero — it carries the ETH amount as msg.value. A zero value means the quote
# did not recognise the input as native ETH; do NOT broadcast or the swap will revert.
if [[ "$TOKEN_IN_ADDRESS" == "0x4200000000000000000000000000000000000006" || \
      "$TOKEN_IN_ADDRESS" == "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" || \
      "$TOKEN_IN_ADDRESS" == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEEE" ]]; then
  [ "$SWAP_VALUE" = "0x0" ] || [ "$SWAP_VALUE" = "0" ] && \
    echo "ERROR: SWAP_VALUE is zero for a native ETH swap — verify TOKEN_IN_ADDRESS and re-fetch the quote." && exit 1
fi

# Broadcast via cast (replace RPC URL with your source chain endpoint)
SWAP_TX=$(cast send "$SWAP_TO" \
  --data "$SWAP_DATA" \
  --value "$SWAP_VALUE" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url https://mainnet.base.org \
  --json | jq -r '.transactionHash')

# Wait for the swap to mine before bridging — a reverted swap leaves USDC at zero
SWAP_STATUS=$(cast receipt "$SWAP_TX" --rpc-url https://mainnet.base.org --json | jq -r '.status')
[ "$SWAP_STATUS" = "0x1" ] || { echo "ERROR: Swap reverted (status=$SWAP_STATUS). Do not proceed to bridge." && exit 1; }
echo "Swap confirmed: $SWAP_TX"

# Verify USDC balance landed before proceeding to Phase 4B
USDC_AFTER_SWAP=$(cast call "$USDC_E_ADDRESS" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://mainnet.base.org)
echo "USDC balance after swap: $USDC_AFTER_SWAP (need at least $USDC_E_AMOUNT_NEEDED)"
# Halt if swap produced insufficient USDC — bridging 0 USDC wastes gas and fails silently
[ "$USDC_AFTER_SWAP" -lt "$USDC_E_AMOUNT_NEEDED" ] && \
  echo "ERROR: swap produced $USDC_AFTER_SWAP USDC but $USDC_E_AMOUNT_NEEDED needed — check receipt, do NOT proceed to bridge." && exit 1
```

### Phase 4B — Bridge to Tempo (cross-chain path)

> **If you skipped Phase 4A** (you already hold the bridge asset, e.g. native
> USDC on Base), initialize these variables before proceeding:
>
> ```bash
> USDC_E_AMOUNT_NEEDED="$REQUIRED_AMOUNT"  # exact amount
> # With 0.5% buffer for bridge fees: $(echo "$REQUIRED_AMOUNT * 1005 / 1000" | bc)
> BRIDGE_ASSET_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base (update for other chains)
> ```

After acquiring the bridge asset on the source chain, bridge it to Tempo. The
bridge-in asset differs by source chain:

| Source chain     | Bridge asset                                      | Address                                      |
| ---------------- | ------------------------------------------------- | -------------------------------------------- |
| Base (8453)      | Native USDC                                       | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Ethereum (1)     | USDC                                              | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Arbitrum (42161) | USDC-e (bridged)                                  | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` |
| Other chains     | Check Tempo docs for the accepted bridge-in asset | —                                            |

> **SDK alternative:** The `mppx` package (`npm install mppx viem`) may
> provide bridge helper methods that handle this phase automatically. Check
> `https://mainnet.docs.tempo.xyz/guide/machine-payments/client` for SDK-based
> bridging before constructing raw transactions. If the SDK covers bridging,
> use it and skip the manual steps below.

**Resolve bridge contract addresses** (REQUIRED before proceeding):

You need **two** addresses:

- `BRIDGE_CONTRACT` — the deposit contract on the **source chain** (e.g. Base) where you call `approve` + `deposit`
- `BRIDGE_CONTRACT_ON_TEMPO` — the receiver contract on **Tempo** used to confirm the deposit event when polling

Use `WebFetch` to attempt to find both contract addresses:

1. `https://mainnet.docs.tempo.xyz/quickstart/predeployed-contracts`
2. `https://mainnet.docs.tempo.xyz/guide/machine-payments`

> **If WebFetch returns no contract addresses:** Do NOT guess or use an
> unverified address — bridging to the wrong contract results in **permanent
> fund loss**. Ask the user to provide the bridge contract address from an
> official source. They can:
>
> - Join the Tempo Discord at `https://discord.gg/tempo` and ask in
>   `#developers`
> - Check `https://github.com/tempo-io` for publicly deployed contract
>   addresses

The bridge process:

1. **Approve the bridge asset** to the bridge contract on the source chain
2. **Call the bridge deposit function** with the destination Tempo address and
   the token amount
3. **Wait for bridge confirmation** (typically a few minutes)

> **REQUIRED:** Use `AskUserQuestion` before submitting the bridge transaction.
> Show the user: amount, token, bridge contract address, destination address on
> Tempo, and estimated bridge time. Do not proceed until confirmed.

```bash
# Once you have the bridge contract address (from Tempo docs or team):
BRIDGE_CONTRACT="0x..."            # Tempo bridge contract on source chain
BRIDGE_AMOUNT="$USDC_E_AMOUNT_NEEDED"
BRIDGE_ASSET_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base (example)

# 1. Approve the bridge asset to the bridge contract
#    Wait for the approval to be mined before calling deposit (avoids "insufficient allowance")
SOURCE_RPC_URL="https://mainnet.base.org"  # replace with your source chain RPC
APPROVE_TX=$(cast send "$BRIDGE_ASSET_ADDRESS" \
  "approve(address,uint256)" \
  "$BRIDGE_CONTRACT" "$BRIDGE_AMOUNT" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$SOURCE_RPC_URL" \
  --json | jq -r '.transactionHash')
cast receipt "$APPROVE_TX" --rpc-url "$SOURCE_RPC_URL" > /dev/null
echo "Approval mined: $APPROVE_TX"

# 2. Call the bridge deposit function and capture the tx hash for polling
# NOTE: Replace the function signature with the actual ABI from Tempo docs.
# The parameters below are illustrative — confirm name, order, and types.
BRIDGE_TX=$(cast send "$BRIDGE_CONTRACT" \
  "deposit(address,uint256,address)" \
  "$BRIDGE_ASSET_ADDRESS" "$BRIDGE_AMOUNT" "$WALLET_ADDRESS" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$SOURCE_RPC_URL" \
  --json | jq -r '.transactionHash')
# Capture the block number for efficient log polling later (use --json for stable output)
BRIDGE_TX_BLOCK=$(cast receipt "$BRIDGE_TX" --rpc-url "$SOURCE_RPC_URL" --json | jq -r '.blockNumber')
# Convert hex to decimal if cast returns 0x-prefixed value
[[ "$BRIDGE_TX_BLOCK" == 0x* ]] && BRIDGE_TX_BLOCK=$((BRIDGE_TX_BLOCK))
```

> **ABI warning:** The exact function name and parameters must be verified from
> the Tempo bridge contract ABI at `https://mainnet.docs.tempo.xyz`. The example
> above uses a common ERC-20 bridge signature pattern. Do not submit without
> confirming the ABI.

Poll for bridge confirmation before proceeding to Phase 5:

1. WebFetch `https://explore.mainnet.tempo.xyz` to check if a bridge
   explorer API exists. If found, use it as the polling endpoint. If not,
   fall back to polling the Tempo RPC (`https://rpc.presto.tempo.xyz`) for
   the deposit event.
2. Poll every **30 seconds** for up to **10 minutes**.

   **Fallback polling loop** (when no bridge explorer API is available):

   ```bash
   # Replace EVENT_SIG with the actual deposit event signature from Tempo docs.
   # The ABI event name and parameters below are illustrative.
   BRIDGE_CONTRACT_ON_TEMPO="0x..."   # bridge's Tempo-side address (from docs)
   [ -z "$BRIDGE_CONTRACT_ON_TEMPO" ] && echo "ERROR: BRIDGE_CONTRACT_ON_TEMPO not set" && exit 1
   TEMPO_RPC_URL="https://rpc.presto.tempo.xyz"
   # Capture Tempo's current block BEFORE polling starts.
   # Note: BRIDGE_TX_BLOCK is the source-chain (e.g. Base) block number — do NOT use it here.
   # Tempo and Base have independent block heights; using the Base block on Tempo would fail.
   TEMPO_START_BLOCK=$(cast block-number --rpc-url "$TEMPO_RPC_URL" 2>/dev/null || echo "latest")
   for i in $(seq 1 20); do
     RESULT=$(cast logs \
       --rpc-url "$TEMPO_RPC_URL" \
       --from-block "$TEMPO_START_BLOCK" \
       --address "$BRIDGE_CONTRACT_ON_TEMPO" \
       "DepositReceived(address,uint256)" 2>/dev/null \
       | grep -i "${WALLET_ADDRESS#0x}")
     if [ -n "$RESULT" ]; then
       echo "Bridge confirmed — funds received on Tempo."
       break
     fi
     echo "Waiting for bridge confirmation... attempt $i/20"
     sleep 30
   done
   ```

   > Verify the event name and parameter types from the Tempo bridge ABI at
   > `https://mainnet.docs.tempo.xyz` before using this snippet.

3. Proceed to Phase 5 only once the funds are confirmed received on Tempo.
   After a successful bridge, your USDC on Base is converted to **pathUSD**
   (Tempo's bridged USDC equivalent) on Tempo. Use pathUSD's token address as
   `TOKEN_IN` in Phase 5 — look it up at
   `https://mainnet.docs.tempo.xyz/tokens`.
4. If no confirmation after 10 minutes, report the bridge transaction hash to
   the user and ask them to check the bridge explorer manually. **Do not
   re-submit the bridge transaction** — duplicate submissions result in double
   payment.

### Phase 5 — Swap to Required Payment Token on Tempo (if needed)

If the wallet now holds a TIP-20 stablecoin on Tempo that is not the exact
payment token, use the Uniswap aggregator hook on Tempo to swap to the required
token. The Uniswap Trading API supports Tempo chain ID `4217` — use the same
base URL `https://trade-api.gateway.uniswap.org/v1` with `4217` for both
`tokenInChainId` and `tokenOutChainId`. This follows the same flow as Phase 4A
but with Tempo's chain ID and token addresses.

**Token addresses on Tempo**: Look up TIP-20 token addresses (pathUSD, the
required payment token, etc.) at `https://mainnet.docs.tempo.xyz/tokens`. The
token you received from the bridge (your `TOKEN_IN` for this swap) is the
bridge-out asset on Tempo; the `TOKEN_OUT` is `PAYMENT_TOKEN` from Phase 1.
Set `SOURCE_CHAIN_ID` to Tempo's chain ID; use it for both `tokenInChainId` and
`tokenOutChainId` in the quote body.

### Phase 6 — Construct and Submit the MPP Credential

> **x402 path — STOP HERE.** If you arrived via the x402 detection gate in Phase 0,
> do not proceed with Phase 6. Phase 6 constructs an MPP credential; x402 payments
> use a different payload format handled in **Phase 6x** (below Phase 6).

With the required token in the wallet, fulfill the MPP challenge using the
**mppx** SDK, which handles the full 402 challenge → credential → retry cycle.

**Install:**

```bash
npm install mppx viem
```

**For a `charge` intent — automatic mode** (polyfills `fetch`):

```typescript
import { Mppx, tempo } from 'mppx/client';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

Mppx.create({ methods: [tempo.charge({ account })] });
const response = await fetch(process.env.RESOURCE_URL!);
// response is the 200 — credential was built and submitted automatically
```

Pass `autoSwap: true` to let mppx swap from available stablecoins (USDC.e or
pathUSD) to the required token automatically — useful if your wallet holds USDC.e
or pathUSD and the challenge requires a different token, letting you skip Phase 5:

```typescript
Mppx.create({ methods: [tempo.charge({ account, autoSwap: true })] });
const response = await fetch(process.env.RESOURCE_URL!);
```

**For a `charge` intent — manual mode** (show payment summary before paying):

> **REQUIRED:** Use `AskUserQuestion` before calling `createCredential`. Parse
> the `WWW-Authenticate: Payment` header from the 402 response and display the
> payment details to the user (amount, token, recipient, resource URL). Only
> proceed after explicit confirmation.

```typescript
import { Mppx, tempo } from 'mppx/client';
import { Receipt } from 'mppx';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const mppx = Mppx.create({ polyfill: false, methods: [tempo.charge({ account })] });

// Step 1: probe the endpoint to get the 402 challenge
const initial = await fetch(process.env.RESOURCE_URL!);
if (initial.status !== 402) throw new Error(`Expected 402, got ${initial.status}`);

// Step 2: REQUIRED — show payment summary to user and wait for confirmation
// Parse WWW-Authenticate header; display amount, token, recipient, resource.

// Step 3: build and submit the credential
const credential = await mppx.createCredential(initial, { account });
const paidResponse = await fetch(process.env.RESOURCE_URL!, {
  headers: { Authorization: credential },
});

if (paidResponse.status !== 200) {
  const body = await paidResponse.text();
  throw new Error(`Payment rejected (${paidResponse.status}): ${body}`);
}

// Step 4: parse the receipt
const receipt = Receipt.fromResponse(paidResponse);
console.log('Payment confirmed. Reference:', receipt.reference);
```

The `Authorization` header value returned by `createCredential()` has the form
`Payment <base64url-encoded credential>` — do not modify this value.

**For a `session` intent** (pay-as-you-go channel):

Pass a `maxDeposit` budget to `tempo()` to open a payment channel:

```typescript
// maxDeposit: '10' locks up to 10 pathUSD into the channel escrow
const mppx = Mppx.create({ methods: [tempo({ account, maxDeposit: '10' })] });
const response = await mppx.fetch(process.env.RESOURCE_URL!);
// The SDK manages channel lifecycle and voucher signing automatically
```

For fine-grained session control (manual open/close, sweep), see
`https://mpp.dev/sdk`.

**Direct submission (if credential was built externally):**

```bash
# $CREDENTIAL is the base64url-encoded credential string from mppx.createCredential()
# $RESOURCE_URL was set in Phase 0
curl -si "$RESOURCE_URL" \
  -H "Authorization: Payment $CREDENTIAL"
```

A `200` response with a `Payment-Receipt` header confirms success. Any other
status means the credential was rejected — check the response body and
re-inspect the challenge.

---

### Phase 6x — Construct and Submit the x402 Payment

> **x402 path only.** This phase is reached when `PROTOCOL` is `"x402"` (detected
> in Phase 0). Do not enter this phase from the MPP path.

The x402 `"exact"` scheme on EVM networks uses **EIP-3009**
(`transferWithAuthorization`) to authorize a one-time token transfer. The payer
signs an off-chain typed-data message; the facilitator verifies it and settles
the token transfer on-chain — no separate on-chain approval step is required.

**Prerequisite checks before signing:**

```bash
# 1. Confirm scheme is "exact" — only scheme currently supported
[ "$X402_SCHEME" = "exact" ] || { echo "ERROR: Only 'exact' scheme is supported. Got: $X402_SCHEME"; exit 1; }

# 2. Map network to a chain ID
# Accept both CAIP-2 format (eip155:8453) and plain names (base, ethereum)
case "$X402_NETWORK" in
  base|"eip155:8453")    X402_CHAIN_ID=8453;  SOURCE_RPC_URL="https://mainnet.base.org" ;;
  ethereum|"eip155:1")   X402_CHAIN_ID=1;     SOURCE_RPC_URL="https://eth.llamarpc.com" ;;
  tempo|"eip155:4217")   X402_CHAIN_ID=4217;  SOURCE_RPC_URL="${TEMPO_RPC_URL:-https://rpc.presto.tempo.xyz}" ;;
  *)
    echo "ERROR: Unrecognised or unsupported x402 network: $X402_NETWORK"
    echo "Supported: base / eip155:8453, ethereum / eip155:1, tempo / eip155:4217"
    exit 1
    ;;
esac

# Tempo-network: if wallet lacks the asset on Tempo, bridge first (Phase 4B → 5 → return here)
if [ "$X402_CHAIN_ID" = "4217" ]; then
  echo "x402 payment targets Tempo network — checking Tempo-side balance..."
  TEMPO_BALANCE=$(cast call "$X402_ASSET" \
    "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
    --rpc-url "$SOURCE_RPC_URL" 2>/dev/null || echo "0")
  if [ "$TEMPO_BALANCE" -lt "$X402_AMOUNT" ]; then
    echo "Insufficient balance on Tempo ($TEMPO_BALANCE < $X402_AMOUNT)."
    echo "Bridge funds to Tempo first (see Phase 4B), then return to Phase 6x."
    echo "After bridging, re-run from Step 6x-1."
    exit 1
  fi
fi

# 3. Check wallet token balance — must be >= X402_AMOUNT before signing
ASSET_BALANCE=$(cast call "$X402_ASSET" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url "$SOURCE_RPC_URL")
[ "$ASSET_BALANCE" -lt "$X402_AMOUNT" ] && \
  { echo "ERROR: Insufficient balance. Have $ASSET_BALANCE, need $X402_AMOUNT"; exit 1; }
```

> **REQUIRED:** Use `AskUserQuestion` to show the user a payment summary before
> signing anything:
>
> - Token: `$X402_TOKEN_NAME` (`$X402_ASSET`) on `$X402_NETWORK`
> - Amount: `$X402_AMOUNT` base units
>   (e.g. `1000000` = 1.00 USDC for a 6-decimal token)
> - Recipient: `$X402_PAY_TO`
> - Resource: `$X402_RESOURCE`
>
> Obtain explicit confirmation before proceeding.

**Step 6x-1 — Generate nonce and deadline:**

```bash
X402_NONCE="0x$(openssl rand -hex 32)"    # 32-byte random nonce
X402_VALID_AFTER=0                         # immediately valid
X402_VALID_BEFORE=$(( $(date +%s) + X402_TIMEOUT ))  # expiry = now + maxTimeoutSeconds
```

**Step 6x-2 — Sign the EIP-3009 `TransferWithAuthorization` typed data:**

The EIP-3009 domain uses the token contract's own `name` and `version` (from the
`extra` field in the x402 challenge body). The `verifyingContract` is the token
contract itself (`X402_ASSET`).

Sign using viem:

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const domain = {
  name: process.env.X402_TOKEN_NAME!, // from extra.name, e.g. "USDC"
  version: process.env.X402_TOKEN_VERSION!, // from extra.version, e.g. "2"
  chainId: Number(process.env.X402_CHAIN_ID),
  verifyingContract: process.env.X402_ASSET as `0x${string}`,
};

// REQUIRED: show the user what they are about to sign before calling signTypedData
const signature = await account.signTypedData({
  domain,
  types: {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  message: {
    from: process.env.WALLET_ADDRESS as `0x${string}`,
    to: process.env.X402_PAY_TO as `0x${string}`,
    value: BigInt(process.env.X402_AMOUNT!),
    validAfter: BigInt(process.env.X402_VALID_AFTER!),
    validBefore: BigInt(process.env.X402_VALID_BEFORE!),
    nonce: process.env.X402_NONCE as `0x${string}`,
  },
});
process.env.X402_SIGNATURE = signature;
```

> **Domain warning:** The `verifyingContract` is the **token contract** (`X402_ASSET`),
> not a separate verifier. Use the `name` and `version` from `extra` — do not assume
> USDC defaults. Different tokens have different domain values. An incorrect domain
> produces a signature the server will reject with a 402.
>
> **REQUIRED:** Use `AskUserQuestion` before this step. Show the
> `TransferWithAuthorization` message fields (from, to, value, validBefore)
> so the user can verify what they are signing. Store the resulting signature as
> `X402_SIGNATURE`.

**Step 6x-3 — Construct the X-PAYMENT payload:**

```bash
X402_PAYMENT_JSON=$(jq -n \
  --arg  scheme      "$X402_SCHEME" \
  --arg  network     "$X402_NETWORK" \
  --argjson chainId  "$X402_CHAIN_ID" \
  --arg  from        "$WALLET_ADDRESS" \
  --arg  to          "$X402_PAY_TO" \
  --argjson value    "$X402_AMOUNT" \
  --argjson validAfter  "$X402_VALID_AFTER" \
  --argjson validBefore "$X402_VALID_BEFORE" \
  --arg  nonce       "$X402_NONCE" \
  --arg  sig         "$X402_SIGNATURE" \
  --arg  asset       "$X402_ASSET" \
  '{
    scheme:  $scheme,
    network: $network,
    chainId: $chainId,
    payload: {
      authorization: {
        from:        $from,
        to:          $to,
        value:       $value,
        validAfter:  $validAfter,
        validBefore: $validBefore,
        nonce:       $nonce
      },
      signature: $sig
    },
    asset: $asset
  }')

# Base64-encode — strip newlines (required by header spec)
X402_PAYMENT=$(echo "$X402_PAYMENT_JSON" | base64 | tr -d '[:space:]')
```

**Step 6x-4 — Retry the original request with `X-PAYMENT` header:**

```bash
RETRY_RESPONSE=$(curl -si "$X402_RESOURCE" \
  -H "X-PAYMENT: $X402_PAYMENT" \
  -H "Content-Type: application/json")

RETRY_STATUS=$(echo "$RETRY_RESPONSE" | head -1 | grep -o '[0-9]\{3\}')
RETRY_BODY=$(echo "$RETRY_RESPONSE" | awk 'found{print} /^\r?$/{found=1}')
X402_PAYMENT_RESPONSE=$(echo "$RETRY_RESPONSE" \
  | grep -i 'x-payment-response:' | cut -d' ' -f2- | tr -d '[:space:]')

echo "HTTP status: $RETRY_STATUS"
```

**Interpreting the response:**

| Status | Meaning                                                 | Action                                                                                       |
| ------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 200    | Payment accepted — resource delivered                   | Display body; decode receipt with `echo "$X402_PAYMENT_RESPONSE" \| base64 --decode \| jq .` |
| 402    | Payment rejected (bad signature, expired, wrong amount) | Check domain name/version, validBefore, and amount                                           |
| 400    | Malformed payment payload                               | Verify JSON structure and base64 encoding                                                    |
| Other  | Server or network error                                 | Report raw body; do not resubmit                                                             |

**Tempo-network variant:** If `X402_NETWORK` is `"tempo"` (or `eip155:<tempo-chain-id>`),
the payment token is a Tempo TIP-20 address. You must first bridge USDC to Tempo
using Phase 4B and optionally swap using Phase 5. After confirming the Tempo-side
token balance, return here to execute Steps 6x-1 through 6x-4, using the
Tempo-side token contract as `X402_ASSET` and the Tempo chain ID as `X402_CHAIN_ID`.

---

## Error Handling

| Situation                      | Action                                                               |
| ------------------------------ | -------------------------------------------------------------------- |
| Challenge body is malformed    | Report raw body to user; do not proceed                              |
| Approval transaction fails     | Surface error; suggest checking gas and allowances                   |
| Quote API returns 400          | Log request/response; check amount formatting                        |
| Quote API returns 429          | Wait and retry with exponential backoff                              |
| Swap data is empty after /swap | Quote expired; re-fetch quote from Phase 4A-2                        |
| Bridge times out               | Check bridge explorer; do not re-submit                              |
| Credential rejected (non-200)  | Report response body; check credential construction                  |
| x402 payment rejected (402)    | Check domain name/version, validBefore deadline, and nonce freshness |

---

## Key Addresses and References

- **Trading API**: `https://trade-api.gateway.uniswap.org/v1`
- **MPP docs**: `https://mpp.dev`
- **Tempo documentation**: `https://mainnet.docs.tempo.xyz`
- **Tempo chain ID**: `4217` (Tempo mainnet)
- **Tempo RPC**: `https://rpc.presto.tempo.xyz`
- **Tempo Block Explorer**: `https://explore.mainnet.tempo.xyz`
- **pathUSD on Tempo**: `0x20c0000000000000000000000000000000000000` (primary stablecoin)
- **Stablecoin DEX on Tempo**: `0xdec0000000000000000000000000000000000000`
- **Permit2 on Tempo**: `0x000000000022d473030f116ddee9f6b43ac78ba3`
- **Tempo payment SDK**: `mppx` (`npm install mppx viem`) — handles credential
  creation via `Mppx.create` + `createCredential()`. See
  `https://mainnet.docs.tempo.xyz/guide/machine-payments/client`
- **Tempo bridge**: Contract addresses must be obtained from Tempo directly
  (see Phase 4B for the resolution procedure). Do NOT use unverified addresses.
- **USDC on Base (8453)**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (native USDC issued by Circle — preferred bridge asset)
- **USDbC on Base (8453)**: `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` (legacy bridged USDC — use native USDC if the bridge supports it)
- **USDC-e on Arbitrum (42161)**:
  `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`
- **USDC on Ethereum (1)**: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
  (use as bridge asset for Ethereum to Tempo path)
- **Supported chains for Trading API**: 1 (Ethereum), 8453 (Base),
  42161 (Arbitrum), 10 (Optimism), 137 (Polygon), 130 (Unichain)
- **x402 specification and reference implementation**: `https://github.com/coinbase/x402`

## Related Skills

- [swap-integration](../swap-integration/SKILL.md) — Full Uniswap swap
  integration reference (Trading API, Universal Router, Permit2)
