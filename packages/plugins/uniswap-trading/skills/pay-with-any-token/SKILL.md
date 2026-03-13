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

> **x402 detection:** If your 402 response contains `x402Version` in the body,
> see Phase 0 — the skill detects x402 format and provides guidance even though
> full x402 support is not yet implemented.

## Quick Decision Guide

| Wallet holds...                      | Payment token on... | Path                                                                                             |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------ |
| Required payment token on Tempo      | Tempo               | Direct payment (no swap needed)                                                                  |
| Different TIP-20 stablecoin on Tempo | Tempo               | Swap via Uniswap aggregator hook                                                                 |
| USDC (native) on Base                | Tempo               | Bridge USDC to Tempo directly (skip Phase 4A), then swap if needed (see Tempo bridge docs)       |
| Native ETH on Base or Ethereum       | Tempo               | Swap ETH→native USDC (use WETH address as TOKEN_IN), bridge to Tempo, then swap if needed        |
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
> - **If `PROTOCOL` is `"x402"`**: This response uses the x402 protocol
>   (`x402Version: N`). **This skill currently supports MPP v1 only — x402
>   support is planned.** Stop the MPP flow here. Instead, extract and display
>   the key fields for the user's reference:
>
>   ```bash
>   echo "x402 challenge detected — skill cannot fulfill this automatically yet."
>   echo "Payment details from x402 challenge:"
>   echo "$CHALLENGE_BODY" | jq '.accepts[0] | {scheme, network, maxAmountRequired, payTo, asset, description, mimeType}'
>   ```
>
>   Suggest the user check `https://github.com/coinbase/x402` for an x402
>   client library that can handle this natively.
>
>   If the `network` field is `"tempo"` and you hold tokens on Base or
>   Ethereum, you will still need to bridge them to Tempo even with an x402
>   client. Phase 4B of this skill covers bridging. Before using it, map the
>   x402 field names to the MPP variable names that Phase 4B expects:
>
>   ```bash
>   # x402 → Phase 4B variable mapping
>   REQUIRED_AMOUNT=$(echo "$CHALLENGE_BODY" | jq -r '.accepts[0].maxAmountRequired')
>   RECIPIENT=$(echo "$CHALLENGE_BODY" | jq -r '.accepts[0].payTo')
>   # NOTE: The asset field is the source-chain token address (e.g. USDC on Base).
>   # Do NOT use this as TOKEN_OUT on Tempo — look up the Tempo TIP-20 equivalent
>   # at https://mainnet.docs.tempo.xyz/tokens and update PAYMENT_TOKEN before Phase 5.
>   PAYMENT_TOKEN=$(echo "$CHALLENGE_BODY" | jq -r '.accepts[0].asset')
>   INTENT_TYPE="charge"              # x402 'exact' scheme = one-time charge
>   USDC_E_AMOUNT_NEEDED="$REQUIRED_AMOUNT"  # Phase 4B will optionally add a buffer
>   BRIDGE_ASSET_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base
>   # If the user provided their wallet address in the conversation, assign it now:
>   # WALLET_ADDRESS="<address from conversation>"
>   # Otherwise use AskUserQuestion to request it before proceeding to Phase 4B.
>   ```
>
>   After bridging (and any Phase 5 Tempo-side swap), hand off to your x402
>   client library to construct and submit the x402 payment payload. **Do NOT
>   proceed to Phase 6** — Phase 6 builds an MPP credential, not an x402
>   payment. Do not continue with the MPP phases below.
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
> 1. `https://mainnet.docs.tempo.xyz/getting-started/network-info`
> 2. `https://mainnet.docs.tempo.xyz/developer-integration/connection-details`
> 3. `https://mainnet.docs.tempo.xyz/network`
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
> Do not hardcode Tempo's chain ID — Tempo is in active development and the
> chain ID may change.

Validate and extract fields. The `amount` is the exact output required (in
token base units). This skill is **exact-output oriented** — the payee specifies
the amount; the payer finds tokens to cover it.

