# APP x402 Flow on X Layer

OKX's APP Pay Per Use uses the x402 `"exact"` scheme on EVM. The payer
signs an EIP-3009 `TransferWithAuthorization` off-chain. OKX's
facilitator verifies and settles the transfer on chain 196 (zero gas to
the payer).

## Table of Contents

- [Step 0: Prerequisites](#step-0-prerequisites)
- [Step 1: Helpers and Validation](#step-1-helpers-and-validation)
- [Step 2: Confirm Pre-Signing State](#step-2-confirm-pre-signing-state)
- [Step 3: Generate Nonce and Deadline](#step-3-generate-nonce-and-deadline)
- [Step 3.5: User Confirmation Gate](#step-35-user-confirmation-gate)
- [Step 4: Sign the EIP-3009 Authorization](#step-4-sign-the-eip-3009-authorization)
- [Step 5: Construct the X-PAYMENT Payload](#step-5-construct-the-x-payment-payload)
- [Step 6: Retry the Original Request](#step-6-retry-the-original-request)
- [Step 7: Interpret the Response](#step-7-interpret-the-response)

## Step 0: Prerequisites

Before running any block in this document, assert required CLI tools are
installed. `bc` is needed for human-readable amount formatting and is
not preinstalled on every macOS:

```bash
set -euo pipefail
command -v cast    >/dev/null || { echo "cast required (foundry)"            >&2; exit 1; }
command -v jq      >/dev/null || { echo "jq required"                         >&2; exit 1; }
command -v bc      >/dev/null || { echo "bc required (brew install bc)"       >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl required"                    >&2; exit 1; }
command -v curl    >/dev/null || { echo "curl required"                       >&2; exit 1; }
```

The X Layer RPC URL is overridable for rate-limiting or failover:

```bash
RPC_URL="${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}"
```

## Step 1: Helpers and Validation

```bash
set -euo pipefail

get_token_decimals() {
  local token_addr="$1" rpc_url="${2:-${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}}"
  local out
  out=$(cast call "$token_addr" "decimals()(uint8)" --rpc-url "$rpc_url") || {
    echo "ERROR: decimals() call failed for $token_addr on $rpc_url" >&2
    return 1
  }
  [[ "$out" =~ ^[0-9]+$ ]] || {
    echo "ERROR: non-numeric decimals returned: $out" >&2
    return 1
  }
  echo "$out"
}

format_token_amount() {
  local amount="$1" decimals="$2"
  local result
  result=$(echo "scale=$decimals; $amount / (10 ^ $decimals)" | bc -l | sed 's/0*$//' | sed 's/\.$//')
  [ -z "$result" ] && result="0"
  echo "$result"
}
```

> Always show the user **human-readable** amounts (e.g. `0.005 USDT0`),
> not raw base units. `get_token_decimals` fails loudly on RPC error.
> Never default to `6`: a wrong decimals value silently misleads the
> user-facing confirmation gate. Every call site MUST check the exit
> code: `X402_DECIMALS=$(get_token_decimals "$X402_ASSET" "$RPC_URL") || exit 1`.

Validate every value pulled from the 402 body before using it in shell
commands or signing payloads. The block in Step 2 below enforces these
as hard gates, not advisory notes:

- Addresses match `^0x[a-fA-F0-9]{40}$`
- Amounts match `^[0-9]+$`
- URLs start with `https://`
- Nonce matches `^0x[a-fA-F0-9]{64}$`
- Reject any value containing `;`, `|`, `&`, `$`, backtick, parentheses,
  redirection, backslash, quotes, newlines

## Step 2: Confirm Pre-Signing State

```bash
set -euo pipefail

# Required environment
: "${X402_SCHEME:?missing}"        # must be "exact"
: "${X402_NETWORK:?missing}"       # x-layer / xlayer / eip155:196 / 196
: "${X402_ASSET:?missing}"         # token contract on X Layer
: "${X402_AMOUNT:?missing}"        # base units, integer string
: "${X402_PAY_TO:?missing}"        # recipient
: "${X402_RESOURCE:?missing}"      # original URL (or accepts[].resource override)
: "${WALLET_ADDRESS:?missing}"     # source wallet

# 0) Hard input-validation gates (no advisory notes; enforced)
[[ "$X402_ASSET"     =~ ^0x[a-fA-F0-9]{40}$       ]] || { echo "bad asset address"     >&2; exit 1; }
[[ "$X402_PAY_TO"    =~ ^0x[a-fA-F0-9]{40}$       ]] || { echo "bad payTo address"     >&2; exit 1; }
[[ "$WALLET_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$       ]] || { echo "bad wallet address"    >&2; exit 1; }
[[ "$X402_AMOUNT"    =~ ^[0-9]+$                  ]] || { echo "bad amount"            >&2; exit 1; }
[[ "$X402_RESOURCE"  =~ ^https://[A-Za-z0-9._~:/?\#@%=+,\&\;-]+$ ]] || { echo "bad resource URL" >&2; exit 1; }
# Reject shell metacharacters that the bracket class above already excludes.
# Legitimate URLs encode dangerous characters as %XX, so the strict bracket
# class is sufficient; assert explicitly so future edits to the bracket class
# do not silently weaken the gate.
case "$X402_RESOURCE" in
  *\`*|*\\*|*\"*|*\'*|*\;*|*\|*|*\&*|*\$*|*\(*|*\)*|*\<*|*\>*|*\**|*\!*|*$'\n'*)
    echo "bad resource URL: contains shell metacharacter" >&2; exit 1 ;;
esac

# Note: $X402_RESOURCE should be set from accepts[selected].resource if the 402 challenge
# provides one (it can override the original request URL for proxied or redirected
# resources); fall back to the originally requested URL only if accepts[].resource is absent.
# If accepts[selected].resource's host differs from the host of the originally-requested
# URL, surface the mismatch to the user and require explicit confirmation before
# continuing. A facilitator-mediated redirect is legitimate but should not be silent.
if [ -n "${ORIGINAL_REQUEST_URL:-}" ]; then
  # Strip userinfo (user:pass@) and port (:NNNN) before comparing so that
  # equivalent hosts don't trip the gate.
  strip_host() {
    echo "$1" | awk -F/ '{print $3}' | sed -E 's/^[^@]+@//' | sed -E 's/:[0-9]+$//'
  }
  RESOURCE_HOST=$(strip_host "$X402_RESOURCE")
  ORIGINAL_HOST=$(strip_host "$ORIGINAL_REQUEST_URL")
  [ -n "$RESOURCE_HOST" ] && [ -n "$ORIGINAL_HOST" ] || {
    echo "ERROR: could not parse host from URLs (resource=$X402_RESOURCE, original=$ORIGINAL_REQUEST_URL)" >&2
    exit 1
  }
  if [ "$RESOURCE_HOST" != "$ORIGINAL_HOST" ]; then
    if [ "${X402_HOST_MISMATCH_ACK:-}" != "yes" ]; then
      echo "ERROR: accepts[].resource host ($RESOURCE_HOST) differs from original request host ($ORIGINAL_HOST)." >&2
      echo "Surface this via AskUserQuestion. After explicit user confirmation, re-invoke with X402_HOST_MISMATCH_ACK=yes." >&2
      exit 1
    fi
  fi
fi

# 1) Only "exact" scheme is supported in v1.0.0
[ "$X402_SCHEME" = "exact" ] || { echo "Unsupported scheme: $X402_SCHEME" >&2; exit 1; }

# 2) Network must resolve to chain 196
case "$X402_NETWORK" in
  x-layer|xlayer|"eip155:196"|196) X402_CHAIN_ID=196 ;;
  *) echo "Network is not X Layer. Use pay-with-any-token instead." >&2; exit 1 ;;
esac

# 3) Wallet must hold enough of the requested asset on X Layer
RPC_URL="${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}"

ASSET_BALANCE=$(cast call "$X402_ASSET" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" --rpc-url "$RPC_URL") || {
  echo "ERROR: balanceOf call failed; check RPC connectivity" >&2; exit 1;
}
[[ "$ASSET_BALANCE" =~ ^[0-9]+$ ]] || {
  echo "ERROR: balanceOf returned non-integer: $ASSET_BALANCE" >&2; exit 1;
}

if [ "$ASSET_BALANCE" -lt "$X402_AMOUNT" ]; then
  X402_DECIMALS=$(get_token_decimals "$X402_ASSET" "$RPC_URL") || exit 1
  HAVE=$(format_token_amount "$ASSET_BALANCE" "$X402_DECIMALS")
  NEED=$(format_token_amount "$X402_AMOUNT"   "$X402_DECIMALS")
  echo "Insufficient asset balance on X Layer. Have $HAVE, need $NEED."
  echo "Run the funding flow (references/funding-x-layer.md), then return here."
  exit 1
fi

# When the funding flow runs, it captures SOURCE_TX_HASH from the Trading
# API /swap response. See funding-x-layer.md for the capture + validate
# pattern (jq with `// empty` fallback plus a 0x[a-fA-F0-9]{64} shape
# check); a literal "null" or empty string must fail the funding flow
# rather than propagating into this script.

# Capture 402 challenge freshness for the sign-time gate (see Step 4).
# Named CHALLENGE_FETCHED_AT to disambiguate from the Trading API "quote"
# concept used in funding-x-layer.md; here it refers to the 402 body itself.
CHALLENGE_FETCHED_AT=$(date +%s)
```

## Step 3: Generate Nonce and Deadline

```bash
set -euo pipefail

X402_NONCE="0x$(openssl rand -hex 32)"     # 32-byte random nonce

# Assert the nonce is the right shape. If openssl is missing or fails,
# command substitution can yield "0x" (empty), which signs against
# nonce: 0. First time works, second is a replay. Fail loud here.
[ ${#X402_NONCE} -eq 66 ] || { echo "openssl missing or failed: nonce length=${#X402_NONCE}" >&2; exit 1; }
[[ "$X402_NONCE" =~ ^0x[a-fA-F0-9]{64}$ ]] || { echo "bad nonce shape: $X402_NONCE" >&2; exit 1; }

X402_VALID_AFTER=0                          # immediately valid

# Default the requested timeout to 5 minutes if not provided by the challenge.
X402_TIMEOUT="${X402_TIMEOUT:-300}"

# `maxTimeoutSeconds` from the challenge body is an upper bound on
# (validBefore - validAfter). Default the ceiling to the requested
# timeout if the challenge omits it, then clamp.
X402_MAX_TIMEOUT="${X402_MAX_TIMEOUT:-$X402_TIMEOUT}"
if [ "$X402_TIMEOUT" -lt "$X402_MAX_TIMEOUT" ]; then
  X402_EFFECTIVE_TIMEOUT="$X402_TIMEOUT"
else
  X402_EFFECTIVE_TIMEOUT="$X402_MAX_TIMEOUT"
fi

X402_VALID_BEFORE=$(( $(date +%s) + X402_EFFECTIVE_TIMEOUT ))
```

The challenge body's `maxTimeoutSeconds` is an upper bound on
`validBefore - validAfter`. The clamp above keeps the request inside
the bound while leaving the facilitator time to settle.

## Step 3.5: User Confirmation Gate

This step is mandatory and not optional. Do not auto-submit. Use
`AskUserQuestion` (or the equivalent confirmation primitive in the host
agent) to surface a payment summary and obtain explicit yes/no consent
before signing:

- Token: `$X402_TOKEN_NAME` (`$X402_ASSET`) on X Layer (chain 196)
- Amount: human-readable amount + base units
- Recipient: `$X402_PAY_TO`
- Resource: `$X402_RESOURCE`
- Expiry: `validBefore` (UTC + epoch)
- Nonce (first 10 chars of `$X402_NONCE`, for traceability)

If the user declines, abort. If the user does not respond, abort. Do
not proceed to Step 4 without an affirmative answer in the transcript.

## Step 4: Sign the EIP-3009 Authorization

The EIP-712 domain uses the **token contract's own** `name` and
`version` (taken verbatim from the challenge's `extra` field).
`verifyingContract` is the token contract itself.

> **Unicode warning.** USDT0's domain `name` is `"USD₮0"` with the
> Unicode trademark sign `₮` (U+20AE), not an ASCII `T`. EIP-712 hashes
> the domain `name` as byte-exact UTF-8: pass it through unchanged from
> `extra.name`. Do not normalize. Do not substitute ASCII `T`. Any
> mutation produces a signature the facilitator will reject.

Freshness gate (refuse-to-sign-when-stale): a signed-but-stale
authorization burns a nonce on the facilitator side; refusing to sign
preserves the nonce. Run this gate **before** invoking `signTypedData`,
not after. The challenge body's prices and `accepts[]` parameters are
short-lived (the SKILL doc states roughly 60 seconds); 45 is a safe
ceiling that leaves margin:

```bash
set -euo pipefail

if [ $(($(date +%s) - CHALLENGE_FETCHED_AT)) -ge 45 ]; then
  echo "402 challenge is older than 45 seconds; refetch before signing." >&2
  exit 1
fi
```

Sign with viem:

```typescript
import { privateKeyToAccount } from 'viem/accounts';

// Validate every input before constructing the typed-data payload.
// `process.env.FOO!` casts hide undefined and empty-string bugs; an
// empty domain or message field produces a valid-looking signature
// the facilitator will reject, burning a fresh nonce.
function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || !v.trim()) {
    throw new Error(
      `${key} is unset or empty. Re-parse the corresponding field from the 402 challenge.`
    );
  }
  return v;
}

// Shape-validating wrappers: catch the case where a string is non-empty but
// the wrong shape (e.g. truncated address, scientific-notation amount). An
// empty-only check still produces a valid-looking signature the facilitator
// will reject, burning a fresh nonce.
function requireAddress(key: string): `0x${string}` {
  const v = requireEnv(key);
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) {
    throw new Error(`${key} is not a valid 0x address: ${v}`);
  }
  return v as `0x${string}`;
}
function requireUint(key: string): bigint {
  const v = requireEnv(key);
  if (!/^[0-9]+$/.test(v)) {
    throw new Error(`${key} is not a non-negative integer: ${v}`);
  }
  return BigInt(v);
}
function requireBytes32(key: string): `0x${string}` {
  const v = requireEnv(key);
  if (!/^0x[a-fA-F0-9]{64}$/.test(v)) {
    throw new Error(`${key} is not a 0x bytes32: ${v}`);
  }
  return v as `0x${string}`;
}
// Free-text fields (extra.name, extra.version) feed the EIP-712 domain
// bit-exact and may also be surfaced to the user. Per the SKILL.md
// Input Validation Rules, reject the whole challenge rather than
// mutating the value if it contains shell metacharacters.
function requireSafeText(key: string): string {
  const v = requireEnv(key);
  if (/[;|&$`()<>\\'"\n]/.test(v)) {
    throw new Error(
      `${key} contains shell metacharacters; reject the whole challenge per skill policy.`
    );
  }
  return v;
}

const privateKey = requireEnv('PRIVATE_KEY');
const tokenName = requireSafeText('X402_TOKEN_NAME'); // from extra.name (e.g. "USD₮0")
const tokenVersion = requireSafeText('X402_TOKEN_VERSION'); // from extra.version (e.g. "1")
const walletAddress = requireAddress('WALLET_ADDRESS');
const x402Asset = requireAddress('X402_ASSET');
const x402PayTo = requireAddress('X402_PAY_TO');
const x402Amount = requireUint('X402_AMOUNT');
const x402ValidAfter = requireUint('X402_VALID_AFTER');
const x402ValidBefore = requireUint('X402_VALID_BEFORE');
const x402Nonce = requireBytes32('X402_NONCE');

const account = privateKeyToAccount(privateKey as `0x${string}`);

const domain = {
  name: tokenName,
  version: tokenVersion,
  chainId: 196,
  verifyingContract: x402Asset,
};

// REQUIRED: AskUserQuestion confirmation already happened in Step 3.5.
// Do not reach this line without an affirmative user answer.
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
    from: walletAddress,
    to: x402PayTo,
    value: x402Amount,
    validAfter: x402ValidAfter,
    validBefore: x402ValidBefore,
    nonce: x402Nonce,
  },
});
process.env.X402_SIGNATURE = signature;
```

> **Domain warning.** `verifyingContract` is the **token contract**
> (`X402_ASSET`), not a separate verifier. Use `name` and `version`
> from `extra`. Do not assume defaults. An incorrect domain produces a
> signature the facilitator will reject with another 402.

## Step 5: Construct the X-PAYMENT Payload

The wire shape MUST match the x402 v1 spec §5.2 `PaymentPayload`
schema exactly:

```text
{ x402Version, scheme, network, payload: { signature, authorization } }
```

Per spec §5.2.1, `value`, `validAfter`, and `validBefore` are all
**string-typed** (uint256-as-decimal-string for `value`,
Unix-timestamp-as-decimal-string for the timestamps). Use `--arg`, not
`--argjson`, so jq emits JSON strings rather than numbers.

`x402Version` is an integer per spec (not a string-typed field like the
EIP-3009 timestamps): `--argjson x402Version 1` emits a JSON number,
which is correct. If a future spec revision retypes this field as a
string, switch to `--arg` instead.

```bash
set -euo pipefail

X402_PAYMENT_JSON=$(jq -n \
  --argjson x402Version  1 \
  --arg     scheme       "$X402_SCHEME" \
  --arg     network      "$X402_NETWORK" \
  --arg     from         "$WALLET_ADDRESS" \
  --arg     to           "$X402_PAY_TO" \
  --arg     value        "$X402_AMOUNT" \
  --arg     validAfter   "$X402_VALID_AFTER" \
  --arg     validBefore  "$X402_VALID_BEFORE" \
  --arg     nonce        "$X402_NONCE" \
  --arg     sig          "$X402_SIGNATURE" \
  '{
    x402Version: $x402Version,
    scheme:      $scheme,
    network:     $network,
    payload: {
      signature: $sig,
      authorization: {
        from:        $from,
        to:          $to,
        value:       $value,
        validAfter:  $validAfter,
        validBefore: $validBefore,
        nonce:       $nonce
      }
    }
  }')

# Base64-encode and strip whitespace (header spec requires no newlines)
X402_PAYMENT=$(echo "$X402_PAYMENT_JSON" | base64 | tr -d '[:space:]')
```

`value`, `validAfter`, and `validBefore` MUST be strings (`--arg`, not
`--argjson`): uint256 amounts exceed JSON's safe integer range, and the
spec's PaymentPayload schema types all three as `string`. Top-level
`chainId` and `asset` are intentionally omitted: `network` already
encodes the chain, and the asset is implicit in the requirement
matching.

## Step 6: Retry the Original Request

The freshness gate has already run in Step 4 (refuse-to-sign-when-stale).
By the time control reaches this step, the signature is fresh and the
nonce is committed.

```bash
set -euo pipefail

# Capture status and headers explicitly. `head -1 | grep -o '[0-9]\{3\}'`
# is fragile (HTTP/2, 100-continue interim responses), so use curl's
# own status-code writer.
RETRY_HEADERS=$(mktemp)
RETRY_BODY_FILE=$(mktemp)
trap 'rm -f "$RETRY_HEADERS" "$RETRY_BODY_FILE"' EXIT

RETRY_STATUS=$(curl -s -o "$RETRY_BODY_FILE" -D "$RETRY_HEADERS" \
  -w '%{http_code}' \
  "$X402_RESOURCE" \
  -H "X-PAYMENT: $X402_PAYMENT" \
  -H "Content-Type: application/json")

RETRY_BODY=$(cat "$RETRY_BODY_FILE")
# Use awk for header parsing rather than `cut -d' ' -f2-`: header names
# may have variable whitespace after the colon, and `cut` mishandles
# tabs and folded continuations.
X402_PAYMENT_RESPONSE=$(awk 'BEGIN{IGNORECASE=1} /^x-payment-response:/ { sub(/^[^:]+:[ \t]*/, ""); print }' \
  "$RETRY_HEADERS" | tr -d '\r\n')

echo "HTTP status: $RETRY_STATUS"
```

### Retry policy (two attempts maximum)

The 402 path is bounded: at most **one** retry after the initial 402, and
only against a freshly re-parsed challenge. The retry budget is tracked
at the agent level, not via a bash counter. Bash variable state does
not survive across separate Bash tool invocations, so a counter would
silently reset and permit unbounded retries.

**Agent-level retry instruction:** If the retry returns 402, you may
attempt **one** more retry, but only after re-deriving `X402_NONCE` and
`X402_VALID_BEFORE` from a freshly fetched 402 challenge. Do not retry a
third time. After the second 402, surface the rejection to the user with
the exact body OKX returned and stop.

To enforce the cap across separate Bash tool invocations (where shell
variable state does not persist), use a tmpfile-based stamp and pass
`X402_ATTEMPT_FILE` through to subsequent invocations so the budget is
shared:

```bash
# IMPORTANT: $$ would evaluate to a fresh PID on every Bash tool invocation,
# defeating the cap. The agent MUST export X402_ATTEMPT_FILE explicitly before
# the first invocation of this block (e.g. /tmp/x402-attempt-${WALLET_ADDRESS}-${X402_NONCE_PREFIX})
# and reuse the SAME path across retries.
: "${X402_ATTEMPT_FILE:?missing — agent must set a stable path so the retry budget persists across Bash invocations}"
[ -e "$X402_ATTEMPT_FILE" ] && [ ! -r "$X402_ATTEMPT_FILE" ] && {
  echo "ERROR: X402_ATTEMPT_FILE exists but is unreadable: $X402_ATTEMPT_FILE" >&2
  exit 1
}
attempts=$(wc -l < "$X402_ATTEMPT_FILE" 2>/dev/null || echo 0)
[ "$attempts" -lt 2 ] || { echo "Retry budget exhausted (max 2 attempts)." >&2; exit 1; }
date +%s >> "$X402_ATTEMPT_FILE"
```

**Variable lifecycle on retry or re-confirmation.** On any retry, you
MUST regenerate the following from a freshly fetched 402 challenge body
before re-signing:

- `X402_NONCE` (Step 3): never reuse a prior nonce; the facilitator
  rejects replays and you would burn the new attempt for nothing.
- `X402_VALID_BEFORE` (Step 3): recompute from the fresh `date +%s` so
  the freshness gate in Step 4 does not trip on an old deadline.
- `CHALLENGE_FETCHED_AT` (Step 2): re-capture from `date +%s` at the
  moment the new 402 body is read; this is the timestamp the Step 4
  gate compares against.

The user-confirmation gate (Step 3.5) MUST also re-prompt; do not silently
re-sign on prior consent.

## Step 7: Interpret the Response

| Status | Meaning                              | Action                                                                                                                                                                                                                                  |
| ------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200    | Payment accepted, resource delivered | If `X402_PAYMENT_RESPONSE` is non-empty, decode it: `echo "$X402_PAYMENT_RESPONSE" \| base64 --decode \| jq .` and surface the receipt. If empty, report "Payment accepted but no receipt header returned. The resource was delivered." |
| 402    | Payment rejected                     | Most common causes: wrong domain `name` / `version`, expired `validBefore`, reused `nonce`, amount mismatch. Re-derive from the **fresh** challenge and try once more (max two attempts total)                                          |
| 400    | Malformed payload                    | Verify JSON structure and base64 encoding (no whitespace), confirm `x402Version: 1` and `payload.{signature, authorization}` shape                                                                                                      |
| 5xx    | Facilitator or origin error          | Surface raw body to the user. Do not auto-retry                                                                                                                                                                                         |

Do not retry indefinitely on 402. Two attempts maximum, then surface
the rejection details to the user with the exact message OKX returned.
Empty `X402_PAYMENT_RESPONSE` is not an error: skip the decode step
and report success without a receipt rather than feeding empty input
to `base64 --decode`.
