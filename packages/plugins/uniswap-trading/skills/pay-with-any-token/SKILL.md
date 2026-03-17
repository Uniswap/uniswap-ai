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
| Native ETH on Base or Ethereum                              | Tempo                 | Swap ETH->native USDC (use WETH address as TOKEN_IN), bridge to Tempo, then swap if needed       |
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
>   **Wallet funding check** — before skipping Phases 1-5, confirm your wallet
>   holds sufficient `X402_ASSET` on `X402_NETWORK`:
>
>   ```bash
>   X402_RPC=$(case "$X402_NETWORK" in
>     base|"eip155:8453")  echo "https://mainnet.base.org" ;;
>     ethereum|"eip155:1") echo "https://eth.llamarpc.com" ;;
>     tempo|"eip155:4217") echo "https://rpc.presto.tempo.xyz" ;;
>     *) echo "" ;;
>   esac)
>   X402_CURRENT_BALANCE=$(cast call "$X402_ASSET" \
>     "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
>     --rpc-url "$X402_RPC" 2>/dev/null || echo "0")
>   ```
>
>   - **If `X402_CURRENT_BALANCE >= X402_AMOUNT`**: Proceed directly to
>     **Phase 6x**. Skip Phases 1-5.
>   - **If `X402_CURRENT_BALANCE < X402_AMOUNT`** and funds are on the
>     **same chain** (you hold a different token on `X402_NETWORK`): run
>     **Phase 4A** with `USDC_E_ADDRESS="$X402_ASSET"` and
>     `USDC_E_AMOUNT_NEEDED="$X402_AMOUNT"` to swap into the required asset,
>     then proceed to **Phase 6x**.
>   - **If `X402_CURRENT_BALANCE < X402_AMOUNT`** and funds are on a
>     **different chain**: run **Phase 4A** (swap to bridge asset on source
>     chain) -> **Phase 4B** (bridge to `X402_NETWORK`) -> **Phase 5** (swap
>     on target chain if needed), then proceed to **Phase 6x**.
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
> extracted in Phase 0. Follow the routing decision made there: if wallet
> balance was sufficient, skip Phases 1-5 and proceed to **Phase 6x**;
> otherwise continue through Phase 4A / 4B / 5 as directed, then **Phase 6x**.

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

1. If token matches the required payment token -> proceed to Phase 5 directly
2. If different stablecoin -> swap via Uniswap aggregator hook on Tempo (see Phase 5)

#### Path B — Cross-Chain (Base or Ethereum)

For tokens on Base or Ethereum, the full cross-chain path is:

```text
Source token (Base/Ethereum)
  -> [Uniswap Trading API swap] -> native USDC (bridge asset — see Key Addresses)
  -> [Tempo bridge] -> pathUSD or target TIP-20 on Tempo
  -> [Uniswap aggregator hook on Tempo, if needed] -> required payment token
```

> **Skip condition:** If the source token IS already the bridge asset (for
> example, you hold native USDC on Base for a Base->Tempo path), skip Phase 4A
> entirely and proceed directly to Phase 4B. No swap is needed.

### Phase 4A — Swap on Source Chain (if needed)

Swap the source token to USDC (the bridge asset) via the Uniswap Trading API.
This is an EXACT_OUTPUT swap — the payee's amount determines how much USDC to
acquire.

> **Detailed steps:** Read
> [references/trading-api-flows.md](references/trading-api-flows.md#phase-4a--swap-on-source-chain)
> for the full bash scripts: variable setup, approval check, quote,
> permit signing, and swap execution.

Key points:

- Base URL: `https://trade-api.gateway.uniswap.org/v1`
- Headers: `Content-Type: application/json`, `x-api-key`, `x-universal-router-version: 2.0`
- Flow: `check_approval` -> quote (`EXACT_OUTPUT`) -> sign `permitData` -> `/swap` -> broadcast via `cast send`
- Confirmation gates required before approval tx and before swap broadcast
- For native ETH: use WETH address as `TOKEN_IN`; `SWAP_VALUE` will be non-zero
- After swap, verify USDC balance landed before proceeding to Phase 4B

### Phase 4B — Bridge to Tempo (cross-chain path)

Bridge USDC from Base to USDC.e on Tempo using the Uniswap Trading API
(powered by Across Protocol). No manual contract calls required.

> **Detailed steps:** Read
> [references/trading-api-flows.md](references/trading-api-flows.md#phase-4b--bridge-to-tempo)
> for the full bash scripts: approval, bridge quote, execution, and arrival
> polling.

Key points:

- Route: USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) -> USDC.e on Tempo (`0x20C000000000000000000000b9537d11c60E8b50`)
- Flow: `check_approval` -> quote (`EXACT_OUTPUT`, cross-chain) -> execute via `/swap` -> poll balance every 30s
- Confirmation gates required before approval and before bridge execution
- Do not re-submit if poll times out — duplicate bridge deposits cause double payment
- If Phase 4A was skipped (already hold USDC), set `USDC_E_AMOUNT_NEEDED="$REQUIRED_AMOUNT"`

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

> **x402 path — STOP HERE.** If you arrived via the x402 detection gate in
> Phase 0, do not proceed with Phase 6. Phase 6 constructs an MPP credential;
> x402 payments use a different payload format handled in **Phase 6x** below.

Use the `mppx` SDK to fulfill the MPP challenge. Install: `npm install mppx viem`.

> **Detailed steps:** Read
> [references/credential-construction.md](references/credential-construction.md#phase-6--mpp-credential)
> for full code: automatic mode, manual mode, session intents, and direct
> submission.

Key patterns:

- **Charge (automatic):** `Mppx.create({ methods: [tempo.charge({ account })] })` — polyfills fetch, handles 402 automatically
- **Charge (manual):** `mppx.createCredential(response, { account })` — returns `Authorization: Payment <credential>`
- **Session:** `tempo({ account, maxDeposit: '10' })` — opens a pay-as-you-go channel
- **autoSwap:** Pass `autoSwap: true` to let mppx swap stablecoins automatically (skip Phase 5)
- Confirmation gate required before `createCredential()`

### Phase 6x — Construct and Submit the x402 Payment

> **x402 path only.** This phase is reached when `PROTOCOL` is `"x402"`
> (detected in Phase 0). Do not enter this phase from the MPP path.

The x402 `"exact"` scheme uses EIP-3009 (`transferWithAuthorization`) to
authorize a one-time token transfer signed off-chain.

> **Detailed steps:** Read
> [references/credential-construction.md](references/credential-construction.md#phase-6x--x402-payment)
> for full code: prerequisite checks, nonce generation, EIP-3009 signing,
> X-PAYMENT payload construction, and retry.

Key points:

- Maps `X402_NETWORK` to chain ID and RPC URL (base, ethereum, tempo supported)
- Checks wallet balance on target chain; directs to Phase 4A/4B/5 if insufficient
- Signs `TransferWithAuthorization` typed data using token's own domain (name, version from `extra`)
- Constructs JSON payload, base64-encodes it, sends as `X-PAYMENT` header
- `value` in the payload must be a **string** (`--arg`, not `--argjson`) to preserve uint256 precision
- Confirmation gate required before signing

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