### Phase 1 — Identify Payment Token and Required Amount

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
- `PAYMENT_TOKEN`: TIP-20 token address on Tempo
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
# For native ETH, use the WETH address for your chain:
#   Base (8453):     0x4200000000000000000000000000000000000006
#   Ethereum (1):    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
# The Trading API may also accept the ETH sentinel 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEEE
USDC_E_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base — update for other chains (see Key Addresses)
REQUIRED_AMOUNT_IN="0"            # Use "0" for the initial approval check (Step 4A-1);
                                  # replace with the actual amountIn after Step 4A-2 (quote)
USDC_E_AMOUNT_NEEDED="$REQUIRED_AMOUNT"  # For EXACT_OUTPUT: target = payment amount
                                          # Add ~0.5% buffer if bridge fees may reduce the bridged
                                          # amount: $(echo "$REQUIRED_AMOUNT * 1005 / 1000" | bc)
                                          # (integer arithmetic — avoids decimal output from bc)
                                          # Without buffer, bridge fees could leave you short.
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

# Broadcast via cast (replace RPC URL with your source chain endpoint)
cast send "$SWAP_TO" \
  --data "$SWAP_DATA" \
  --value "$SWAP_VALUE" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url https://mainnet.base.org
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

**Resolve bridge contract addresses** (REQUIRED before proceeding):

You need **two** addresses:

- `BRIDGE_CONTRACT` — the deposit contract on the **source chain** (e.g. Base) where you call `approve` + `deposit`
- `BRIDGE_CONTRACT_ON_TEMPO` — the receiver contract on **Tempo** used to confirm the deposit event when polling

Use `WebFetch` to attempt to find both contract addresses:

1. `https://mainnet.docs.tempo.xyz/developer-integration/bridge`
2. `https://mainnet.docs.tempo.xyz/contracts`

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
# Capture the block number for efficient log polling later
BRIDGE_TX_BLOCK=$(cast receipt "$BRIDGE_TX" --rpc-url "$SOURCE_RPC_URL" | grep blockNumber | awk '{print $2}')
```

> **ABI warning:** The exact function name and parameters must be verified from
> the Tempo bridge contract ABI at `https://mainnet.docs.tempo.xyz`. The example
> above uses a common ERC-20 bridge signature pattern. Do not submit without
> confirming the ABI.

Poll for bridge confirmation before proceeding to Phase 5:

1. WebFetch `https://mainnet.docs.tempo.xyz/bridge-explorer` to check if a bridge
   explorer API exists. If found, use it as the polling endpoint. If not,
   fall back to polling the Tempo RPC (`https://rpc.tempo.xyz` — verify from
   docs) for the deposit event.
2. Poll every **30 seconds** for up to **10 minutes**.

   **Fallback polling loop** (when no bridge explorer API is available):

   ```bash
   # Replace EVENT_SIG with the actual deposit event signature from Tempo docs.
   # The ABI event name and parameters below are illustrative.
   BRIDGE_CONTRACT_ON_TEMPO="0x..."   # bridge's Tempo-side address (from docs)
   [ -z "$BRIDGE_CONTRACT_ON_TEMPO" ] && echo "ERROR: BRIDGE_CONTRACT_ON_TEMPO not set" && exit 1
   # Verify the Tempo RPC URL from mainnet.docs.tempo.xyz/developer-integration/connection-details
   TEMPO_RPC_URL="https://rpc.tempo.xyz"
   for i in $(seq 1 20); do
     RESULT=$(cast logs \
       --rpc-url "$TEMPO_RPC_URL" \
       --from-block "${BRIDGE_TX_BLOCK:-latest}" \
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
   `https://mainnet.docs.tempo.xyz/tokens` (may be gated pre-launch).
4. If no confirmation after 10 minutes, report the bridge transaction hash to
   the user and ask them to check the bridge explorer manually. **Do not
   re-submit the bridge transaction** — duplicate submissions result in double
   payment.

### Phase 5 — Swap to Required Payment Token on Tempo (if needed)

If the wallet now holds a TIP-20 stablecoin on Tempo that is not the exact
payment token, use the Uniswap aggregator hook on Tempo to swap to the required
token. The Uniswap Trading API supports Tempo's chain ID — use the same base
URL `https://trade-api.gateway.uniswap.org/v1` with the Tempo chain ID for
both `tokenInChainId` and `tokenOutChainId`. Verify Tempo chain ID support is
live in the Trading API before attempting. This follows the same flow as
Phase 4A but with Tempo's chain ID and token addresses.

