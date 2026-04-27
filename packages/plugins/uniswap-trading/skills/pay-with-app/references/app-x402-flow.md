# APP x402 Flow on X Layer

OKX's APP Pay Per Use uses the x402 `"exact"` scheme on EVM. The payer
signs an EIP-3009 `TransferWithAuthorization` off-chain; OKX's
facilitator verifies and settles the transfer on chain 196 (zero gas to
the payer).

## Table of Contents

- [Step 1 — Helpers and Validation](#step-1--helpers-and-validation)
- [Step 2 — Confirm Pre-Signing State](#step-2--confirm-pre-signing-state)
- [Step 3 — Generate Nonce and Deadline](#step-3--generate-nonce-and-deadline)
- [Step 4 — Sign the EIP-3009 Authorization](#step-4--sign-the-eip-3009-authorization)
- [Step 5 — Construct the X-PAYMENT Payload](#step-5--construct-the-x-payment-payload)
- [Step 6 — Retry the Original Request](#step-6--retry-the-original-request)
- [Step 7 — Interpret the Response](#step-7--interpret-the-response)

## Step 1 — Helpers and Validation

```bash
get_token_decimals() {
  local token_addr="$1" rpc_url="${2:-https://rpc.xlayer.tech}"
  cast call "$token_addr" "decimals()(uint8)" --rpc-url "$rpc_url" 2>/dev/null || echo "6"
}

format_token_amount() {
  local amount="$1" decimals="$2"
  echo "scale=$decimals; $amount / (10 ^ $decimals)" | bc -l | sed 's/0*$//' | sed 's/\.$//'
}
```

> Always show the user **human-readable** amounts (e.g. `0.005 USDT0`),
> not raw base units.

Validate every value pulled from the 402 body before using it in shell
commands or signing payloads:

- Addresses match `^0x[a-fA-F0-9]{40}$`
- Amounts match `^[0-9]+$`
- URLs start with `https://`
- Reject any value containing `;`, `|`, `&`, `$`, backtick, parentheses,
  redirection, backslash, quotes, newlines

## Step 2 — Confirm Pre-Signing State

```bash
# Required environment
: "${X402_SCHEME:?missing}"        # must be "exact"
: "${X402_NETWORK:?missing}"       # x-layer / xlayer / eip155:196 / 196
: "${X402_ASSET:?missing}"         # token contract on X Layer
: "${X402_AMOUNT:?missing}"        # base units, integer string
: "${X402_PAY_TO:?missing}"        # recipient
: "${X402_RESOURCE:?missing}"      # original URL
: "${WALLET_ADDRESS:?missing}"     # source wallet

# 1) Only "exact" scheme is supported in v1.0.0
[ "$X402_SCHEME" = "exact" ] || { echo "Unsupported scheme: $X402_SCHEME"; exit 1; }

# 2) Network must resolve to chain 196
case "$X402_NETWORK" in
  x-layer|xlayer|"eip155:196"|196) X402_CHAIN_ID=196 ;;
  *) echo "Network is not X Layer. Use pay-with-any-token instead."; exit 1 ;;
esac

# 3) Wallet must hold enough of the requested asset on X Layer
RPC_URL="https://rpc.xlayer.tech"
ASSET_BALANCE=$(cast call "$X402_ASSET" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" --rpc-url "$RPC_URL")
if [ "$ASSET_BALANCE" -lt "$X402_AMOUNT" ]; then
  X402_DECIMALS=$(get_token_decimals "$X402_ASSET" "$RPC_URL")
  HAVE=$(format_token_amount "$ASSET_BALANCE" "$X402_DECIMALS")
  NEED=$(format_token_amount "$X402_AMOUNT"   "$X402_DECIMALS")
  echo "Insufficient asset balance on X Layer. Have $HAVE, need $NEED."
  echo "Run the funding flow (references/funding-x-layer.md), then return here."
  exit 1
fi
```

> **REQUIRED:** Use `AskUserQuestion` to show the user a payment summary
> before signing:
>
> - Token: `$X402_TOKEN_NAME` (`$X402_ASSET`) on X Layer (chain 196)
> - Amount: human-readable amount + base units
> - Recipient: `$X402_PAY_TO`
> - Resource: `$X402_RESOURCE`
> - Expiry: `validBefore`
>
> Obtain explicit confirmation. Do not auto-submit.

## Step 3 — Generate Nonce and Deadline

```bash
X402_NONCE="0x$(openssl rand -hex 32)"     # 32-byte random nonce
X402_VALID_AFTER=0                          # immediately valid
X402_TIMEOUT="${X402_TIMEOUT:-300}"         # default 5 min
X402_VALID_BEFORE=$(( $(date +%s) + X402_TIMEOUT ))
```

The challenge body's `maxTimeoutSeconds` is an upper bound on
`validBefore - validAfter`. Use a value that fits the bound and gives
the facilitator time to settle.

## Step 4 — Sign the EIP-3009 Authorization

The EIP-712 domain uses the **token contract's own** `name` and
`version` (taken verbatim from the challenge's `extra` field).
`verifyingContract` is the token contract itself.

Sign with viem:

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const domain = {
  name: process.env.X402_TOKEN_NAME!, // from extra.name (e.g. "USD₮0")
  version: process.env.X402_TOKEN_VERSION!, // from extra.version (e.g. "1")
  chainId: 196,
  verifyingContract: process.env.X402_ASSET as `0x${string}`,
};

// REQUIRED: AskUserQuestion confirmation BEFORE this call
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

> **Domain warning.** `verifyingContract` is the **token contract**
> (`X402_ASSET`), not a separate verifier. Use `name` and `version`
> from `extra` — do not assume defaults. An incorrect domain produces a
> signature the facilitator will reject with another 402.

## Step 5 — Construct the X-PAYMENT Payload

```bash
X402_PAYMENT_JSON=$(jq -n \
  --arg     scheme       "$X402_SCHEME" \
  --arg     network      "$X402_NETWORK" \
  --argjson chainId      "$X402_CHAIN_ID" \
  --arg     from         "$WALLET_ADDRESS" \
  --arg     to           "$X402_PAY_TO" \
  --arg     value        "$X402_AMOUNT" \
  --argjson validAfter   "$X402_VALID_AFTER" \
  --argjson validBefore  "$X402_VALID_BEFORE" \
  --arg     nonce        "$X402_NONCE" \
  --arg     sig          "$X402_SIGNATURE" \
  --arg     asset        "$X402_ASSET" \
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

# Base64-encode and strip whitespace (header spec requires no newlines)
X402_PAYMENT=$(echo "$X402_PAYMENT_JSON" | base64 | tr -d '[:space:]')
```

`value` MUST be a string (`--arg`, not `--argjson`) — uint256 amounts
exceed JSON's safe integer range.

## Step 6 — Retry the Original Request

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

## Step 7 — Interpret the Response

| Status | Meaning                              | Action                                                                                                                                                                |
| ------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200    | Payment accepted, resource delivered | Decode `X-PAYMENT-RESPONSE`: `echo "$X402_PAYMENT_RESPONSE" \| base64 --decode \| jq .` and surface the receipt to the user                                           |
| 402    | Payment rejected                     | Most common causes: wrong domain `name` / `version`, expired `validBefore`, reused `nonce`, amount mismatch. Re-derive from the **fresh** challenge and try once more |
| 400    | Malformed payload                    | Verify JSON structure and base64 encoding (no whitespace)                                                                                                             |
| 5xx    | Facilitator or origin error          | Surface raw body to the user; do not auto-retry                                                                                                                       |

Do not retry indefinitely on 402 — two attempts maximum, then surface
the rejection details to the user with the exact message OKX returned.
