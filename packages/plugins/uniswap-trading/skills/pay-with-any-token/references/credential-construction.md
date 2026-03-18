# Credential Construction

MPP and x402 credential building, signing, and submission flows.

## Table of Contents

- [Phase 6 — MPP Credential](#phase-6--mpp-credential)
- [Phase 6x — x402 Payment](#phase-6x--x402-payment)

## Phase 6 — MPP Credential

> **x402 path — STOP HERE.** If you arrived via the x402 detection gate in
> Phase 0, do not proceed with Phase 6. Phase 6 constructs an MPP credential;
> x402 payments use a different payload format handled in **Phase 6x** below.

With the required token in the wallet, fulfill the MPP challenge using the
**mppx** SDK, which handles the full 402 challenge -> credential -> retry cycle.

**Install:**

```bash
npm install mppx viem
```

### Charge intent — automatic mode

Polyfills `fetch` to intercept 402 responses automatically:

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

### Charge intent — manual mode

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

### Session intent

Pass a `maxDeposit` budget to `tempo()` to open a payment channel:

```typescript
// maxDeposit: '10' locks up to 10 pathUSD into the channel escrow
const mppx = Mppx.create({ methods: [tempo({ account, maxDeposit: '10' })] });
const response = await mppx.fetch(process.env.RESOURCE_URL!);
// The SDK manages channel lifecycle and voucher signing automatically
```

For fine-grained session control (manual open/close, sweep), see
`https://mpp.dev/sdk`.

### Direct submission

If the credential was built externally:

```bash
# $CREDENTIAL is the base64url-encoded credential string from mppx.createCredential()
# $RESOURCE_URL was set in Phase 0
curl -si "$RESOURCE_URL" \
  -H "Authorization: Payment $CREDENTIAL"
```

A `200` response with a `Payment-Receipt` header confirms success. Any other
status means the credential was rejected — check the response body and
re-inspect the challenge.

## Phase 6x — x402 Payment

> **x402 path only.** This phase is reached when `PROTOCOL` is `"x402"`
> (detected in Phase 0). Do not enter this phase from the MPP path.

The x402 `"exact"` scheme on EVM networks uses **EIP-3009**
(`transferWithAuthorization`) to authorize a one-time token transfer. The payer
signs an off-chain typed-data message; the facilitator verifies it and settles
the token transfer on-chain — no separate on-chain approval step is required.

### Prerequisite checks before signing

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

# Tempo-network: if wallet lacks the asset on Tempo, bridge first (Phase 4B -> 5 -> return here)
if [ "$X402_CHAIN_ID" = "4217" ]; then
  echo "x402 payment targets Tempo network — checking Tempo-side balance..."
  TEMPO_BALANCE=$(cast call "$X402_ASSET" \
    "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
    --rpc-url "$SOURCE_RPC_URL" 2>/dev/null || echo "0")
  if [ "$TEMPO_BALANCE" -lt "$X402_AMOUNT" ]; then
    X402_DECIMALS=$(get_token_decimals "$X402_ASSET" "$SOURCE_RPC_URL")
    TEMPO_BAL_HUMAN=$(format_token_amount "$TEMPO_BALANCE" "$X402_DECIMALS")
    X402_AMT_HUMAN=$(format_token_amount "$X402_AMOUNT" "$X402_DECIMALS")
    echo "Insufficient balance on Tempo ($TEMPO_BAL_HUMAN < $X402_AMT_HUMAN $X402_TOKEN_NAME)."
    echo "Acquire the asset first: run Phase 4A (swap to bridge asset) ->"
    echo "Phase 4B (bridge to Tempo) -> Phase 5, then return to Phase 6x."
    exit 1
  fi
fi

# 3. Check wallet token balance — must be >= X402_AMOUNT before signing
ASSET_BALANCE=$(cast call "$X402_ASSET" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url "$SOURCE_RPC_URL")
if [ "$ASSET_BALANCE" -lt "$X402_AMOUNT" ]; then
  X402_DECIMALS=${X402_DECIMALS:-$(get_token_decimals "$X402_ASSET" "$SOURCE_RPC_URL")}
  ASSET_BAL_HUMAN=$(format_token_amount "$ASSET_BALANCE" "$X402_DECIMALS")
  X402_AMT_HUMAN=$(format_token_amount "$X402_AMOUNT" "$X402_DECIMALS")
  echo "ERROR: Insufficient $X402_TOKEN_NAME balance on $X402_NETWORK."
  echo "Have: $ASSET_BAL_HUMAN $X402_TOKEN_NAME, need: $X402_AMT_HUMAN $X402_TOKEN_NAME"
  echo "Acquire the asset first: if funds are on the same chain, run Phase 4A"
  echo "(swap to $X402_ASSET). If funds are on a different chain, run"
  echo "Phase 4A + Phase 4B (bridge to $X402_NETWORK) + Phase 5, then return here."
  exit 1
fi
```

> **REQUIRED:** Use `AskUserQuestion` to show the user a payment summary before
> signing anything:
>
> - Token: `$X402_TOKEN_NAME` (`$X402_ASSET`) on `$X402_NETWORK`
> - Amount: `$(format_token_amount "$X402_AMOUNT" "$(get_token_decimals "$X402_ASSET" "$SOURCE_RPC_URL")")` `$X402_TOKEN_NAME`
> - Recipient: `$X402_PAY_TO`
> - Resource: `$X402_RESOURCE`
>
> Obtain explicit confirmation before proceeding.

### Step 6x-1 — Generate nonce and deadline

```bash
X402_NONCE="0x$(openssl rand -hex 32)"    # 32-byte random nonce
X402_VALID_AFTER=0                         # immediately valid
X402_VALID_BEFORE=$(( $(date +%s) + X402_TIMEOUT ))  # expiry = now + maxTimeoutSeconds
```

### Step 6x-2 — Sign the EIP-3009 `TransferWithAuthorization` typed data

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

> **Domain warning:** The `verifyingContract` is the **token contract**
> (`X402_ASSET`), not a separate verifier. Use the `name` and `version` from
> `extra` — do not assume USDC defaults. Different tokens have different domain
> values. An incorrect domain produces a signature the server will reject
> with a 402.
>
> **REQUIRED:** Use `AskUserQuestion` before this step. Show the
> `TransferWithAuthorization` message fields (from, to, value, validBefore)
> so the user can verify what they are signing. Store the resulting signature as
> `X402_SIGNATURE`.

### Step 6x-3 — Construct the X-PAYMENT payload

```bash
X402_PAYMENT_JSON=$(jq -n \
  --arg  scheme      "$X402_SCHEME" \
  --arg  network     "$X402_NETWORK" \
  --argjson chainId  "$X402_CHAIN_ID" \
  --arg  from        "$WALLET_ADDRESS" \
  --arg  to          "$X402_PAY_TO" \
  --arg    value     "$X402_AMOUNT" \
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

### Step 6x-4 — Retry the original request with `X-PAYMENT` header

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

### Interpreting the response

| Status | Meaning                                                 | Action                                                                                       |
| ------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 200    | Payment accepted — resource delivered                   | Display body; decode receipt with `echo "$X402_PAYMENT_RESPONSE" \| base64 --decode \| jq .` |
| 402    | Payment rejected (bad signature, expired, wrong amount) | Check domain name/version, validBefore, and amount                                           |
| 400    | Malformed payment payload                               | Verify JSON structure and base64 encoding                                                    |
| Other  | Server or network error                                 | Report raw body; do not resubmit                                                             |

**Tempo-network variant:** If `X402_NETWORK` is `"tempo"` (or
`eip155:<tempo-chain-id>`), the payment token is a Tempo TIP-20 address. You
must first bridge USDC to Tempo using Phase 4B and optionally swap using Phase 5.
After confirming the Tempo-side token balance, return here to execute Steps 6x-1
through 6x-4, using the Tempo-side token contract as `X402_ASSET` and the Tempo
chain ID as `X402_CHAIN_ID`.