**Token addresses on Tempo**: Look up TIP-20 token addresses (pathUSD, the
required payment token, etc.) at `https://mainnet.docs.tempo.xyz/tokens` (may
be gated pre-launch — contact the Tempo team for the current registry). The
token you received from the bridge (your `TOKEN_IN` for this swap) is the
bridge-out asset on Tempo; the `TOKEN_OUT` is `PAYMENT_TOKEN` from Phase 1.
Set `SOURCE_CHAIN_ID` to Tempo's chain ID; use it for both `tokenInChainId` and
`tokenOutChainId` in the quote body.

> **If the Trading API does not yet support Tempo's chain ID** (you receive a
> 400 or "unsupported chain" error from the quote endpoint): check the current
> supported chains list at `https://developers.uniswap.org`. If Tempo is not
> listed, you cannot complete the on-Tempo swap via this skill at this time.
> As a workaround, confirm with the API provider whether the bridged token
> (e.g. pathUSD) is already accepted as the payment token — if so, the bridge
> output may satisfy the 402 requirement and Phase 5 can be skipped.

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

   **Before signing, generate a nonce and deadline, and set the verifier address:**

   ```bash
   NONCE=0x$(openssl rand -hex 32)    # 32 bytes = bytes32, with 0x prefix
   DEADLINE=$(($(date +%s) + 300))    # 5-minute window matching maxTimeoutSeconds
   MPP_VERIFIER_ADDRESS="0x..."       # Deployed MPP contract — from https://mpp.dev
                                      # (may be gated pre-launch; contact Tempo team)
   ```

   **Build the authorization JSON:**

   ```bash
   # $REQUIRED_AMOUNT must be a validated integer string (see Input Validation Rules);
   # --argjson encodes it as a JSON number to match the uint256 EIP-712 field type.
   AUTH_JSON=$(jq -n \
     --arg pmt "tempo" \
     --arg recipient "$RECIPIENT" \
     --argjson amount "$REQUIRED_AMOUNT" \
     --arg token "$PAYMENT_TOKEN" \
     --argjson chainId "$TEMPO_CHAIN_ID" \
     --arg nonce "$NONCE" \
     --argjson deadline "$DEADLINE" \
     '{payment_method_type: $pmt, recipient: $recipient, amount: $amount,
       token: $token, chain_id: $chainId, nonce: $nonce, deadline: $deadline}')
   # Note: amount uses --argjson (not --arg) so it encodes as a JSON number,
   # matching the uint256 EIP-712 type. viem's signTypedData accepts number|bigint
   # for uint256 — amounts ≤ 2^53 (well above any USDC payment) are safe as-is.
   # For amounts > 2^53 or other EIP-712 libraries, use: BigInt(authMsg.amount).
   ```

   **Sign using viem (recommended — correctly handles EIP-712 typed data):**

   ```typescript
   import { privateKeyToAccount } from 'viem/accounts';

   const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

   // Parse the AUTH_JSON built in the bash step above
   const authMsg = JSON.parse(process.env.AUTH_JSON!);

   // chainId and verifyingContract must come from https://mpp.dev — do NOT guess
   // (docs may be gated pre-launch; contact the Tempo team for values pre-launch)
   const domain = {
     name: 'MPP',
     version: '1',
     chainId: Number(process.env.TEMPO_CHAIN_ID),
     verifyingContract: process.env.MPP_VERIFIER_ADDRESS as `0x${string}`,
   };

   const signature = await account.signTypedData({
     domain,
     types: {
       Authorization: [
         { name: 'payment_method_type', type: 'string' },
         { name: 'recipient', type: 'address' },
         { name: 'amount', type: 'uint256' },
         { name: 'token', type: 'address' },
         { name: 'chain_id', type: 'uint256' },
         { name: 'nonce', type: 'bytes32' },
         { name: 'deadline', type: 'uint256' },
       ],
     },
     primaryType: 'Authorization',
     message: authMsg,
   });
   ```

   > **EIP-712 domain warning:** `MPP_VERIFIER_ADDRESS` is the deployed MPP
   > contract address. Obtain both `chainId` and `verifyingContract` from
   > `https://mpp.dev` at launch. Do NOT guess the domain separator — an
   > incorrect domain produces a signature that will be rejected by the MPP
   > validator.

   **Alternative — Foundry `cast wallet sign` (CLI users, Foundry ≥ 0.2):**

   ```bash
   # Requires the full typed data JSON including domain and types fields.
   # See https://mpp.dev for the correct domain and type schema.
   cast wallet sign --private-key "$PRIVATE_KEY" \
     --typed-data '{"domain":{...},"types":{"Authorization":[...]},"message":{...}}'
   ```

   > **Note:** Do NOT use `cast sign` (without `wallet`) for EIP-712 — it
   > performs `eth_sign` (raw bytes prefix), not typed data signing, and
   > produces an invalid MPP credential.
   >
   > **REQUIRED:** Use `AskUserQuestion` before this step. Show the
   > authorization object contents so the user can verify what they are
   > signing. Store the resulting signature as `MPP_SIGNATURE`.

