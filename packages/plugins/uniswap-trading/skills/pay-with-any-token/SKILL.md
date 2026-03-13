---
name: pay-with-any-token
description: >
  Pay HTTP 402 payment challenges using tokens via the Uniswap Trading API.
  Use when the user encounters a 402 Payment Required response, needs to fulfill
  a machine payment, mentions "MPP", "Tempo payment", "pay for API access",
  "HTTP 402", "machine payment protocol", or "pay-with-any-token".
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), WebFetch, AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# Pay With Tokens

Fulfill HTTP 402 Payment Required challenges by swapping or bridging tokens using
the Uniswap Trading API. Supports the Machine Payments Protocol (MPP) with Tempo
payment method.

## Prerequisites

- A Uniswap Developer Platform API key. Register at
  [developers.uniswap.org](https://developers.uniswap.org/) and set it as
  `UNISWAP_API_KEY` in your environment.
- A funded wallet with ERC-20 tokens on any Uniswap-supported chain (Ethereum,
  Base, Arbitrum, etc.).

## Protocol Support

| Protocol | Version | Status      |
| -------- | ------- | ----------- |
| MPP      | v1      | Supported   |
| x402     | -       | Coming soon |

## Quick Decision Guide

| Wallet holds...                      | Payment token on... | Path                                                                                             |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------ |
| Required payment token on Tempo      | Tempo               | Direct payment (no swap needed)                                                                  |
| Different TIP-20 stablecoin on Tempo | Tempo               | Swap via Uniswap aggregator hook                                                                 |
| USDC (native) on Base                | Tempo               | Bridge USDC to Tempo directly (skip Phase 4A), then swap if needed (see Tempo bridge docs)       |
| Any ERC-20 on Base or Ethereum       | Tempo               | Swap to native USDC (bridge asset), bridge to Tempo, then swap if needed (see Tempo bridge docs) |

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
RESPONSE=$(curl -si "https://api.example.com/resource")
HTTP_STATUS=$(echo "$RESPONSE" | head -1 | grep -o '[0-9]\{3\}')
```

If `HTTP_STATUS` is not `402`, stop — this skill does not apply.

> **Alternative entry point:** If the user has already received the 402
> response and provides the challenge body directly in the conversation,
> skip the curl step above and proceed directly to field extraction and
> validation below.

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
> section for how to obtain the current Tempo chain ID from the Tempo docs.
>
> **Chain ID resolution:** If `chain_id` in the challenge body is a string
> placeholder rather than a numeric value, use `WebFetch` on
> `https://docs.tempo.xyz` to resolve the current Tempo chain ID before
> proceeding. Do not hardcode Tempo's chain ID — consult live documentation
> as Tempo is in active development.

Validate and extract fields. The `amount` is the exact output required (in
token base units). This skill is **exact-output oriented** — the payee specifies
the amount; the payer finds tokens to cover it.

### Phase 1 — Identify Payment Token and Required Amount

From the challenge body, extract:

- `required_amount`: token amount in base units (e.g., `"1000000"` = 1 USDC)
- `payment_token`: TIP-20 token address on Tempo
- `recipient`: payee wallet address on Tempo
- `chain_id`: Tempo chain ID
- `intent_type`: `"charge"` (one-time) or `"session"` (pay-as-you-go)

### Phase 2 — Check Wallet Balances

> Before checking balances, identify the user's wallet address. Ask the user
> for their wallet address if not already provided — store as
> `WALLET_ADDRESS`. Never assume or hallucinate a wallet address.

Check the user's token balances on the chains where they hold funds. Use
`WebFetch` to query block explorer APIs or RPC endpoints for ERC-20 balances.
Set `USDC_E_ADDRESS` based on the source chain (see Key Addresses section for
per-chain USDC-e addresses). Identify the most cost-effective source token:

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

Store the full quote response as `QUOTE_RESPONSE`.

**Step 4A-2.5 — Sign the permitData**:

If the quote response contains a non-null `permitData` field, you must sign it
off-chain before executing the swap.

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

Validate that `swap.data` is non-empty before broadcasting. Present the
transaction summary to the user via AskUserQuestion before submitting.

### Phase 4B — Bridge to Tempo (cross-chain path)

After acquiring USDC-e on the source chain, bridge it to Tempo. The Tempo bridge
accepts USDC-e (Bridged USDC) as the canonical bridge-in asset. Consult
`https://docs.tempo.xyz` for current bridge contract addresses and the
bridge API.

The bridge process is:

1. **Approve USDC-e** to the bridge contract on the source chain
2. **Call the bridge deposit function** with the destination Tempo address and
   the USDC-e amount
3. **Wait for bridge confirmation** (typically a few minutes)

> **REQUIRED:** Use `AskUserQuestion` before submitting the bridge transaction.
> Show the user: amount, bridge contract address, destination address on Tempo,
> and estimated bridge time.

Poll for bridge confirmation before proceeding to Phase 5:

1. Use `WebFetch` on `https://docs.tempo.xyz` to find the bridge explorer URL
   and transaction status API endpoint.
2. Poll the bridge explorer API every **30 seconds** for up to **10 minutes**.
3. Proceed to Phase 5 only once the funds are confirmed received on Tempo.
4. If no confirmation after 10 minutes, report the bridge transaction hash to
   the user and ask them to check the bridge explorer manually. **Do not
   re-submit the bridge transaction** — duplicate submissions can result in
   double payment.

### Phase 5 — Swap to Required Payment Token on Tempo (if needed)

If the wallet now holds a TIP-20 stablecoin on Tempo that is not the exact
payment token, use the Uniswap aggregator hook on Tempo to swap to the required
token. The Uniswap Trading API supports Tempo's chain ID — use the same base
URL `https://trade-api.gateway.uniswap.org/v1` with the Tempo chain ID for
both `tokenInChainId` and `tokenOutChainId`. Verify Tempo chain ID support is
live in the Trading API before attempting. This follows the same flow as
Phase 4A but with Tempo's chain ID and token addresses.

### Phase 6 — Construct and Submit the MPP Credential

With the required token in the wallet, fulfill the MPP challenge.

**For a `charge` intent:**

1. Construct the payment authorization object:

   - `payment_method_type`: `"tempo"`
   - `recipient`: the payee address from the 402 challenge
   - `amount`: the exact amount in base units
   - `token`: the payment token address
   - `chain_id`: Tempo chain ID (see Key Addresses section)
   - `nonce`: a unique per-payment nonce (UUID or timestamp)

2. **Ask the user for their signing method** — you cannot sign on behalf of
   the user. Use `AskUserQuestion` to ask how they will sign the credential:

   - **Foundry (`cast`)**: the most common CLI approach
   - **MetaMask / browser wallet**: via `eth_signTypedData_v4`
   - **Hardware wallet (Ledger/Trezor)**: via their respective CLIs
   - **Custom script**: any EIP-712 compatible library

   Store the answer as `SIGNING_METHOD`. Consult `https://mpp.dev` for the
   canonical EIP-712 type definitions for the authorization object.

   **Example using Foundry `cast` (if user has cast installed):**

   ```bash
   # Serialize the authorization object to JSON
   AUTH_JSON=$(jq -n \
     --arg pmt "tempo" \
     --arg recipient "$RECIPIENT" \
     --arg amount "$REQUIRED_AMOUNT" \
     --arg token "$PAYMENT_TOKEN" \
     --argjson chainId "$TEMPO_CHAIN_ID" \
     --arg nonce "$NONCE" \
     '{payment_method_type: $pmt, recipient: $recipient, amount: $amount,
       token: $token, chain_id: $chainId, nonce: $nonce}')

   # User signs with cast (they must supply their private key or keystore)
   # See https://mpp.dev for the correct EIP-712 domain and type hash
   cast sign --private-key "$PRIVATE_KEY" "$AUTH_JSON"
   ```

   > **REQUIRED:** Use `AskUserQuestion` before this step. Show the
   > authorization object contents so the user can verify what they are
   > signing. Store the resulting signature as `MPP_SIGNATURE`.

3. Construct the full credential JSON object:

   ```json
   {
     "type": "tempo",
     "authorization": <authorization_object>,
     "signature": "<MPP_SIGNATURE>"
   }
   ```

4. Serialize the **entire credential JSON object** to a string and
   base64-encode it — not just the authorization field:

   ```bash
   CREDENTIAL=$(echo "$CREDENTIAL_JSON" | base64 | tr -d '\n')
   ```

**For a `session` intent:**

A payment channel enables pay-as-you-go usage. Session intents are more complex
than charge intents and may require additional setup. Consult the MPP SDK at
`https://mpp.dev/sdk` for channel opening procedures.

**Submit the credential** by retrying the original request with the credential
in the `Authorization` header or as the `X-Payment-Credential` header per the
protocol spec:

```bash
curl -si "https://api.example.com/resource" \
  -H "Authorization: MPP credential=<CREDENTIAL>" \
  -H "X-Payment-Credential: <CREDENTIAL>"
```

A `200` response with a receipt confirms success. Any other status indicates the
credential was rejected — check the error body and re-inspect the challenge.

---

## Error Handling

| Situation                      | Action                                              |
| ------------------------------ | --------------------------------------------------- |
| Challenge body is malformed    | Report raw body to user; do not proceed             |
| Approval transaction fails     | Surface error; suggest checking gas and allowances  |
| Quote API returns 400          | Log request/response; check amount formatting       |
| Quote API returns 429          | Wait and retry with exponential backoff             |
| Swap data is empty after /swap | Quote expired; re-fetch quote from Phase 4A-2       |
| Bridge times out               | Check bridge explorer; do not re-submit             |
| Credential rejected (non-200)  | Report response body; check credential construction |

---

## Key Addresses and References

- **Trading API**: `https://trade-api.gateway.uniswap.org/v1`
- **MPP docs**: `https://mpp.dev`
- **Tempo documentation**: `https://docs.tempo.xyz`
- **Tempo chain ID**: See Tempo documentation at `https://docs.tempo.xyz`
  for the current chain ID (Tempo is in active development; consult docs for
  the latest value)
- **Tempo bridge**: See Tempo documentation for bridge contract addresses
- **USDC on Base (8453)**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (native USDC issued by Circle — preferred bridge asset)
- **USDbC on Base (8453)**: `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` (legacy bridged USDC — use native USDC if the bridge supports it)
- **USDC-e on Arbitrum (42161)**:
  `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`
- **USDC on Ethereum (1)**: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
  (use as bridge asset for Ethereum to Tempo path)
- **Supported chains for Trading API**: 1 (Ethereum), 8453 (Base),
  42161 (Arbitrum), 10 (Optimism), 137 (Polygon), 130 (Unichain)

## Related Skills

- [swap-integration](../swap-integration/SKILL.md) — Full Uniswap swap
  integration reference (Trading API, Universal Router, Permit2)
