# Trading API Flows

Step-by-step bash scripts for swap and bridge operations using the
Uniswap Trading API (`https://trade-api.gateway.uniswap.org/v1`).

## Table of Contents

- [Phase 4A — Swap on Source Chain](#phase-4a--swap-on-source-chain)
- [Phase 4B — Bridge to Tempo](#phase-4b--bridge-to-tempo)

## Phase 4A — Swap on Source Chain

Use the Uniswap Trading API to swap the source token to USDC (the bridge
asset). This is an EXACT_OUTPUT swap — the payee's amount determines how much
USDC to acquire.

**Variable Setup** (fill these before running any steps):

```bash
SOURCE_CHAIN_ID=8453              # Chain where you hold the source token (e.g. Base = 8453)
TOKEN_IN_ADDRESS="0x..."          # Address of your source token on SOURCE_CHAIN_ID
# For native ETH, use the zero address (recommended — returns permitData: null,
# no Permit2 signing needed):
#   0x0000000000000000000000000000000000000000
# The Universal Router wraps ETH before the swap, so msg.value (SWAP_VALUE) will be
# non-zero in the swap response.
#
# Fallback: if the zero address returns a 400, try the WETH address for your chain:
#   Base (8453):     0x4200000000000000000000000000000000000006
#   Ethereum (1):    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
# WETH may return non-null permitData requiring Permit2 signing (Step 4A-2.5).
USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base (8453)
# For Ethereum (1): USDC_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
# See Key Addresses section in SKILL.md for other chains.
CAST_ACCOUNT="uniswap-demo"      # Name of your cast keystore account (see Keystore Setup above)
CAST_PASSWORD=""                  # Keystore password (empty string if none)
SOURCE_RPC_URL="https://mainnet.base.org"  # RPC URL for SOURCE_CHAIN_ID
# For Ethereum (1): SOURCE_RPC_URL="https://eth.llamarpc.com"
REQUIRED_AMOUNT_IN="0"            # Use "0" for the initial approval check (Step 4A-1);
                                  # replace with the actual amountIn after Step 4A-2 (quote)
USDC_E_AMOUNT_NEEDED="$REQUIRED_AMOUNT"  # For EXACT_OUTPUT: target = payment amount
# Apply a 0.5% buffer to account for bridge fees:
# USDC_E_AMOUNT_NEEDED=$(echo "$REQUIRED_AMOUNT * 1005 / 1000" | bc)
# This ensures sufficient USDC arrives after any fee deductions.
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

### Keystore Setup (recommended)

Encrypted keystores avoid exposing raw private keys on the command line.
Create one with `cast wallet import`:

```bash
cast wallet import <ACCOUNT_NAME> --interactive
# Prompts for private key and password. Stores encrypted keystore in ~/.foundry/keystores/
```

All `cast send` examples below use `--account <ACCOUNT_NAME> --password <PW>`.
If you prefer raw keys, substitute `--account ... --password ...` with
`--private-key "$PRIVATE_KEY"` (some environments block this via hooks).

### Hex-to-Decimal Conversion

The Trading API returns hex values (e.g. `swap.value`), but `cast send --value`
requires decimal (wei). Convert with:

```bash
hex_to_dec() { python3 -c "print(int('$1', 16))"; }
# Usage: cast send <TO> <CALLDATA> --value "$(hex_to_dec "$SWAP_VALUE_HEX")"
```

### Step 4A-1 — Check approval

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

### Step 4A-2 — Get exact-output quote for native USDC (bridge asset)

> **Address note:** `USDC_ADDRESS` in the code below refers to the bridge
> asset for the source chain. For Base (chain 8453), use native USDC:
> `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. For Ethereum (chain 1), use
> USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. See Key Addresses section.

```bash
# Build the request body safely using jq. Chain IDs are integers; addresses
# and amounts are strings.
QUOTE_BODY=$(jq -n \
  --arg swapper "$WALLET_ADDRESS" \
  --arg tokenIn "$TOKEN_IN_ADDRESS" \
  --arg tokenOut "$USDC_ADDRESS" \
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
>
> **Quote expiration:** Quotes are valid for approximately **60 seconds**. Do not
> delay between fetching the quote and broadcasting the swap. If user confirmation
> or other steps take longer, re-fetch the quote immediately before calling `/swap`.
> A stale quote will return empty `swap.data` from the `/swap` endpoint.

### Step 4A-2.5 — Sign the permitData

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

### Step 4A-3 — Execute the swap

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

# Broadcast via cast
# Convert hex value to decimal (cast --value requires decimal wei)
SWAP_VALUE_DEC=$(hex_to_dec "$SWAP_VALUE")

SWAP_TX=$(cast send "$SWAP_TO" "$SWAP_DATA" \
  --value "$SWAP_VALUE_DEC" \
  --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
  --rpc-url "$SOURCE_RPC_URL" \
  --json | jq -r '.transactionHash')

# Wait for the swap to mine before bridging — a reverted swap leaves USDC at zero
SWAP_STATUS=$(cast receipt "$SWAP_TX" --rpc-url "$SOURCE_RPC_URL" --json | jq -r '.status')
[ "$SWAP_STATUS" = "0x1" ] || { echo "ERROR: Swap reverted (status=$SWAP_STATUS). Do not proceed to bridge." && exit 1; }
echo "Swap confirmed: $SWAP_TX"

# Verify USDC balance landed before proceeding to Phase 4B
USDC_AFTER_SWAP=$(cast call "$USDC_ADDRESS" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url "$SOURCE_RPC_URL")
# Format balances for human-readable display (USDC = 6 decimals)
USDC_DECIMALS=$(get_token_decimals "$USDC_ADDRESS" "$SOURCE_RPC_URL")
USDC_AFTER_HUMAN=$(format_token_amount "$USDC_AFTER_SWAP" "$USDC_DECIMALS")
USDC_NEEDED_HUMAN=$(format_token_amount "$USDC_E_AMOUNT_NEEDED" "$USDC_DECIMALS")
echo "USDC balance after swap: $USDC_AFTER_HUMAN USDC (need at least $USDC_NEEDED_HUMAN USDC)"
# Halt if swap produced insufficient USDC — bridging 0 USDC wastes gas and fails silently
[ "$USDC_AFTER_SWAP" -lt "$USDC_E_AMOUNT_NEEDED" ] && \
  echo "ERROR: swap produced $USDC_AFTER_HUMAN USDC but $USDC_NEEDED_HUMAN USDC needed — check receipt, do NOT proceed to bridge." && exit 1
```

## Phase 4B — Bridge to Tempo

> **If you skipped Phase 4A** (you already hold native USDC on Base), initialize
> these variables before proceeding:
>
> ```bash
> USDC_E_AMOUNT_NEEDED="$REQUIRED_AMOUNT"
> USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base
> ```

Use the Uniswap Trading API to bridge USDC from Base to USDC.e on Tempo. The
bridge is powered by Across Protocol and is fully abstracted by the API —
no manual contract calls required.

**Bridge asset addresses:**

| Chain                 | Asset       | Address                                      |
| --------------------- | ----------- | -------------------------------------------- |
| Base (8453) — in      | Native USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Ethereum (1) — in     | USDC        | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Arbitrum (42161) — in | USDC.e      | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` |
| Tempo (4217) — out    | USDC.e      | `0x20C000000000000000000000b9537d11c60E8b50` |

> **Source chain selection**: Check balances on all supported chains. Prefer the
> chain with the lowest total cost (swap gas + bridge gas). Base has the cheapest
> bridge gas (~$0.001), Ethereum is more expensive (~$0.25) but may be the only
> chain where you hold assets.

### Step 4B-1 — Check approval

```bash
BRIDGE_TOKEN_IN="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"   # USDC on Base
BRIDGE_TOKEN_OUT="0x20C000000000000000000000b9537d11c60E8b50"   # USDC.e on Tempo
BRIDGE_AMOUNT="$USDC_E_AMOUNT_NEEDED"

APPROVAL=$(curl -s "https://trade-api.gateway.uniswap.org/v1/check_approval" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  --data "$(jq -n \
    --arg token         "$BRIDGE_TOKEN_IN" \
    --arg amount        "$BRIDGE_AMOUNT" \
    --arg walletAddress "$WALLET_ADDRESS" \
    --argjson chainId "$SOURCE_CHAIN_ID" \
    '{token: $token, amount: $amount, walletAddress: $walletAddress, chainId: $chainId}')")

APPROVAL_TX=$(echo "$APPROVAL" | jq -r '.approval // empty')
echo "Approval needed: $([ -n "$APPROVAL_TX" ] && echo yes || echo no)"
```

> **REQUIRED:** If `APPROVAL_TX` is non-empty, use `AskUserQuestion` to show the
> user the approval details (token: `$BRIDGE_TOKEN_IN`, spender, amount:
> `$BRIDGE_AMOUNT`, estimated gas) and obtain explicit confirmation before
> submitting the approval transaction.

If confirmed and `APPROVAL_TX` is non-empty:

```bash
APPROVAL_TO=$(echo "$APPROVAL_TX"   | jq -r '.to')
APPROVAL_DATA=$(echo "$APPROVAL_TX" | jq -r '.data')
APPROVE_HASH=$(cast send "$APPROVAL_TO" "$APPROVAL_DATA" \
  --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
  --rpc-url "$SOURCE_RPC_URL" \
  --json | jq -r '.transactionHash')
cast receipt "$APPROVE_HASH" --rpc-url "$SOURCE_RPC_URL" > /dev/null
echo "Approval confirmed: $APPROVE_HASH"
```

> **Known issue:** The Trading API's `check_approval` may not cover the actual
> bridge spender contract. If `check_approval` returns `null` but the bridge
> reverts with "transfer amount exceeds allowance", run this on-chain check:
>
> ```bash
> # Extract bridge spender from the /swap response (the contract the bridge calls transferFrom on)
> # If you don't know the spender yet, get the bridge quote first (Step 4B-2), then
> # call /swap to get the target address, and check allowance against it.
> BRIDGE_SPENDER="$BRIDGE_TO"  # The 'to' field from the /swap response
> ALLOWANCE=$(cast call "$BRIDGE_TOKEN_IN" \
>   "allowance(address,address)(uint256)" "$WALLET_ADDRESS" "$BRIDGE_SPENDER" \
>   --rpc-url "$SOURCE_RPC_URL")
> if [ "$ALLOWANCE" -lt "$BRIDGE_AMOUNT" ]; then
>   echo "Insufficient allowance for bridge spender. Approving..."
>   cast send "$BRIDGE_TOKEN_IN" \
>     "approve(address,uint256)" "$BRIDGE_SPENDER" \
>     "115792089237316195423570985008687907853269984665640564039457584007913129639935" \
>     --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
>     --rpc-url "$SOURCE_RPC_URL" --json | jq -r '.transactionHash'
> fi
> ```

### Step 4B-2 — Get bridge quote (EXACT_OUTPUT)

```bash
BRIDGE_QUOTE=$(curl -s "https://trade-api.gateway.uniswap.org/v1/quote" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  --data "$(jq -n \
    --arg tokenIn        "$BRIDGE_TOKEN_IN" \
    --arg tokenInChainId "$SOURCE_CHAIN_ID" \
    --arg tokenOut       "$BRIDGE_TOKEN_OUT" \
    --arg tokenOutChainId "4217" \
    --arg amount         "$BRIDGE_AMOUNT" \
    --arg swapper        "$WALLET_ADDRESS" \
    '{
       tokenIn:         $tokenIn,
       tokenInChainId:  $tokenInChainId,
       tokenOut:        $tokenOut,
       tokenOutChainId: $tokenOutChainId,
       amount:          $amount,
       swapper:         $swapper,
       type:            "EXACT_OUTPUT"
     }')")

BRIDGE_QUOTE_ID=$(echo "$BRIDGE_QUOTE" | jq -r '.quote.quoteId')
BRIDGE_FEE=$(echo "$BRIDGE_QUOTE"      | jq -r '.quote.bridgeFee // .quote.gasFee // "unknown"')
BRIDGE_ETA=$(echo "$BRIDGE_QUOTE"      | jq -r '.quote.estimatedFillTime // "2-5 minutes"')
echo "Bridge quote: quoteId=$BRIDGE_QUOTE_ID fee=$BRIDGE_FEE eta=$BRIDGE_ETA"
```

> **REQUIRED:** Use `AskUserQuestion` before submitting the bridge transaction.
> Show the user:
>
> - Amount: `$(format_token_amount "$BRIDGE_AMOUNT" "$USDC_DECIMALS")` USDC on Base (chain 8453)
> - Destination: `$BRIDGE_TOKEN_OUT` (USDC.e) on Tempo (chain 4217)
> - Bridge fee: `$BRIDGE_FEE`
> - Estimated time: `$BRIDGE_ETA`
> - Recipient: `$WALLET_ADDRESS`
>
> Do not proceed until the user confirms.
>
> **Quote expiration:** Bridge quotes also expire after ~60 seconds. Re-fetch the
> quote (Step 4B-2) if there was any delay before executing.

### Step 4B-3 — Execute the bridge

```bash
BRIDGE_RESPONSE=$(curl -s "https://trade-api.gateway.uniswap.org/v1/swap" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  --data "$(jq -n \
    --argjson quote  "$BRIDGE_QUOTE" \
    --arg walletAddress "$WALLET_ADDRESS" \
    '{quote: $quote.quote, walletAddress: $walletAddress}')")

BRIDGE_TO=$(echo "$BRIDGE_RESPONSE"   | jq -r '.swap.to')
BRIDGE_DATA=$(echo "$BRIDGE_RESPONSE" | jq -r '.swap.data')
BRIDGE_VALUE=$(echo "$BRIDGE_RESPONSE"| jq -r '.swap.value // "0"')

# Convert hex value to decimal
BRIDGE_VALUE_DEC=$(hex_to_dec "$BRIDGE_VALUE")

BRIDGE_TX=$(cast send "$BRIDGE_TO" "$BRIDGE_DATA" \
  --value "$BRIDGE_VALUE_DEC" \
  --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
  --rpc-url "$SOURCE_RPC_URL" \
  --json | jq -r '.transactionHash')

BRIDGE_STATUS=$(cast receipt "$BRIDGE_TX" --rpc-url "$SOURCE_RPC_URL" --json | jq -r '.status')
[ "$BRIDGE_STATUS" = "0x1" ] || { echo "ERROR: Bridge tx reverted. Do not proceed."; exit 1; }
echo "Bridge submitted: $BRIDGE_TX — waiting for funds on Tempo..."
```

### Step 4B-4 — Poll for arrival on Tempo

Poll for USDC.e balance on Tempo every 30 seconds for up to 10 minutes:

```bash
TEMPO_RPC_URL="https://rpc.presto.tempo.xyz"
for i in $(seq 1 20); do
  USDC_E_ON_TEMPO=$(cast call "$BRIDGE_TOKEN_OUT" \
    "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
    --rpc-url "$TEMPO_RPC_URL" 2>/dev/null || echo "0")
  if [ "$USDC_E_ON_TEMPO" -ge "$BRIDGE_AMOUNT" ]; then
    USDC_E_DECIMALS=$(get_token_decimals "$BRIDGE_TOKEN_OUT" "$TEMPO_RPC_URL")
    USDC_E_HUMAN=$(format_token_amount "$USDC_E_ON_TEMPO" "$USDC_E_DECIMALS")
    echo "Bridge confirmed — $USDC_E_HUMAN USDC.e received on Tempo."
    break
  fi
  USDC_E_POLL_HUMAN=$(format_token_amount "$USDC_E_ON_TEMPO" "$(get_token_decimals "$BRIDGE_TOKEN_OUT" "$TEMPO_RPC_URL")")
  echo "Waiting for bridge arrival... attempt $i/20 (balance: $USDC_E_POLL_HUMAN USDC.e)"
  sleep 30
done
[ "$USDC_E_ON_TEMPO" -ge "$BRIDGE_AMOUNT" ] || \
  { echo "Bridge not confirmed after 10 minutes. Check $BRIDGE_TX on https://explore.mainnet.tempo.xyz"; exit 1; }
```

After a successful bridge, you hold **USDC.e** (`$BRIDGE_TOKEN_OUT`) on Tempo.
Use this as `TOKEN_IN` in Phase 5 to swap to the required payment token.

> **Do not re-submit** if the poll times out — duplicate bridge deposits result
> in double payment. Have the user check the transaction on the Tempo explorer.

### Step 4B-5 — Transfer USDC.e to Tempo wallet (if needed)

The Trading API bridges to `WALLET_ADDRESS` on Tempo. If `WALLET_ADDRESS`
differs from `TEMPO_WALLET_ADDRESS` (the Tempo CLI wallet), transfer the
USDC.e so the Tempo CLI can use it to pay the 402.

```bash
if [ "$WALLET_ADDRESS" != "$TEMPO_WALLET_ADDRESS" ]; then
  TRANSFER_DATA=$(cast calldata "transfer(address,uint256)" "$TEMPO_WALLET_ADDRESS" "$BRIDGE_AMOUNT")

  # Show transfer details before sending
  USDC_E_HUMAN=$(format_token_amount "$BRIDGE_AMOUNT" "6")
  # (AskUserQuestion gate handled by the caller — confirm amount + destination before this step)

  TRANSFER_TX=$(cast send "$BRIDGE_TOKEN_OUT" "$TRANSFER_DATA" \
    --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
    --rpc-url "$TEMPO_RPC_URL" \
    --json | jq -r '.transactionHash')

  TRANSFER_STATUS=$(cast receipt "$TRANSFER_TX" --rpc-url "$TEMPO_RPC_URL" --json | jq -r '.status')
  [ "$TRANSFER_STATUS" = "0x1" ] || { echo "ERROR: Transfer to Tempo wallet reverted: $TRANSFER_TX"; exit 1; }
  echo "USDC.e transferred to Tempo wallet ($TEMPO_WALLET_ADDRESS): $TRANSFER_TX"
fi
```

After this step, `TEMPO_WALLET_ADDRESS` holds the required USDC.e and the
Tempo CLI can retry the original `tempo request` to pay the 402.

---

## Future Optimization: Single Cross-Chain Swap

A single cross-chain quote (e.g. ETH on Ethereum → USDC.e on Tempo) would
collapse the 3-transaction flow (swap + bridge + transfer) into one. As of
March 2026, the Trading API returns "No quotes available" for direct
cross-chain swaps to Tempo (chain 4217). Monitor the Trading API changelog
for cross-chain swap support to Tempo — when available, it eliminates Phase 4A
and Step 4B-5 entirely.