3. Assemble and base64-encode the full credential:

   ```bash
   # Assemble the credential object
   CREDENTIAL_JSON=$(jq -n \
     --arg type "tempo" \
     --argjson auth "$AUTH_JSON" \
     --arg sig "$MPP_SIGNATURE" \
     '{type: $type, authorization: $auth, signature: $sig}')

   # Base64-encode the entire credential object (not just the authorization field)
   # tr -d '[:space:]' strips newlines and carriage returns (portable across macOS/Linux)
   CREDENTIAL=$(echo "$CREDENTIAL_JSON" | base64 | tr -d '[:space:]')
   ```

**For a `session` intent:**

A payment channel enables pay-as-you-go usage. Session intents require opening
a channel before the first request and streaming micropayments as you consume
the API. The high-level steps are:

1. **Open a channel** — deposit a session budget into the MPP channel contract
   on Tempo. The required fields include: `payment_method_type`, `recipient`,
   `token`, `chain_id`, a session `nonce`, a `max_amount` (total budget), and
   a `session_duration` (seconds). EIP-712 signing follows the same pattern as
   the charge flow above but with a `SessionAuthorization` typed struct instead
   of `Authorization`.
2. **Attach the channel credential** — include the base64-encoded session
   credential in the `X-Payment-Credential` header on every subsequent API
   request.
3. **Closing / expiry** — the channel auto-expires after `session_duration`.
   The API provider can sweep uncollected funds after expiry.

> **Session intents are not fully covered by this skill.** For the complete
> channel API, typed struct definitions, and SDK helpers, consult
> `https://mpp.dev/sdk` (may be gated pre-launch — contact the Tempo team).
> If your 402 specifies `"intent_type": "session"` and you need to proceed
> immediately, ask the Tempo team for a pre-launch integration guide.

**Submit the credential** by retrying the original request with the credential
attached. `X-Payment-Credential` is the MPP-native header; `Authorization:
MPP credential=` is provided for compatibility with servers that expect it.
Consult `https://mpp.dev` for the canonical header the target server requires.
Including both is safe for broad compatibility:

```bash
# $RESOURCE_URL was set in Phase 0; if using the alternative entry point,
# set it manually: RESOURCE_URL="https://..." (the URL that returned the 402)
curl -si "$RESOURCE_URL" \
  -H "Authorization: MPP credential=$CREDENTIAL" \
  -H "X-Payment-Credential: $CREDENTIAL"
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
- **MPP docs**: `https://mpp.dev` _(may be gated pre-launch; publicly available
  at launch — contact the Tempo team for EIP-712 domain values pre-launch)_
- **Tempo documentation**: `https://mainnet.docs.tempo.xyz` _(may be gated
  pre-launch; publicly available at launch — contact the Tempo team if you
  receive a 401 or password prompt)_
- **Tempo chain ID**: Unknown at time of writing — must be resolved via
  documentation or `https://chainlist.org` (search "Tempo"). See Phase 0 for
  the chain ID resolution procedure. Do NOT hardcode a value without verifying.
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

## Related Skills

- [swap-integration](../swap-integration/SKILL.md) — Full Uniswap swap
  integration reference (Trading API, Universal Router, Permit2)
