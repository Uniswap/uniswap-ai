---
name: pay-with-tokens
description: >
  Pay HTTP 402 payment challenges using tokens via the Uniswap Trading API.
  Use when the user encounters a 402 Payment Required response, needs to fulfill
  a machine payment, mentions "MPP", "Tempo payment", "pay for API access",
  "HTTP 402", "machine payment protocol", or "pay-with-tokens".
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), WebFetch, AskUserQuestion
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

| Wallet holds...            | Payment token on... | Path                     |
| -------------------------- | ------------------- | ------------------------ |
| USDC/USDT on Tempo         | Tempo               | Swap via aggregator hook |
| Any ERC-20 on Base         | Tempo               | Swap to USDC-e → bridge  |
| Any ERC-20 on Ethereum     | Tempo               | Swap to USDC-e → bridge  |
| TIP-20 stablecoin on Tempo | Tempo               | Direct payment (no swap) |

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
> gas) and obtain explicit confirmation. Never auto-submit payments.

---

## Step-by-Step Flow

### Phase 0 — Detect the 402 Challenge

Make the original request and capture the 402 response:

```bash
RESPONSE=$(curl -si "https://api.example.com/resource")
HTTP_STATUS=$(echo "$RESPONSE" | head -1 | grep -o '[0-9]\{3\}')
```

If `HTTP_STATUS` is not `402`, stop — this skill does not apply.

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

Check the user's token balances on the chains where they hold funds. Use
`WebFetch` to query block explorer APIs or RPC endpoints for ERC-20 balances.
Identify the most cost-effective source token:

1. Prefer tokens already on Tempo (no bridge needed)
2. Then prefer USDC-e on Base (minimal bridge path)
3. Then use any liquid ERC-20 on Ethereum or Base

### Phase 3 — Plan the Payment Path

Choose a path based on what the wallet holds:

#### Path A — Already on Tempo

If wallet holds a TIP-20 stablecoin on Tempo:

1. If token matches the required payment token → proceed to Phase 5 directly
2. If different stablecoin → swap via Uniswap aggregator hook on Tempo (see Phase 4A)

#### Path B — Cross-Chain (Base or Ethereum)

For tokens on Base or Ethereum, the full cross-chain path is:

```text
Source token (Base/Ethereum)
  → [Uniswap Trading API swap] → USDC-e (bridging asset)
  → [Tempo bridge] → pathUSD or target TIP-20 on Tempo
  → [Uniswap aggregator hook on Tempo, if needed] → required payment token
```

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
curl -s -X POST https://trade-api.gateway.uniswap.org/v1/check_approval \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
  -d '{
    "walletAddress": "'"$WALLET_ADDRESS"'",
    "token": "'"$TOKEN_IN_ADDRESS"'",
    "amount": "'"$REQUIRED_AMOUNT_IN"'",
    "chainId": '"$SOURCE_CHAIN_ID"'
  }'
```

If the `approval` field is non-null, submit and confirm the approval transaction
before proceeding.

**Step 4A-2 — Get exact-output quote for USDC-e**:

```bash
curl -s -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
  -d '{
    "swapper": "'"$WALLET_ADDRESS"'",
    "tokenIn": "'"$TOKEN_IN_ADDRESS"'",
    "tokenOut": "'"$USDC_E_ADDRESS"'",
    "tokenInChainId": "'"$SOURCE_CHAIN_ID"'",
    "tokenOutChainId": "'"$SOURCE_CHAIN_ID"'",
    "amount": "'"$USDC_E_AMOUNT_NEEDED"'",
    "type": "EXACT_OUTPUT",
    "slippageTolerance": 0.5,
    "routingPreference": "BEST_PRICE"
  }'
```

Note: `tokenInChainId` and `tokenOutChainId` must be **strings**, not numbers.

Store the full quote response as `QUOTE_RESPONSE`.

**Step 4A-3 — Execute the swap**:

```bash
# Strip permitData; re-attach only if non-null and routing is CLASSIC
ROUTING=$(echo "$QUOTE_RESPONSE" | jq -r '.routing')
CLEAN_QUOTE=$(echo "$QUOTE_RESPONSE" | jq 'del(.permitData, .permitTransaction)')

if [ "$ROUTING" = "CLASSIC" ]; then
  PERMIT_DATA=$(echo "$QUOTE_RESPONSE" | jq '.permitData')
  if [ "$PERMIT_DATA" != "null" ]; then
    # Sign permitData off-chain, then include signature + permitData in swap body
    SWAP_BODY=$(echo "$CLEAN_QUOTE" | jq \
      --arg sig "$PERMIT2_SIGNATURE" \
      --argjson pd "$PERMIT_DATA" \
      '. + {signature: $sig, permitData: $pd}')
  else
    SWAP_BODY="$CLEAN_QUOTE"
  fi
else
  # UniswapX (DUTCH_V2, DUTCH_V3, PRIORITY): signature only (no permitData in swap body)
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

After acquiring USDC-e on the source chain, bridge it to Tempo via the Tempo
bridge. Bridge parameters come from the Tempo documentation or the 402 challenge
metadata. Wait for bridge confirmation before proceeding.

### Phase 5 — Swap to Required Payment Token on Tempo (if needed)

If the wallet now holds a TIP-20 stablecoin on Tempo that is not the exact
payment token, use the Uniswap aggregator hook on Tempo to swap to the required
token. This follows the same Trading API flow as Phase 4A but with Tempo's
chain ID and token addresses.

### Phase 6 — Construct and Submit the MPP Credential

With the required token in the wallet, fulfill the MPP challenge:

1. For a `charge` intent: sign the payment authorization as specified by the
   Tempo/MPP SDK and construct the credential payload
2. For a `session` intent: open a payment channel as specified by the MPP protocol
3. Retry the original request with the credential in the `Authorization` header
   or as the `X-Payment-Credential` header per the protocol spec

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
- **Tempo bridge**: See Tempo documentation for bridge contract addresses
- **Supported chains for Trading API**: 1 (Ethereum), 8453 (Base), 42161 (Arbitrum), 10 (Optimism), 137 (Polygon), 130 (Unichain)

## Related Skills

- [swap-integration](../swap-integration/SKILL.md) — Full Uniswap swap
  integration reference (Trading API, Universal Router, Permit2)
