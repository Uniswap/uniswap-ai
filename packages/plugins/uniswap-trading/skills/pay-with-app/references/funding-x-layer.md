# Funding USDT0 on X Layer via the Uniswap Trading API

When the wallet lacks the asset required by an APP Pay Per Use 402
challenge, acquire it on X Layer (chain 196) using the Uniswap Trading
API. The API supports both same-chain swaps on X Layer and cross-chain
routing into X Layer (powered by Across).

## Table of Contents

- [Decide the funding target](#decide-the-funding-target)
- [Pick the source chain and token](#pick-the-source-chain-and-token)
- [Phase A: Same-chain swap on X Layer](#phase-a-same-chain-swap-on-x-layer)
- [Phase B: Cross-chain bridge into X Layer](#phase-b-cross-chain-bridge-into-x-layer)
- [Verify the destination balance](#verify-the-destination-balance)

## Decide the Funding Target

| Asset on X Layer      | Recommended?                  | Notes                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USDT0 (`0x779Ded0c…`) | ✅ default                    | Deepest Uniswap v3 liquidity (USDT0/USDG and USDT0/WOKB pools; additional pools at other fee tiers may be deployed, and the Trading API will pick the optimal route across all available pools). Use this if the 402 challenge accepts USDT0.                                                                                                        |
| USDG (`0x4ae46a50…`)  | ✅ supported                  | Reachable via direct Trading API quote, or one-hop USDT0 to USDG.                                                                                                                                                                                                                                                                                    |
| USDC (`0x74b7F163…`)  | ❌ not via Uniswap on X Layer | Trading API does not consistently return routes for USDC swaps on X Layer despite pools at 0.05% and 0.3% existing: TVL is too thin for reliable execution. If the merchant requires USDC, bridge USDC directly from a chain where it is liquid (Base, Arbitrum, Mainnet) using the Trading API rather than attempting a same-chain swap on X Layer. |

> **Default funding target = USDT0.** Override only when the 402
> challenge demands a different specific asset and that asset is funded
> by an entry above with ✅.

## Pick the Source Chain and Token

Inspect the user's ERC-20 holdings across supported source chains and
prefer cheapest gas + deepest liquidity to the destination.

```bash
set -euo pipefail

# USDC on Base (cheapest bridge gas)
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://mainnet.base.org

# USDC on Ethereum
cast call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://eth.llamarpc.com

# Native ETH on Base / Ethereum (use zero address for the swap input)
cast balance "$WALLET_ADDRESS" --rpc-url https://mainnet.base.org
```

Path priority for landing **USDT0** on X Layer:

1. Source already holds USDT0 on X Layer, skip funding entirely.
2. Source holds USDG on X Layer, same-chain swap USDG to USDT0 (Phase
   A, single hop).
3. Source holds USDT0 on a different chain, Phase B cross-chain
   (likely cheapest).
4. Wallet has a stablecoin (USDC) on Base / Arbitrum / Mainnet,
   cross-chain route to USDT0 on X Layer (Phase B).
5. Wallet has native ETH on Base / Mainnet, cross-chain route from
   native (zero address `0x0000000000000000000000000000000000000000`)
   to USDT0 on X Layer (Phase B handles swap + bridge in one quote).
6. Wallet only holds non-USDT0 tokens on X Layer, same-chain swap
   (Phase A).

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

`bind_approved_quote_preswap` and `bind_broadcast_tx` are defined here but not
called by either phase below, which both bind in one step. They are kept so this
file and
[`trading-api-flows.md`](../../pay-with-any-token/references/trading-api-flows.md)
carry the same helper text, and so a future two-step leg on X Layer has them
ready.

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

## Phase A: Same-Chain Swap on X Layer

Use this when the wallet already holds a token on X Layer (e.g. WOKB or
USDG) and needs to convert it to the asset required by the 402
challenge. Skip if the wallet has no relevant tokens on X Layer.

> **Confirmation gate** before approval and before broadcast. The broadcast
> gate needs the target and calldata, so it runs after the `/swap` extraction
> block below, not here.
>
> **Pre-flight: OKB balance check.** Same-chain X Layer swap requires
> OKB for gas. Confirm the wallet has OKB before proceeding:
>
> ```bash
> set -euo pipefail
> OKB_BAL=$(cast balance "$WALLET_ADDRESS" \
>   --rpc-url "${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}")
> # Non-zero OKB sanity check. This does not guarantee enough gas to broadcast
> # a swap; it only catches the common "wallet has literally zero OKB" case.
> # Replace with a real threshold (e.g. 0.001 OKB) if you want to gate on
> # usable gas.
> [ "$OKB_BAL" != "0" ] || {
>   echo "Same-chain X Layer swap requires OKB for gas. Wallet has 0 OKB. Either acquire OKB first, or route entirely cross-chain (Phase B) which only needs source-chain gas." >&2
>   exit 1
> }
> ```

```bash
set -euo pipefail

QUOTE_FETCHED_AT=$(date +%s)
QUOTE=$(curl -fsS -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.1.1" \
  -d "$(jq -n \
    --arg type           "EXACT_OUTPUT" \
    --argjson tokenInChainId  196 \
    --argjson tokenOutChainId 196 \
    --arg tokenIn       "$SOURCE_TOKEN_XLAYER" \
    --arg tokenOut      "$X402_ASSET" \
    --arg amount        "$X402_AMOUNT" \
    --arg swapper       "$WALLET_ADDRESS" \
    '{
      type:             $type,
      tokenInChainId:   $tokenInChainId,
      tokenOutChainId:  $tokenOutChainId,
      tokenIn:          $tokenIn,
      tokenOut:         $tokenOut,
      amount:           $amount,
      swapper:          $swapper,
      urgency:          "normal"
    }')") || { echo "Trading API quote failed" >&2; exit 1; }

# The EXACT_OUTPUT quote decides the input amount. Read it here; nothing
# upstream of this block knows it.
REQUIRED_AMOUNT_IN=$(printf '%s' "$QUOTE" | jq -r '.quote.amountIn')
[[ "$REQUIRED_AMOUNT_IN" =~ ^[0-9]{1,78}$ ]] || {
  echo "ERROR: quote returned a non-integer amountIn: $REQUIRED_AMOUNT_IN" >&2
  exit 1
}
```

Then `check_approval` (only if `tokenIn` is not native), build the
permit signature when required, and call `/swap`. Detailed
`check_approval` + permit + `/swap` flow is identical to the
[`pay-with-any-token`](../../pay-with-any-token/references/trading-api-flows.md)
flow. See that reference and substitute the X Layer chain ID and
addresses.

Store the `/swap` response as `SWAP_RESPONSE`, then extract and validate the
transaction fields, so the summary you show the user names the contract the
transaction will call:

```bash
set -euo pipefail

SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')

[[ "$SWAP_TO" =~ ^0x[a-fA-F0-9]{40}$ ]] || {
  echo "ERROR: swap.to is not an address: $SWAP_TO" >&2; exit 1
}
[[ "$SWAP_DATA" =~ ^0x[a-fA-F0-9]{8,}$ ]] || {
  echo "ERROR: swap.data is empty or malformed: $SWAP_DATA" >&2; exit 1
}
[[ "$SWAP_VALUE" =~ ^0[xX][0-9a-fA-F]{1,64}$ ]] || {
  echo "ERROR: swap.value is not a 0x hex value: $SWAP_VALUE" >&2; exit 1
}
```

Show the user the summary, including `$SWAP_TO` as the contract this
transaction will call. On their yes, run the block below. It re-derives every
recorded value from `$QUOTE` and `$SWAP_RESPONSE`, so it needs nothing carried
over from the extraction block above:

```bash
set -euo pipefail

declare -F bind_approved_quote >/dev/null || { echo "ERROR: bind_approved_quote is not defined; paste the helper block above into this block first." >&2; exit 1; }

QUOTE_BODY=$(printf '%s' "$QUOTE" | jq -Sc '.quote')
QUOTE_AMOUNT_IN=$(printf '%s' "$QUOTE" | jq -r '.quote.amountIn')
QUOTE_SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
QUOTE_SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
QUOTE_SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')
bind_approved_quote
```

`QUOTE_BODY` is the whole quote, key-sorted so the comparison is stable. The
swapper, the destination token and the destination chain all live inside it, so
they are covered without naming a field. `swap.value` is not in the quote, so it
is bound on its own alongside the target and the calldata.

Gate on quote freshness and on the approved terms, then broadcast in the same
block. `cast send` takes every argument from the values the gate just compared;
reading `.swap.to` again would hand it a target the gate never saw.

```bash
set -euo pipefail

declare -F assert_quote_terms_unchanged >/dev/null || { echo "ERROR: assert_quote_terms_unchanged is not defined; paste the helper block above into this block first." >&2; exit 1; }

# The gate must precede the comparison and any `$(( ))`. Bash reads a
# leading-zero value as octal, and accepts a leading `+` and surrounding
# whitespace inside `$(( ))`; the ten-digit ceiling keeps a far-future value out.
[[ "${QUOTE_FETCHED_AT:-}" =~ ^(0|[1-9][0-9]{0,9})$ ]] || { echo "ERROR: QUOTE_FETCHED_AT is not a canonical integer: ${QUOTE_FETCHED_AT:-}" >&2; exit 1; }
ELAPSED=$(($(date +%s) - QUOTE_FETCHED_AT))
# A clock that reads backwards is a reason to refetch, not a reason to proceed:
# a future timestamp makes ELAPSED negative, and a negative is always < 45.
[ "$ELAPSED" -ge 0 ] || {
  echo "QUOTE_FETCHED_AT is in the future; refetch before broadcasting." >&2
  exit 1
}
[ "$ELAPSED" -lt 45 ] || {
  echo "Quote is $ELAPSED seconds old; refetch before broadcasting." >&2
  exit 1
}

# Re-read from the objects about to be broadcast, then compare.
QUOTE_BODY=$(printf '%s' "$QUOTE" | jq -Sc '.quote')
QUOTE_AMOUNT_IN=$(printf '%s' "$QUOTE" | jq -r '.quote.amountIn')
QUOTE_SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
QUOTE_SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
QUOTE_SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')
assert_quote_terms_unchanged || exit 1

# cast send --value takes decimal; the API returns hex. The value is passed as
# argv, never interpolated into the program text.
hex_to_dec() {
  [[ "$1" =~ ^0[xX][0-9a-fA-F]{1,64}$ ]] || { echo "ERROR: not a 0x hex value: $1" >&2; return 1; }
  local out
  out=$(python3 -c 'import sys; print(int(sys.argv[1], 16))' "$1") || {
    echo "ERROR: hex_to_dec could not run python3 for '$1'" >&2; return 1
  }
  [[ "$out" =~ ^[0-9]{1,78}$ ]] || { echo "ERROR: hex_to_dec produced '$out'" >&2; return 1; }
  printf '%s\n' "$out"
}

SWAP_VALUE_DEC=$(hex_to_dec "$QUOTE_SWAP_VALUE") || exit 1

SWAP_TX=$(cast send "$QUOTE_SWAP_TO" "$QUOTE_SWAP_DATA" \
  --value "$SWAP_VALUE_DEC" \
  --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
  --rpc-url "${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}" \
  --json | jq -r '.transactionHash')

SWAP_STATUS=$(cast receipt "$SWAP_TX" \
  --rpc-url "${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}" --json | jq -r '.status')
[ "$SWAP_STATUS" = "0x1" ] || { echo "ERROR: X Layer swap reverted: $SWAP_TX" >&2; exit 1; }
echo "X Layer swap confirmed: $SWAP_TX"
```

## Phase B: Cross-Chain Bridge into X Layer

> **Important: Across coverage gap (verified 2026-04-27).** The Uniswap
> Trading API uses Across Protocol for cross-chain routing. **Across
> does not currently include X Layer (chain 196) in its destination
> list.** Live `/quote` calls with `tokenOutChainId=196` and a different
> `tokenInChainId` return `ResourceNotFound: No quotes available` for
> every source chain we tested (Ethereum, Base, Arbitrum, native ETH).
> Same-chain X Layer swaps (Phase A) work normally.
>
> **What this means for the agent.** Until Across adds X Layer, the
> Trading API cannot bridge tokens onto X Layer in a single quote. If
> the user holds funds on a chain other than X Layer, the cross-chain
> leg must be done through a bridge service that supports X Layer as a
> destination (the user must run that step outside this skill, then
> re-invoke for the same-chain swap + 402 settlement).
>
> **TODO (research before mid-May launch follow-up):** confirm and
> document the recommended X-Layer-supporting bridge for Uniswap+OKX
> co-marketing alignment. Until then, do not prescribe a specific bridge
> service in user-facing responses; surface the limitation honestly and
> let the user choose.

### Source-chain shortfall preflight (REQUIRED before quoting)

Before calling `/quote` or recommending a bridge, **verify the user's
source-chain wallet actually has enough of `SOURCE_TOKEN` to cover the
required output amount plus fees**. The most common funding failure is
not the route, it is the user's source balance: e.g. user has 5 USDC
on Base but the 402 demands 100 USDT0 on X Layer. Recommending "bridge
100.5 USDC from Base" in that situation is wrong; the user does not
have 100.5 USDC to bridge.

```bash
set -euo pipefail

# X402_AMOUNT is in base units of the X Layer DESTINATION asset (e.g.
# USDT0 6 decimals). For a same-decimal source token (USDC also 6), the
# minimum source amount needed is X402_AMOUNT plus buffer. For a
# different-decimal source token, scale appropriately and consult an
# oracle or quote for an estimate. The check below uses the same-decimal
# stablecoin path (USDC -> USDT0, USDG -> USDT0, etc.). For different
# decimals or non-stable source tokens, fetch a price quote first and
# use the input-amount it returns to gate this check.
# Values are passed as argv, never interpolated into the program text.
[[ "$X402_AMOUNT" =~ ^[0-9]{1,78}$ ]] || { echo "bad amount" >&2; exit 1; }
SOURCE_REQUIRED_BASE_UNITS=$(python3 -c 'import sys; print((int(sys.argv[1]) * 1005) // 1000)' "$X402_AMOUNT")

SOURCE_BALANCE=$(cast call "$SOURCE_TOKEN_ADDRESS" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url "$SOURCE_CHAIN_RPC_URL")

# Strip cast's "(uint256)" suffix if present and compare via python (uint256-safe).
SOURCE_BALANCE_RAW=$(echo "$SOURCE_BALANCE" | awk '{print $1}')
[[ "$SOURCE_BALANCE_RAW" =~ ^[0-9]{1,78}$ ]] || { echo "ERROR: balanceOf returned a non-integer: $SOURCE_BALANCE_RAW" >&2; exit 1; }
if ! python3 -c 'import sys; sys.exit(0 if int(sys.argv[1]) >= int(sys.argv[2]) else 1)' \
  "$SOURCE_BALANCE_RAW" "$SOURCE_REQUIRED_BASE_UNITS"; then
  echo "ERROR: source-chain shortfall on $SOURCE_CHAIN_NAME." >&2
  echo "  needed (base units): $SOURCE_REQUIRED_BASE_UNITS" >&2
  echo "  have   (base units): $SOURCE_BALANCE_RAW"          >&2
  echo "Cannot fund the 402 from this source. Ask the user for an"  >&2
  echo "alternative source chain, a smaller payment amount, or to"  >&2
  echo "top up the source wallet first." >&2
  exit 1
fi
```

Refusing here is the correct behavior: a bridge instruction the user
cannot execute is worse than no instruction. If multiple source chains
are available and one has the funds, suggest that one. If none do,
surface the shortfall in plain language and stop, do not auto-pivot
into a different funding plan without re-confirming with the user via
`AskUserQuestion`.

### Quote and bridge

The block below describes the design intent: a single Trading API quote
that handles swap + bridge into X Layer. It is preserved so the skill
works without code changes the day Across adds X Layer. Today, expect
the quote call to return `ResourceNotFound`. When that happens, fall
through to the user-handoff path documented at the end of this section.

Apply a **0.5% buffer** to compute `X402_AMOUNT_WITH_BUFFER` from
`X402_AMOUNT` to absorb bridge fees. If the shortfall is < $5 worth,
top up to $5 to amortize source chain gas.

```bash
set -euo pipefail

# Apply 0.5% buffer (uint256-safe integer math via python).
# The amount is passed as argv, never interpolated into the program text.
[[ "$X402_AMOUNT" =~ ^[0-9]{1,78}$ ]] || { echo "bad amount" >&2; exit 1; }
X402_AMOUNT_WITH_BUFFER=$(python3 -c 'import sys; print((int(sys.argv[1]) * 1005) // 1000)' "$X402_AMOUNT")
[[ "$X402_AMOUNT_WITH_BUFFER" =~ ^[0-9]+$ ]] || { echo "buffer math failed" >&2; exit 1; }

QUOTE_FETCHED_AT=$(date +%s)

# Capture HTTP status and body separately so we can distinguish:
#   (a) HTTP 200 success      -> proceed with the original Phase B flow
#   (b) errorCode=ResourceNotFound (Across coverage gap) -> deferred-bridge handoff
#   (c) network errors / 5xx  -> surface as transient, advise retry
#
# IMPORTANT: do NOT use `curl -f` here. Under `set -e` a non-zero curl
# exit would terminate the script before we read $? into QUOTE_HTTP_STATUS,
# making the deferred-bridge branch unreachable on the exact failure
# path it is designed to handle. We capture status with `-w` instead.
QUOTE_RESPONSE_FILE=$(mktemp)
trap 'rm -f "$QUOTE_RESPONSE_FILE"' EXIT

QUOTE_HTTP_STATUS=$(curl -sS -X POST https://trade-api.gateway.uniswap.org/v1/quote \
  -o "$QUOTE_RESPONSE_FILE" \
  -w '%{http_code}' \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.1.1" \
  -d "$(jq -n \
    --arg type           "EXACT_OUTPUT" \
    --argjson tokenInChainId  "$SOURCE_CHAIN_ID" \
    --argjson tokenOutChainId 196 \
    --arg tokenIn       "$SOURCE_TOKEN" \
    --arg tokenOut      "$X402_ASSET" \
    --arg amount        "$X402_AMOUNT_WITH_BUFFER" \
    --arg swapper       "$WALLET_ADDRESS" \
    '{
      type:             $type,
      tokenInChainId:   $tokenInChainId,
      tokenOutChainId:  $tokenOutChainId,
      tokenIn:          $tokenIn,
      tokenOut:         $tokenOut,
      amount:           $amount,
      swapper:          $swapper,
      urgency:          "normal"
    }')") || {
  # curl itself failed (DNS, TLS, network unreachable, etc.) -> case (c)
  echo "ERROR: Trading API call failed at the network layer (curl exit \$? = $?)." >&2
  echo "This is most likely a transient connectivity issue (DNS, TLS, network)." >&2
  echo "Advise the user to retry; do NOT route them to an external bridge for this case." >&2
  exit 1
}

QUOTE=$(cat "$QUOTE_RESPONSE_FILE")
QUOTE_ERROR_CODE=$(printf '%s' "$QUOTE" | jq -r '.errorCode // empty' 2>/dev/null || echo "")
```

Branch on the result:

```bash
set -euo pipefail

if [ "$QUOTE_HTTP_STATUS" = "200" ] && [ -z "$QUOTE_ERROR_CODE" ]; then
  : # success -> continue with permitData + /swap on the source chain
elif [ "$QUOTE_ERROR_CODE" = "ResourceNotFound" ]; then
  : # case (b): the deferred-bridge handoff below
elif [ "$QUOTE_HTTP_STATUS" -ge 500 ] 2>/dev/null; then
  echo "ERROR: Trading API returned HTTP $QUOTE_HTTP_STATUS (server error)." >&2
  echo "This is most likely transient. Advise the user to retry shortly." >&2
  exit 1
else
  echo "ERROR: Trading API returned HTTP $QUOTE_HTTP_STATUS, errorCode=$QUOTE_ERROR_CODE." >&2
  echo "Body: $QUOTE" >&2
  echo "Surface raw body to the user; do not route to an external bridge automatically." >&2
  exit 1
fi
```

If `errorCode` is `ResourceNotFound`, **the Trading API cannot currently
deliver to X Layer cross-chain.** This is the expected state today
(Across does not list X Layer as a destination). Surface a clear
message to the user via `AskUserQuestion`:

> "The Uniswap Trading API does not currently support X Layer as a
> cross-chain destination via Across Protocol (verified
> 2026-04-27). To pay this APP merchant, please bridge USDT0 (or
> another stablecoin that lands as USDT0 on X Layer) to your wallet
> using a bridge service that supports X Layer destinations. Once
> the funds arrive on X Layer, re-invoke this skill and we will
> handle the same-chain swap (if needed) and the 402 settlement."

Do NOT recommend a specific bridge product to the user in this skill
version; the v1.0.0 stance is "any bridge that supports X Layer is
fine; pick what you trust." A future skill version may add a
co-marketing-aligned bridge recommendation once verified.

If the quote call DOES succeed (i.e. Across has shipped X Layer
support since this doc was written), continue with the original flow:
quote response contains `permitData` (sign with EIP-712), the `/swap`
endpoint returns the calldata to broadcast on the source chain, and
Across handles the X Layer arrival.

Call `/swap`, store the response as `SWAP_RESPONSE`, then extract and validate
the transaction fields, so the summary you show the user names the contract the
transaction will call:

```bash
set -euo pipefail

SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')

[[ "$SWAP_TO" =~ ^0x[a-fA-F0-9]{40}$ ]] || {
  echo "ERROR: swap.to is not an address: $SWAP_TO" >&2; exit 1
}
[[ "$SWAP_DATA" =~ ^0x[a-fA-F0-9]{8,}$ ]] || {
  echo "ERROR: swap.data is empty or malformed: $SWAP_DATA" >&2; exit 1
}
[[ "$SWAP_VALUE" =~ ^0[xX][0-9a-fA-F]{1,64}$ ]] || {
  echo "ERROR: swap.value is not a 0x hex value: $SWAP_VALUE" >&2; exit 1
}
```

Confirm the bridge with the user, showing `$SWAP_TO` as the contract this
transaction will call. On their yes, run the block below. It re-derives every
recorded value from `$QUOTE` and `$SWAP_RESPONSE`:

```bash
set -euo pipefail

declare -F bind_approved_quote >/dev/null || { echo "ERROR: bind_approved_quote is not defined; paste the helper block above into this block first." >&2; exit 1; }

QUOTE_BODY=$(printf '%s' "$QUOTE" | jq -Sc '.quote')
QUOTE_AMOUNT_IN=$(printf '%s' "$QUOTE" | jq -r '.quote.amountIn')
QUOTE_SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
QUOTE_SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
QUOTE_SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')
bind_approved_quote
```

Gate on quote freshness and on the approved terms, then broadcast in the same
block. `cast send` takes every argument from the values the gate just compared;
reading `.swap.to` again would hand it a target the gate never saw.

```bash
set -euo pipefail

declare -F assert_quote_terms_unchanged >/dev/null || { echo "ERROR: assert_quote_terms_unchanged is not defined; paste the helper block above into this block first." >&2; exit 1; }

# The gate must precede the comparison and any `$(( ))`. Bash reads a
# leading-zero value as octal, and accepts a leading `+` and surrounding
# whitespace inside `$(( ))`; the ten-digit ceiling keeps a far-future value out.
[[ "${QUOTE_FETCHED_AT:-}" =~ ^(0|[1-9][0-9]{0,9})$ ]] || { echo "ERROR: QUOTE_FETCHED_AT is not a canonical integer: ${QUOTE_FETCHED_AT:-}" >&2; exit 1; }
ELAPSED=$(($(date +%s) - QUOTE_FETCHED_AT))
# A clock that reads backwards is a reason to refetch, not a reason to proceed:
# a future timestamp makes ELAPSED negative, and a negative is always < 45.
[ "$ELAPSED" -ge 0 ] || {
  echo "QUOTE_FETCHED_AT is in the future; refetch before broadcasting." >&2
  exit 1
}
[ "$ELAPSED" -lt 45 ] || {
  echo "Quote is $ELAPSED seconds old; refetch before broadcasting." >&2
  exit 1
}

# Re-read from the objects about to be broadcast, then compare.
QUOTE_BODY=$(printf '%s' "$QUOTE" | jq -Sc '.quote')
QUOTE_AMOUNT_IN=$(printf '%s' "$QUOTE" | jq -r '.quote.amountIn')
QUOTE_SWAP_TO=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.to')
QUOTE_SWAP_DATA=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.data')
QUOTE_SWAP_VALUE=$(printf '%s' "$SWAP_RESPONSE" | jq -r '.swap.value // "0x0"')
assert_quote_terms_unchanged || exit 1

# cast send --value takes decimal; the API returns hex. The value is passed as
# argv, never interpolated into the program text.
hex_to_dec() {
  [[ "$1" =~ ^0[xX][0-9a-fA-F]{1,64}$ ]] || { echo "ERROR: not a 0x hex value: $1" >&2; return 1; }
  local out
  out=$(python3 -c 'import sys; print(int(sys.argv[1], 16))' "$1") || {
    echo "ERROR: hex_to_dec could not run python3 for '$1'" >&2; return 1
  }
  [[ "$out" =~ ^[0-9]{1,78}$ ]] || { echo "ERROR: hex_to_dec produced '$out'" >&2; return 1; }
  printf '%s\n' "$out"
}

BRIDGE_VALUE_DEC=$(hex_to_dec "$QUOTE_SWAP_VALUE") || exit 1

SOURCE_TX_HASH=$(cast send "$QUOTE_SWAP_TO" "$QUOTE_SWAP_DATA" \
  --value "$BRIDGE_VALUE_DEC" \
  --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
  --rpc-url "$SOURCE_CHAIN_RPC_URL" \
  --json | jq -r '.transactionHash')

[[ "$SOURCE_TX_HASH" =~ ^0x[a-fA-F0-9]{64}$ ]] || {
  echo "ERROR: no tx hash from the source-chain broadcast" >&2
  exit 1
}
SOURCE_TX_STATUS=$(cast receipt "$SOURCE_TX_HASH" --rpc-url "$SOURCE_CHAIN_RPC_URL" --json | jq -r '.status')
[ "$SOURCE_TX_STATUS" = "0x1" ] || { echo "ERROR: bridge tx reverted: $SOURCE_TX_HASH" >&2; exit 1; }
echo "Bridge submitted: $SOURCE_TX_HASH"
```

> **Bridge recipient.** The Trading API delivers funds to the same
> `swapper` address on chain 196. If the user wants the funds at a
> different X Layer address (e.g. an OKX Agentic Wallet they custody
> separately), an extra transfer transaction on X Layer is required
> after the bridge confirms.
>
> **Quotes expire in ~60 seconds.** Re-fetch if any delay before
> broadcast (the freshness gate above enforces a 45s ceiling).
>
> **Retry hygiene.** On any retry of the quote-then-broadcast cycle,
> re-derive both `QUOTE_FETCHED_AT` (the freshness timestamp) and
> `X402_AMOUNT_WITH_BUFFER` (the buffered output amount) from the new
> quote. Reusing stale values from an earlier attempt will either trip
> the freshness gate or quote against an outdated buffer.
>
> Do not call `bind_approved_quote` again on a retry. The recorded directory
> holds what the user agreed to, and a retry must be measured against it. Set the
> `QUOTE_*` variables from the new quote, run `assert_quote_terms_unchanged`
> before broadcasting, and refuse the retry if it reports a change. A genuinely
> refreshed quote will report a change, because it carries new calldata. Take the
> user back through the confirmation gate with the new numbers, call
> `release_approved_quote`, and bind the new quote.

## Verify the Destination Balance

After the bridge or same-chain swap completes, poll for the asset
arrival on X Layer before returning to the EIP-3009 signing step. The
loop tolerates transient RPC failures and validates that the returned
balance is a non-negative integer.

If after 10 minutes the wallet still has insufficient `$X402_ASSET`,
the funds may have arrived at a different token address (rare for
current Across paths to X Layer) or the bridge may have failed.
Surface the ambiguity to the user with the source-chain tx hash and
the Across explorer link, and ask them to verify on-chain. v1.0.0
does not auto-detect alternate-token arrival on X Layer.

```bash
set -euo pipefail

declare -F uint_lt >/dev/null || { echo "ERROR: uint_lt is not defined; paste the helper block above into this block first." >&2; exit 1; }

# Assert prerequisites are set. SOURCE_TX_HASH must have been captured
# from the /swap response before entering the polling loop.
: "${SOURCE_TX_HASH:?missing, capture from /swap response before polling}"
: "${X402_ASSET:?missing}"
: "${X402_AMOUNT:?missing}"
: "${WALLET_ADDRESS:?missing}"

# Track successful RPC reads so we can distinguish "20 RPC failures" from
# "20 successful reads, all under target" at the end.
RPC_SUCCESS_COUNT=0

for i in {1..20}; do
  # cast call returns "123456 [1.234e5]"; strip the suffix before the gate reads it.
  XLAYER_BAL=$(cast call "$X402_ASSET" \
    "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
    --rpc-url "${X_LAYER_RPC_URL:-https://rpc.xlayer.tech}" | awk '{print $1}') || {
    echo "RPC failure on attempt $i, retrying..." >&2
    sleep 5
    continue
  }
  [[ "$XLAYER_BAL" =~ ^[0-9]{1,78}$ ]] || {
    echo "Non-integer balance: $XLAYER_BAL" >&2
    sleep 5
    continue
  }
  RPC_SUCCESS_COUNT=$((RPC_SUCCESS_COUNT + 1))
  if ! uint_lt "$XLAYER_BAL" "$X402_AMOUNT"; then
    echo "Funded. Balance: $XLAYER_BAL"
    break
  fi

  echo "Waiting for arrival... attempt $i/20 (balance: $XLAYER_BAL base units)"
  sleep 30
done

# If every attempt was an RPC failure, surface that distinctly before the
# generic "no usable balance" check below.
[ "$RPC_SUCCESS_COUNT" -gt 0 ] || {
  echo "ERROR: all 20 attempts were RPC failures; bridge state unknown." >&2
  echo "Source tx: $SOURCE_TX_HASH. Check https://app.across.to/transactions before re-submitting." >&2
  exit 1
}

# Assert we have a usable balance reading. No `:-0` defaults here, those
# would defeat `set -u` and silently coerce a missing read into "below
# target".
[[ -n "${XLAYER_BAL:-}" && "$XLAYER_BAL" =~ ^[0-9]{1,78}$ ]] || {
  echo "ERROR: bridge polling completed without a successful RPC read." >&2
  echo "20 RPC failures or non-integer responses; cannot determine arrival state." >&2
  echo "Source tx: $SOURCE_TX_HASH. Check https://app.across.to/transactions before re-submitting." >&2
  exit 1
}

if uint_lt "$XLAYER_BAL" "$X402_AMOUNT"; then
  echo "Bridge not confirmed after 10 minutes. Wallet still holds $XLAYER_BAL of $X402_ASSET on X Layer (need $X402_AMOUNT)." >&2
  echo "Source tx: $SOURCE_TX_HASH." >&2
  echo "The funds may have arrived at a different token address (rare for current Across paths to X Layer) or the bridge may have failed." >&2
  echo "Verify on-chain via https://app.across.to/transactions and https://www.oklink.com/x-layer/address/$WALLET_ADDRESS before re-submitting." >&2
  exit 1
fi
```

Once funded, return to
[`app-x402-flow.md`](app-x402-flow.md) to sign the EIP-3009
authorization and retry the original request.

> **Retry target URL.** When the funding flow ends and we return to
> the EIP-3009 signing in `app-x402-flow.md`, the URL to retry is
> `accepts[].resource` if present in the original 402 challenge,
> otherwise the original request URL.
