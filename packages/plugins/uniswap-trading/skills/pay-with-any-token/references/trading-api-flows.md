# Trading API Flows

Step-by-step bash scripts for swap and bridge operations using the
Uniswap Trading API (`https://trade-api.gateway.uniswap.org/v1`).

## Table of Contents

- [Phase 4A — Swap on Source Chain](#phase-4a--swap-on-source-chain)
- [Phase 4B — Bridge to Tempo](#phase-4b--bridge-to-tempo)

## Bind the Approved Quote Terms

A quote expires in about 60 seconds, so a leg often re-fetches one after the
user has already approved it. The refreshed quote comes from the API and nothing
forces it to describe the same trade. Capture what the user was shown at the
confirmation gate, then compare the refreshed quote against it before
broadcasting.

Every recorded value is read from the quote or swap object about to be
submitted, never from a shell literal that would compare a constant to itself.
The quote object is stored key-sorted and compared byte for byte, so the
recipient, the destination token and the destination chain are all covered
without naming a field. The broadcast target and the calldata are bound exactly
on top of it.

A gate that skips its comparison when a value is empty is not a gate. Every field
is required and shape-checked at bind and again at assert, so an unset variable
refuses the broadcast instead of waving it through.

The record is keyed to `PAYMENT_ID`, one stable identifier per payment. That
stops a leftover record from a crashed earlier payment, or a second payment
running in the same directory, from satisfying this payment's gate.

```bash
set -euo pipefail

# One stable identifier per payment. The agent sets it once, before the first
# gate, and passes the same value to every later block.
: "${PAYMENT_ID:?missing: set one stable id per payment before the first gate}"
[[ "$PAYMENT_ID" =~ ^[A-Za-z0-9_-]{8,128}$ ]] || {
  echo "ERROR: PAYMENT_ID must be 8-128 characters of [A-Za-z0-9_-]" >&2
  exit 1
}
APPROVED_QUOTE_DIR="$PWD/.approved-quote-$PAYMENT_ID"
# Set only by bind_broadcast_tx, and cleared by the assert that reads it. It is
# wiped here so an inherited value cannot stand down the gate.
_BINDING_BROADCAST=

uint_lt() {
  [[ "$1" =~ ^[0-9]{1,78}$ ]] && [[ "$2" =~ ^[0-9]{1,78}$ ]] || {
    echo "ERROR: uint_lt needs two uint256 decimal strings, got '$1' and '$2'" >&2
    exit 1
  }
  local out
  # A guard whose helper can fail must halt, never read as "not less than".
  out=$(python3 -c 'import sys; print("lt" if int(sys.argv[1]) < int(sys.argv[2]) else "ge")' "$1" "$2") || {
    echo "ERROR: uint_lt could not compare '$1' and '$2'; python3 is missing or failed." >&2
    exit 1
  }
  case "$out" in
    lt) return 0 ;;
    ge) return 1 ;;
    *)  echo "ERROR: uint_lt got an unusable answer for '$1' and '$2': '$out'" >&2; exit 1 ;;
  esac
}

_require_quote_var() {
  local name="$1" value="$2" pattern="$3"
  [ -n "$value" ] || { echo "ERROR: $name is empty; refusing to gate on a blank value." >&2; return 1; }
  [[ "$value" =~ $pattern ]] || { echo "ERROR: $name has the wrong shape: $value" >&2; return 1; }
}

# Every field is read from the quote or swap object about to be submitted, never
# from a shell literal that would compare a constant to itself.
_validate_quote_vars() {
  local kind="$1"
  _require_quote_var QUOTE_BODY "${QUOTE_BODY:-}" '^\{.*\}$' || return 1
  if [ "$kind" = broadcast ]; then
    _require_quote_var QUOTE_AMOUNT_IN  "${QUOTE_AMOUNT_IN:-}"  '^[0-9]{1,78}$'       || return 1
    _require_quote_var QUOTE_SWAP_TO    "${QUOTE_SWAP_TO:-}"    '^0x[a-fA-F0-9]{40}$' || return 1
    _require_quote_var QUOTE_SWAP_DATA  "${QUOTE_SWAP_DATA:-}"  '^0x[a-fA-F0-9]{8,}$' || return 1
    # swap.value becomes msg.value, so it decides how much native currency
    # leaves the wallet. It is bound with the target and the calldata.
    _require_quote_var QUOTE_SWAP_VALUE "${QUOTE_SWAP_VALUE:-}" '^0[xX][0-9a-fA-F]{1,64}$' || return 1
  else
    _require_quote_var QUOTE_ID "${QUOTE_ID:-}" '^[A-Za-z0-9._:-]{1,128}$' || return 1
    # jq -r prints the four letters "null" for an absent field, and that string
    # would bind and then compare equal to itself on every later read.
    [ "$QUOTE_ID" != null ] || {
      echo "ERROR: quoteId is the literal string 'null'; the quote carries no id to bind." >&2
      return 1
    }
  fi
}

_write_quote_record() {
  local kind="$1"
  [ -e "$APPROVED_QUOTE_DIR" ] && {
    echo "ERROR: a record already exists for PAYMENT_ID=$PAYMENT_ID." >&2
    echo "A retry must be measured against it, not rebound. Release it first if this is a new payment." >&2
    return 1
  }
  mkdir -p "$APPROVED_QUOTE_DIR"
  printf '%s' "$kind"       > "$APPROVED_QUOTE_DIR/kind"
  printf '%s' "$QUOTE_BODY" > "$APPROVED_QUOTE_DIR/quoteBody"
  if [ "$kind" = broadcast ]; then
    printf '%s' "$QUOTE_AMOUNT_IN"  > "$APPROVED_QUOTE_DIR/amountIn"
    printf '%s' "$QUOTE_SWAP_TO"    > "$APPROVED_QUOTE_DIR/swapTo"
    printf '%s' "$QUOTE_SWAP_DATA"  > "$APPROVED_QUOTE_DIR/calldata"
    printf '%s' "$QUOTE_SWAP_VALUE" > "$APPROVED_QUOTE_DIR/value"
  else
    printf '%s' "$QUOTE_ID" > "$APPROVED_QUOTE_DIR/quoteId"
  fi
}

bind_approved_quote()        { _validate_quote_vars broadcast && _write_quote_record broadcast; }
bind_approved_quote_preswap() { _validate_quote_vars preswap  && _write_quote_record preswap; }

# A preswap record binds the quote before any calldata exists. The broadcast
# triple is added to that same record once /swap returns it, behind its own
# confirmation gate, so nothing reaches `cast send` unbound.
bind_broadcast_tx() {
  [ -d "$APPROVED_QUOTE_DIR" ] || {
    echo "ERROR: no approved quote on record for PAYMENT_ID=$PAYMENT_ID." >&2; return 1
  }
  [ "$(_approved_quote_field kind)" = preswap ] || {
    echo "ERROR: bind_broadcast_tx upgrades a preswap record only." >&2; return 1
  }
  [ -e "$APPROVED_QUOTE_DIR/swapTo" ] && {
    echo "ERROR: a broadcast target is already on record; a retry is measured against it." >&2; return 1
  }
  # The broadcast triple is not on record yet, which is the one moment the
  # missing-record refusal below must not fire.
  # `|| rc=$?` and not a bare call: under `set -e` a bare non-zero assert ends
  # the shell before the status can be read or the flag cleared.
  _BINDING_BROADCAST=1
  local rc=0
  assert_quote_terms_unchanged || rc=$?
  _BINDING_BROADCAST=
  [ "$rc" = 0 ] || return "$rc"
  _require_quote_var QUOTE_SWAP_TO    "${QUOTE_SWAP_TO:-}"    '^0x[a-fA-F0-9]{40}$'      || return 1
  _require_quote_var QUOTE_SWAP_DATA  "${QUOTE_SWAP_DATA:-}"  '^0x[a-fA-F0-9]{8,}$'      || return 1
  _require_quote_var QUOTE_SWAP_VALUE "${QUOTE_SWAP_VALUE:-}" '^0[xX][0-9a-fA-F]{1,64}$' || return 1
  printf '%s' "$QUOTE_SWAP_TO"    > "$APPROVED_QUOTE_DIR/swapTo"
  printf '%s' "$QUOTE_SWAP_DATA"  > "$APPROVED_QUOTE_DIR/calldata"
  printf '%s' "$QUOTE_SWAP_VALUE" > "$APPROVED_QUOTE_DIR/value"
}

_approved_quote_field() { cat "$APPROVED_QUOTE_DIR/$1" 2>/dev/null || true; }

_quote_field_or_fail() {
  local name="$1" a
  a=$(_approved_quote_field "$name")
  [ -n "$a" ] || { echo "ERROR: approved record has a blank $name." >&2; return 1; }
  printf '%s' "$a"
}

# 0 unchanged, 2 the refreshed quote moved something, 1 unusable.
assert_quote_terms_unchanged() {
  local changed="" a kind binding="${_BINDING_BROADCAST:-}"
  _BINDING_BROADCAST=
  [ -d "$APPROVED_QUOTE_DIR" ] || {
    echo "ERROR: no approved quote on record for PAYMENT_ID=$PAYMENT_ID." >&2
    return 1
  }
  kind=$(_approved_quote_field kind)
  [ "$kind" = broadcast ] || [ "$kind" = preswap ] || {
    echo "ERROR: approved record has no usable kind marker; refusing to broadcast." >&2
    return 1
  }
  _validate_quote_vars "$kind" || return 1
  a=$(_quote_field_or_fail quoteBody) || return 1
  [ "$QUOTE_BODY" = "$a" ] || changed="$changed
  quote: the quote is not the one the user approved"
  if [ "$kind" = preswap ]; then
    a=$(_quote_field_or_fail quoteId) || return 1
    [ "$QUOTE_ID" = "$a" ] || changed="$changed
  quoteId: approved '$a', now '$QUOTE_ID'"
    # Once bind_broadcast_tx has upgraded the record, the broadcast triple is
    # compared too, so the target, the calldata and msg.value are all covered.
    if [ -e "$APPROVED_QUOTE_DIR/swapTo" ]; then
      _require_quote_var QUOTE_SWAP_TO    "${QUOTE_SWAP_TO:-}"    '^0x[a-fA-F0-9]{40}$'      || return 1
      _require_quote_var QUOTE_SWAP_DATA  "${QUOTE_SWAP_DATA:-}"  '^0x[a-fA-F0-9]{8,}$'      || return 1
      _require_quote_var QUOTE_SWAP_VALUE "${QUOTE_SWAP_VALUE:-}" '^0[xX][0-9a-fA-F]{1,64}$' || return 1
      a=$(_quote_field_or_fail swapTo) || return 1
      [ "$QUOTE_SWAP_TO" = "$a" ] || changed="$changed
  swapTo: approved '$a', now '$QUOTE_SWAP_TO'"
      a=$(_quote_field_or_fail calldata) || return 1
      [ "$QUOTE_SWAP_DATA" = "$a" ] || changed="$changed
  calldata: the transaction is not the one the user approved"
      a=$(_quote_field_or_fail value) || return 1
      [ "$QUOTE_SWAP_VALUE" = "$a" ] || changed="$changed
  value: approved '$a', now '$QUOTE_SWAP_VALUE'"
    elif [ -z "$binding" ] && [ -n "${QUOTE_SWAP_TO:-}${QUOTE_SWAP_DATA:-}${QUOTE_SWAP_VALUE:-}" ]; then
      # Missing recorded state is never "nothing to compare".
      echo "ERROR: a broadcast target, calldata or value is set, but none is on record." >&2
      echo "Call bind_broadcast_tx behind its own confirmation gate before broadcasting." >&2
      return 1
    fi
  else
    a=$(_quote_field_or_fail swapTo) || return 1
    [ "$QUOTE_SWAP_TO" = "$a" ] || changed="$changed
  swapTo: approved '$a', now '$QUOTE_SWAP_TO'"
    a=$(_quote_field_or_fail calldata) || return 1
    [ "$QUOTE_SWAP_DATA" = "$a" ] || changed="$changed
  calldata: the transaction is not the one the user approved"
    a=$(_quote_field_or_fail value) || return 1
    [ "$QUOTE_SWAP_VALUE" = "$a" ] || changed="$changed
  value: approved '$a', now '$QUOTE_SWAP_VALUE'"
    a=$(_quote_field_or_fail amountIn) || return 1
    [ "$QUOTE_AMOUNT_IN" = "$a" ] || changed="$changed
  amountIn: approved '$a', now '$QUOTE_AMOUNT_IN'"
  fi
  [ -z "$changed" ] && return 0
  echo "ERROR: the refreshed quote changed these approved terms:$changed" >&2
  echo "Refusing to broadcast. Show the user that list and stop." >&2
  return 2
}

release_approved_quote() {
  [[ "${PAYMENT_ID:-}" =~ ^[A-Za-z0-9_-]{8,128}$ ]] || return 1
  rm -rf "$PWD/.approved-quote-$PAYMENT_ID"
}
```

Paste these definitions into every block that calls them, and export
`PAYMENT_ID` to every one of them. The approved values live in
`$APPROVED_QUOTE_DIR` on disk, which is what carries them across the shell
boundary.

Bind after the values exist, never before. A fenced block is a fresh shell, so a
`bind_approved_quote` call that reads a variable the next block assigns records
an empty string, which the shape checks now refuse outright.

A refreshed quote carries different calldata and a different quote object, so it
will not satisfy a record bound to the old one. That is deliberate: a refresh is
a new trade with new numbers. Show the user the new quote, get a fresh yes, call
`release_approved_quote`, and bind again. Never broadcast a refreshed quote
against an older record.

Release the record when the flow ends, whichever way it ends. Call
`release_approved_quote` after a successful payment, and again after any refusal
or abort, so a dead record does not accumulate in the working directory:

```bash
set -euo pipefail
: "${PAYMENT_ID:?missing}"
[[ "$PAYMENT_ID" =~ ^[A-Za-z0-9_-]{8,128}$ ]] || exit 1
rm -rf "$PWD/.approved-quote-$PAYMENT_ID"
```

**Recovering a half-written record.** If `bind_broadcast_tx` is interrupted after
it writes `swapTo` but before it writes `calldata` and `value`, the payment
wedges: the assert refuses on the blank field, and a retry refuses because a
target is already on record. That is the right way to fail, and the way out is to
start the approval over. Call `release_approved_quote`, tell the user the record
was incomplete and nothing was broadcast, then take them back through the
confirmation gate and bind the quote again.

## Phase 4A — Swap on Source Chain

Use the Uniswap Trading API to swap the source token to USDC (the bridge
asset). This is an EXACT_OUTPUT swap — the payee's amount determines how much
USDC to acquire.

**Variable Setup** (fill these before running any steps):

```bash
set -euo pipefail

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
# Apply a 0.5% buffer for bridge fees. The amount is passed as argv, never as program text:
# [[ "$REQUIRED_AMOUNT" =~ ^[0-9]{1,78}$ ]] || { echo "bad amount" >&2; exit 1; }
# USDC_E_AMOUNT_NEEDED=$(python3 -c 'import sys; print((int(sys.argv[1]) * 1005) // 1000)' "$REQUIRED_AMOUNT")
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
set -euo pipefail

# The value is passed as argv, never interpolated into the program text.
hex_to_dec() {
  # The 0x prefix is required. A bare digit run would otherwise be read base 16
  # and broadcast an amount nobody approved.
  [[ "$1" =~ ^0[xX][0-9a-fA-F]{1,64}$ ]] || { echo "ERROR: not a 0x hex value: $1" >&2; return 1; }
  local out
  out=$(python3 -c 'import sys; print(int(sys.argv[1], 16))' "$1") || {
    echo "ERROR: hex_to_dec could not run python3 for '$1'" >&2; return 1
  }
  [[ "$out" =~ ^[0-9]{1,78}$ ]] || { echo "ERROR: hex_to_dec produced '$out'" >&2; return 1; }
  printf '%s\n' "$out"
}
# Usage: cast send <TO> <CALLDATA> --value "$(hex_to_dec "$SWAP_VALUE_HEX")"
```

### Step 4A-1 — Check approval

```bash
set -euo pipefail

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
set -euo pipefail

# Build the request body safely using jq. Chain IDs are integers; addresses
# and amounts are strings.
QUOTE_REQUEST=$(jq -n \
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
  -d "$QUOTE_REQUEST"
```

Note: `tokenInChainId` and `tokenOutChainId` must be **integers**, not strings.

Store the full quote response as `QUOTE_RESPONSE`. Then extract the actual input
amount and re-run the approval check with the real value:

```bash
set -euo pipefail

REQUIRED_AMOUNT_IN=$(printf '%s' "$QUOTE_RESPONSE" | jq -r '.quote.amountIn')
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
>
> **A re-fetched quote must still match what the user approved.** Call
> `bind_approved_quote` at the confirmation gate, then
> `assert_quote_terms_unchanged` on the refreshed quote before broadcasting.
> Refuse the broadcast and exit non-zero on any mismatch.

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
set -euo pipefail

# Strip permitData; re-attach only if non-null and routing is CLASSIC
ROUTING=$(printf '%s' "$QUOTE_RESPONSE" | jq -r '.routing')
CLEAN_QUOTE=$(printf '%s' "$QUOTE_RESPONSE" | jq 'del(.permitData, .permitTransaction)')

if [ "$ROUTING" = "CLASSIC" ]; then
  PERMIT_DATA=$(printf '%s' "$QUOTE_RESPONSE" | jq '.permitData')
  if [ "$PERMIT_DATA" != "null" ]; then
    # Guard: ensure PERMIT2_SIGNATURE was obtained in Step 4A-2.5
    if [ -z "$PERMIT2_SIGNATURE" ]; then
      echo "ERROR: permitData is present but PERMIT2_SIGNATURE is empty. Complete Step 4A-2.5 first."
      exit 1
    fi
    # Include signature + permitData in swap body
    SWAP_BODY=$(printf '%s' "$CLEAN_QUOTE" | jq \
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
  SWAP_BODY=$(printf '%s' "$CLEAN_QUOTE" | jq --arg sig "$PERMIT2_SIGNATURE" '. + {signature: $sig}')
fi

curl -s -X POST https://trade-api.gateway.uniswap.org/v1/swap \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
  -d "$SWAP_BODY"
```

Store the swap response as `SWAP_RESPONSE`. The `/swap` endpoint returns
**unsigned calldata** — you must broadcast it yourself.

Extract and validate the transaction fields first, so the summary you show the
user names the contract the transaction will call:

```bash
set -euo pipefail

# Extract the transaction fields from the swap response
SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')

# Validate before broadcasting
[[ "$SWAP_TO" =~ ^0x[a-fA-F0-9]{40}$ ]] || {
  echo "ERROR: swap.to is not an address: $SWAP_TO. Re-fetch from Step 4A-2." >&2; exit 1
}
[[ "$SWAP_DATA" =~ ^0x[a-fA-F0-9]{8,}$ ]] || {
  echo "ERROR: swap.data is empty or malformed — quote may have expired. Re-fetch from Step 4A-2." >&2; exit 1
}
```

Now present the transaction summary to the user via `AskUserQuestion`, showing
`$SWAP_TO` as the contract the transaction will call. On their yes, run the block
below. It re-derives every recorded value from `$QUOTE_RESPONSE` and
`$SWAP_RESPONSE`, so it needs nothing carried over from the extraction block
above:

```bash
set -euo pipefail

declare -F bind_approved_quote >/dev/null || { echo "ERROR: bind_approved_quote is not defined; paste the helper block above into this block first." >&2; exit 1; }

QUOTE_BODY=$(printf '%s' "$QUOTE_RESPONSE" | jq -Sc '.quote')
QUOTE_AMOUNT_IN=$(printf '%s' "$QUOTE_RESPONSE" | jq -r '.quote.amountIn')
QUOTE_SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
QUOTE_SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
QUOTE_SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')
bind_approved_quote
```

`QUOTE_BODY` is the whole quote, key-sorted so the comparison is stable. The
swapper, the destination token and the destination chain all live inside it, so
they are covered without naming a field. `swap.value` is not in the quote, so it
is bound on its own alongside the target and the calldata.

Then broadcast:

```bash
set -euo pipefail

declare -F assert_quote_terms_unchanged >/dev/null || { echo "ERROR: assert_quote_terms_unchanged is not defined; paste the helper block above into this block first." >&2; exit 1; }
declare -F hex_to_dec >/dev/null || { echo "ERROR: hex_to_dec is not defined; paste the helper block above into this block first." >&2; exit 1; }
declare -F get_token_decimals >/dev/null || { echo "ERROR: get_token_decimals is not defined; paste the helper block from pay-with-any-token/SKILL.md or references/credential-construction.md into this block first." >&2; exit 1; }
declare -F format_token_amount >/dev/null || { echo "ERROR: format_token_amount is not defined; paste the helper block from pay-with-any-token/SKILL.md or references/credential-construction.md into this block first." >&2; exit 1; }
declare -F uint_lt >/dev/null || { echo "ERROR: uint_lt is not defined; paste the helper block above into this block first." >&2; exit 1; }

# Re-read the transaction fields from the response about to be broadcast.
SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')
# For native ETH swaps (TOKEN_IN is WETH address or ETH sentinel), SWAP_VALUE must
# be non-zero — it carries the ETH amount as msg.value. A zero value means the quote
# did not recognise the input as native ETH; do NOT broadcast or the swap will revert.
if [[ "$TOKEN_IN_ADDRESS" == "0x4200000000000000000000000000000000000006" || \
      "$TOKEN_IN_ADDRESS" == "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" || \
      "$TOKEN_IN_ADDRESS" == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEEE" ]]; then
  if [ "$SWAP_VALUE" = "0x0" ] || [ "$SWAP_VALUE" = "0" ]; then
    echo "ERROR: SWAP_VALUE is zero for a native ETH swap — verify TOKEN_IN_ADDRESS and re-fetch the quote." >&2
    exit 1
  fi
fi

# The same terms, now taken from the objects about to be broadcast.
QUOTE_BODY=$(printf '%s' "$QUOTE_RESPONSE" | jq -Sc '.quote')
QUOTE_AMOUNT_IN=$(printf '%s' "$QUOTE_RESPONSE" | jq -r '.quote.amountIn')
QUOTE_SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
QUOTE_SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
QUOTE_SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')
assert_quote_terms_unchanged || exit 1

# Broadcast via cast. Every argument is the value the gate just compared, so
# nothing unbound reaches the wire.
# Convert hex value to decimal (cast --value requires decimal wei)
SWAP_VALUE_DEC=$(hex_to_dec "$QUOTE_SWAP_VALUE") || exit 1

SWAP_TX=$(cast send "$QUOTE_SWAP_TO" "$QUOTE_SWAP_DATA" \
  --value "$SWAP_VALUE_DEC" \
  --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
  --rpc-url "$SOURCE_RPC_URL" \
  --json | jq -r '.transactionHash')

# Wait for the swap to mine before bridging — a reverted swap leaves USDC at zero
SWAP_STATUS=$(cast receipt "$SWAP_TX" --rpc-url "$SOURCE_RPC_URL" --json | jq -r '.status')
[ "$SWAP_STATUS" = "0x1" ] || { echo "ERROR: Swap reverted (status=$SWAP_STATUS). Do not proceed to bridge." && exit 1; }
echo "Swap confirmed: $SWAP_TX"

# Verify USDC balance landed before proceeding to Phase 4B.
# cast call returns "123456 [1.234e5]"; strip the suffix before any consumer reads it.
USDC_AFTER_SWAP=$(cast call "$USDC_ADDRESS" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url "$SOURCE_RPC_URL" | awk '{print $1}')
[[ "$USDC_AFTER_SWAP" =~ ^[0-9]{1,78}$ ]] || { echo "ERROR: non-integer USDC balance: $USDC_AFTER_SWAP" >&2; exit 1; }
# Format balances for human-readable display (USDC = 6 decimals)
USDC_DECIMALS=$(get_token_decimals "$USDC_ADDRESS" "$SOURCE_RPC_URL") || exit 1
USDC_AFTER_HUMAN=$(format_token_amount "$USDC_AFTER_SWAP" "$USDC_DECIMALS") || exit 1
USDC_NEEDED_HUMAN=$(format_token_amount "$USDC_E_AMOUNT_NEEDED" "$USDC_DECIMALS") || exit 1
echo "USDC balance after swap: $USDC_AFTER_HUMAN USDC (need at least $USDC_NEEDED_HUMAN USDC)"
# Halt if swap produced insufficient USDC — bridging 0 USDC wastes gas and fails silently.
# The guard is written as `if ... then exit`, not as an `&&` chain: a failed test in
# an `&&` chain short-circuits without tripping `set -e`, so the under-funded swap
# would proceed to bridge.
[[ "$USDC_E_AMOUNT_NEEDED" =~ ^[0-9]{1,78}$ ]] || { echo "ERROR: non-integer target amount: $USDC_E_AMOUNT_NEEDED" >&2; exit 1; }
if uint_lt "$USDC_AFTER_SWAP" "$USDC_E_AMOUNT_NEEDED"; then
  echo "ERROR: swap produced $USDC_AFTER_HUMAN USDC but $USDC_NEEDED_HUMAN USDC needed — check receipt, do NOT proceed to bridge." >&2
  exit 1
fi
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
set -euo pipefail

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

APPROVAL_TX=$(printf '%s' "$APPROVAL" | jq -r '.approval // empty')
echo "Approval needed: $([ -n "$APPROVAL_TX" ] && echo yes || echo no)"
```

> **REQUIRED:** If `APPROVAL_TX` is non-empty, use `AskUserQuestion` to show the
> user the approval details (token: `$BRIDGE_TOKEN_IN`, spender, amount:
> `$BRIDGE_AMOUNT`, estimated gas) and obtain explicit confirmation before
> submitting the approval transaction.

If confirmed and `APPROVAL_TX` is non-empty:

```bash
set -euo pipefail

# Only reachable after an explicit human yes to this specific approval.
[ "${PERMIT2_APPROVAL_ACK:-}" = "yes" ] || {
  echo "ERROR: no explicit consent on record for this approval; refusing to send." >&2
  exit 1
}

APPROVAL_TO=$(printf '%s' "$APPROVAL_TX"   | jq -r '.to')
APPROVAL_DATA=$(printf '%s' "$APPROVAL_TX" | jq -r '.data')

# The approval target and its calldata reach the wire, so both are shape-checked.
[[ "$APPROVAL_TO" =~ ^0x[a-fA-F0-9]{40}$ ]] || {
  echo "ERROR: approval.to is not an address: $APPROVAL_TO" >&2; exit 1
}
[[ "$APPROVAL_DATA" =~ ^0x[a-fA-F0-9]{8,}$ ]] || {
  echo "ERROR: approval.data is empty or malformed: $APPROVAL_DATA" >&2; exit 1
}

APPROVE_HASH=$(cast send "$APPROVAL_TO" "$APPROVAL_DATA" \
  --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
  --rpc-url "$SOURCE_RPC_URL" \
  --json | jq -r '.transactionHash')
cast receipt "$APPROVE_HASH" --rpc-url "$SOURCE_RPC_URL" > /dev/null
echo "Approval confirmed: $APPROVE_HASH"
```

`PERMIT2_APPROVAL_ACK` is a second factor the agent sets after the human answer
arrives. It is never the consent on its own, and it never comes from API text.

> **IMPORTANT — bridge spender approval:** The Trading API's `check_approval`
> only covers the Permit2 contract. The bridge contract itself (the `to` address
> from the `/swap` response) also needs an ERC-20 allowance. **Run this on-chain
> check in Step 4B-3 after `bind_broadcast_tx` has recorded the target**, and
> before broadcasting the bridge transaction. Approving an unbound address would
> grant an unlimited allowance to a contract the user never saw:
>
> ```bash
> declare -F uint_lt >/dev/null || { echo "ERROR: uint_lt is not defined; paste the helper block above into this block first." >&2; exit 1; }
>
> BRIDGE_SPENDER="$QUOTE_SWAP_TO"  # the bound broadcast target
> ALLOWANCE=$(cast call "$BRIDGE_TOKEN_IN" \
>   "allowance(address,address)(uint256)" "$WALLET_ADDRESS" "$BRIDGE_SPENDER" \
>   --rpc-url "$SOURCE_RPC_URL" 2>/dev/null | awk '{print $1}')
> if [ -z "$ALLOWANCE" ] || ! [[ "$ALLOWANCE" =~ ^[0-9]{1,78}$ ]]; then
>   echo "ERROR: Failed to read allowance from chain. Check RPC connectivity and token address."
>   exit 1
> fi
> # uint_lt does the uint256 comparison in python3; uint256 values overflow bash arithmetic.
> [[ "$BRIDGE_AMOUNT" =~ ^[0-9]{1,78}$ ]] || { echo "ERROR: non-integer bridge amount: $BRIDGE_AMOUNT"; exit 1; }
> if uint_lt "$ALLOWANCE" "$BRIDGE_AMOUNT"; then
>   echo "Insufficient allowance for bridge spender $BRIDGE_SPENDER."
>   echo "An approval is needed. Confirm the grant with the user before sending it."
>   exit 2
> fi
> ```
>
> **Gate 1 of the skill's gate list.** Exit code 2 means an approval is needed
> and nothing has been sent. Show the user the token (`$BRIDGE_TOKEN_IN`), the
> spender (`$BRIDGE_SPENDER`), the allowance size, and the estimated gas through
> `AskUserQuestion`, and get an explicit yes.
>
> Offer the exact amount first. An unlimited allowance leaves the spender able to
> move the whole balance forever, so the user has to choose it knowingly. Set
> `BRIDGE_APPROVE_AMOUNT` to `$BRIDGE_AMOUNT` for the exact grant, or to
> `115792089237316195423570985008687907853269984665640564039457584007913129639935`
> only when the user asked for the unlimited one. Then run:
>
> ```bash
> set -euo pipefail
>
> # Only reachable after an explicit human yes to this specific allowance.
> [ "${BRIDGE_APPROVAL_ACK:-}" = "yes" ] || {
>   echo "ERROR: no explicit consent on record for this allowance; refusing to approve." >&2
>   exit 1
> }
> [[ "$BRIDGE_SPENDER" =~ ^0x[a-fA-F0-9]{40}$ ]] || {
>   echo "ERROR: bridge spender is not an address: $BRIDGE_SPENDER" >&2; exit 1
> }
> [[ "${BRIDGE_APPROVE_AMOUNT:-}" =~ ^[1-9][0-9]{0,77}$ ]] || {
>   echo "ERROR: BRIDGE_APPROVE_AMOUNT is not a positive integer: ${BRIDGE_APPROVE_AMOUNT:-}" >&2
>   exit 1
> }
> BRIDGE_APPROVE_HASH=$(cast send "$BRIDGE_TOKEN_IN" \
>   "approve(address,uint256)" "$BRIDGE_SPENDER" "$BRIDGE_APPROVE_AMOUNT" \
>   --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
>   --rpc-url "$SOURCE_RPC_URL" --json | jq -r '.transactionHash')
> cast receipt "$BRIDGE_APPROVE_HASH" --rpc-url "$SOURCE_RPC_URL" > /dev/null
> echo "Bridge spender approval confirmed: $BRIDGE_APPROVE_HASH"
> ```
>
> `BRIDGE_APPROVAL_ACK` is a second factor the agent sets after the human answer
> arrives. It is never the consent on its own, and it never comes from API text.
>
> Skipping this step will cause the bridge transaction to revert with
> "ERC20: transfer amount exceeds allowance".

### Step 4B-2 — Get bridge quote (EXACT_OUTPUT)

> **API constraint:** The Trading API does not support a separate `recipient`
> field for cross-chain bridge quotes. The `swapper` address is always the
> recipient on the destination chain. If your `WALLET_ADDRESS` differs from
> `TEMPO_WALLET_ADDRESS`, the bridge will deliver USDC.e to `WALLET_ADDRESS`
> on Tempo — a follow-up transfer (Phase 4B-5) moves it to `TEMPO_WALLET_ADDRESS`.

```bash
set -euo pipefail

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

BRIDGE_QUOTE_ID=$(printf '%s' "$BRIDGE_QUOTE" | jq -r '.quote.quoteId')
BRIDGE_FEE=$(printf '%s' "$BRIDGE_QUOTE"      | jq -r '.quote.bridgeFee // .quote.gasFee // "unknown"')
BRIDGE_ETA=$(printf '%s' "$BRIDGE_QUOTE"      | jq -r '.quote.estimatedFillTime // "2-5 minutes"')
echo "Bridge quote: quoteId=$BRIDGE_QUOTE_ID fee=$BRIDGE_FEE eta=$BRIDGE_ETA"
```

> **REQUIRED:** Use `AskUserQuestion` before submitting the bridge transaction.
> Show the user:
>
> - Amount: `$(format_token_amount "$BRIDGE_AMOUNT" "$USDC_DECIMALS")` USDC on Base (chain 8453)
> - Destination: `$BRIDGE_TOKEN_OUT` (USDC.e) on Tempo (chain 4217)
> - Bridge fee: `$BRIDGE_FEE`
> - Estimated time: `$BRIDGE_ETA`
> - Recipient on Tempo: `$WALLET_ADDRESS` (funds arrive here; transferred to Tempo wallet in Phase 4B-5)
>
> Do not proceed until the user confirms.
>
> The fee and the estimated time above come from this quote. Showing them and
> then broadcasting a later quote would describe one trade and execute a
> different one. No calldata exists yet at this gate, so bind the quote's own
> identity. Step 4B-3 re-reads that identity from the quote it actually
> submits, which is what makes the comparison mean something:
>
> ```bash
> declare -F bind_approved_quote_preswap >/dev/null || { echo "ERROR: bind_approved_quote_preswap is not defined; paste the helper block above into this block first." >&2; exit 1; }
>
> QUOTE_ID=$(printf '%s' "$BRIDGE_QUOTE" | jq -r '.quote.quoteId')
> QUOTE_BODY=$(printf '%s' "$BRIDGE_QUOTE" | jq -Sc '.quote')
> bind_approved_quote_preswap
> ```
>
> `QUOTE_BODY` is the whole quote, key-sorted so the comparison is stable.
> Every number the user was shown comes out of that object, so a byte-identical
> object is the complete check, and no field name has to be guessed.
>
> **Quote expiration:** Bridge quotes also expire after ~60 seconds. Re-fetch the
> quote (Step 4B-2) if there was any delay before executing. A re-fetch must be
> followed by `assert_quote_terms_unchanged` against the new quote, and by a
> fresh confirmation showing the new fee and estimated time.

### Step 4B-3 — Execute the bridge

```bash
set -euo pipefail

declare -F assert_quote_terms_unchanged >/dev/null || { echo "ERROR: assert_quote_terms_unchanged is not defined; paste the helper block above into this block first." >&2; exit 1; }

BRIDGE_RESPONSE=$(curl -s "https://trade-api.gateway.uniswap.org/v1/swap" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  --data "$(jq -n \
    --argjson quote  "$BRIDGE_QUOTE" \
    --arg walletAddress "$WALLET_ADDRESS" \
    '{quote: $quote.quote, walletAddress: $walletAddress}')")

BRIDGE_TO=$(printf '%s' "$BRIDGE_RESPONSE"   | jq -r '.swap.to')
BRIDGE_DATA=$(printf '%s' "$BRIDGE_RESPONSE" | jq -r '.swap.data')
BRIDGE_VALUE=$(printf '%s' "$BRIDGE_RESPONSE"| jq -r '.swap.value // "0x0"')

# The broadcast target, calldata and msg.value are never taken on trust.
[[ "$BRIDGE_TO" =~ ^0x[a-fA-F0-9]{40}$ ]] || {
  echo "ERROR: bridge swap.to is not an address: $BRIDGE_TO" >&2; exit 1
}
[[ "$BRIDGE_DATA" =~ ^0x[a-fA-F0-9]{8,}$ ]] || {
  echo "ERROR: bridge swap.data is empty or malformed: $BRIDGE_DATA" >&2; exit 1
}
[[ "$BRIDGE_VALUE" =~ ^0[xX][0-9a-fA-F]{1,64}$ ]] || {
  echo "ERROR: bridge swap.value is not a 0x hex value: $BRIDGE_VALUE" >&2; exit 1
}

# Compare against what was approved in Step 4B-2, re-reading from the quote
# object this block is about to submit. Reusing the same shell literals on both
# sides would compare a constant to itself and could never fire.
QUOTE_ID=$(printf '%s' "$BRIDGE_QUOTE" | jq -r '.quote.quoteId')
QUOTE_BODY=$(printf '%s' "$BRIDGE_QUOTE" | jq -Sc '.quote')
assert_quote_terms_unchanged || exit 1
```

No calldata existed at the Step 4B-2 gate, so the bridge transaction itself is
still unapproved at this point. Show the user `$BRIDGE_TO`, `$BRIDGE_VALUE` in
human-readable native units, and the fee and estimated time from the bound
quote, and get an explicit yes through `AskUserQuestion`. On that yes, add the
broadcast triple to the same record:

```bash
set -euo pipefail

declare -F bind_broadcast_tx >/dev/null || { echo "ERROR: bind_broadcast_tx is not defined; paste the helper block above into this block first." >&2; exit 1; }

QUOTE_ID=$(printf '%s' "$BRIDGE_QUOTE" | jq -r '.quote.quoteId')
QUOTE_BODY=$(printf '%s' "$BRIDGE_QUOTE" | jq -Sc '.quote')
QUOTE_SWAP_TO=$(printf '%s' "$BRIDGE_RESPONSE"   | jq -r '.swap.to')
QUOTE_SWAP_DATA=$(printf '%s' "$BRIDGE_RESPONSE" | jq -r '.swap.data')
QUOTE_SWAP_VALUE=$(printf '%s' "$BRIDGE_RESPONSE"| jq -r '.swap.value // "0x0"')
bind_broadcast_tx
```

Then broadcast. The gate runs once more against the objects about to be sent,
and `cast send` takes its arguments from the values the gate compared:

```bash
set -euo pipefail

declare -F assert_quote_terms_unchanged >/dev/null || { echo "ERROR: assert_quote_terms_unchanged is not defined; paste the helper block above into this block first." >&2; exit 1; }
declare -F hex_to_dec >/dev/null || { echo "ERROR: hex_to_dec is not defined; paste the helper block above into this block first." >&2; exit 1; }

QUOTE_ID=$(printf '%s' "$BRIDGE_QUOTE" | jq -r '.quote.quoteId')
QUOTE_BODY=$(printf '%s' "$BRIDGE_QUOTE" | jq -Sc '.quote')
QUOTE_SWAP_TO=$(printf '%s' "$BRIDGE_RESPONSE"   | jq -r '.swap.to')
QUOTE_SWAP_DATA=$(printf '%s' "$BRIDGE_RESPONSE" | jq -r '.swap.data')
QUOTE_SWAP_VALUE=$(printf '%s' "$BRIDGE_RESPONSE"| jq -r '.swap.value // "0x0"')
assert_quote_terms_unchanged || exit 1

# Convert hex value to decimal
BRIDGE_VALUE_DEC=$(hex_to_dec "$QUOTE_SWAP_VALUE") || exit 1

BRIDGE_TX=$(cast send "$QUOTE_SWAP_TO" "$QUOTE_SWAP_DATA" \
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
set -euo pipefail

declare -F uint_lt >/dev/null || { echo "ERROR: uint_lt is not defined; paste the helper block above into this block first." >&2; exit 1; }
declare -F get_token_decimals >/dev/null || { echo "ERROR: get_token_decimals is not defined; paste the helper block from pay-with-any-token/SKILL.md or references/credential-construction.md into this block first." >&2; exit 1; }
declare -F format_token_amount >/dev/null || { echo "ERROR: format_token_amount is not defined; paste the helper block from pay-with-any-token/SKILL.md or references/credential-construction.md into this block first." >&2; exit 1; }

TEMPO_RPC_URL="https://rpc.presto.tempo.xyz"
[[ "$BRIDGE_AMOUNT" =~ ^[0-9]{1,78}$ ]] || { echo "ERROR: non-integer bridge amount: $BRIDGE_AMOUNT" >&2; exit 1; }
# Track successful reads, so a run of RPC failures is not reported as a
# balance that never arrived.
RPC_READ_OK=0
for i in $(seq 1 20); do
  # cast call returns "123456 [1.234e5]" — strip the bracket suffix to get a plain integer
  RAW_BALANCE=$(cast call "$BRIDGE_TOKEN_OUT" \
    "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
    --rpc-url "$TEMPO_RPC_URL" 2>/dev/null) || {
    echo "Balance read failed on attempt $i/20; the Tempo RPC did not answer."
    sleep 30
    continue
  }
  RPC_READ_OK=1
  USDC_E_ON_TEMPO=$(printf '%s' "$RAW_BALANCE" | awk '{print $1}')
  if [[ "$USDC_E_ON_TEMPO" =~ ^[0-9]{1,78}$ ]] && ! uint_lt "$USDC_E_ON_TEMPO" "$BRIDGE_AMOUNT"; then
    USDC_E_DECIMALS=$(get_token_decimals "$BRIDGE_TOKEN_OUT" "$TEMPO_RPC_URL") || exit 1
    USDC_E_HUMAN=$(format_token_amount "$USDC_E_ON_TEMPO" "$USDC_E_DECIMALS") || exit 1
    echo "Bridge confirmed — $USDC_E_HUMAN USDC.e received on Tempo."
    break
  fi
  echo "Waiting for bridge arrival... attempt $i/20 (balance: $USDC_E_ON_TEMPO base units)"
  sleep 30
done
[ "$RPC_READ_OK" = 1 ] || \
  { echo "ERROR: every balance read failed. The Tempo RPC at $TEMPO_RPC_URL did not answer, so the bridge state is unknown. Check $BRIDGE_TX on https://explore.mainnet.tempo.xyz before re-submitting."; exit 1; }
[[ "${USDC_E_ON_TEMPO:-}" =~ ^[0-9]{1,78}$ ]] || \
  { echo "ERROR: bridge polling ended without an integer balance reading. Check $BRIDGE_TX on https://explore.mainnet.tempo.xyz"; exit 1; }
uint_lt "$USDC_E_ON_TEMPO" "$BRIDGE_AMOUNT" && \
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
set -euo pipefail

declare -F get_token_decimals >/dev/null || { echo "ERROR: get_token_decimals is not defined; paste the helper block from pay-with-any-token/SKILL.md or references/credential-construction.md into this block first." >&2; exit 1; }
declare -F format_token_amount >/dev/null || { echo "ERROR: format_token_amount is not defined; paste the helper block from pay-with-any-token/SKILL.md or references/credential-construction.md into this block first." >&2; exit 1; }

if [ "$WALLET_ADDRESS" != "$TEMPO_WALLET_ADDRESS" ]; then
  TRANSFER_DATA=$(cast calldata "transfer(address,uint256)" "$TEMPO_WALLET_ADDRESS" "$BRIDGE_AMOUNT")

  # Show transfer details before sending. Read decimals; never assume 6.
  USDC_E_DECIMALS=$(get_token_decimals "$BRIDGE_TOKEN_OUT" "$TEMPO_RPC_URL") || exit 1
  USDC_E_HUMAN=$(format_token_amount "$BRIDGE_AMOUNT" "$USDC_E_DECIMALS") || exit 1
  # (AskUserQuestion gate handled by the caller — confirm amount + destination before this step)

  # Tempo chain gas estimation is unreliable — always set an explicit gas limit
  TRANSFER_TX=$(cast send "$BRIDGE_TOKEN_OUT" "$TRANSFER_DATA" \
    --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
    --rpc-url "$TEMPO_RPC_URL" \
    --gas-limit 100000 \
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
