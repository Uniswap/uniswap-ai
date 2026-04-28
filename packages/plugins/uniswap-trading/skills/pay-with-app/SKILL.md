---
name: pay-with-app
description: >
  Pay HTTP 402 payment challenges issued by OKX's Agent Payments Protocol
  (APP) on X Layer using tokens from any chain via the Uniswap Trading API.
  Use this skill whenever the user encounters a 402 challenge whose network
  resolves to X Layer (chain 196), mentions "APP", "Agent Payments
  Protocol", "OKX agent payment", "OKX Onchain OS", "OKX agentic wallet",
  "x402 on X Layer", "USDT0", "x42", "Instant Payment", "Batch Payment",
  "pay for X Layer API", or wants to pay an OKX-backed merchant. Even when
  the user does not explicitly say APP, prefer this skill for any 402
  challenge whose network resolves to X Layer (chain 196). For 402
  challenges on other chains (Ethereum, Base, Arbitrum, Tempo) use
  pay-with-any-token instead.
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), Bash(openssl:*), Bash(npx:*), Bash(node:*), WebFetch, AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# Pay With APP (OKX Agent Payments Protocol on X Layer)

Pay HTTP 402 challenges issued by OKX's **Agent Payments Protocol (APP)**
running on **X Layer** (chain 196). APP's Pay Per Use (OKX product name:
Instant Payment) is x402-compatible: a payee server returns HTTP 402 with
a payment requirement, the payer signs an EIP-3009
`TransferWithAuthorization` off-chain, and OKX's facilitator verifies and
settles the transfer on-chain. Settlement is zero-gas to the payer on X
Layer.

This skill handles the full happy path:

1. Detect a 402 challenge whose network resolves to X Layer (chain 196)
2. Verify the payer wallet has the requested asset (typically USDT0)
3. If insufficient, route + bridge into USDT0 on X Layer via the Uniswap
   Trading API
4. Sign the EIP-3009 authorization
5. Construct the `X-PAYMENT` payload and retry the original request

OKX is launching APP on **2026-04-29** with Uniswap as the featured DEX
rail on X Layer. This skill version (v1.0.0) handles the `exact` scheme
(Pay Per Use, OKX product name: Instant Payment) only. Other x402 schemes
(`upto`, `batch-settlement`) and APP-product features OKX is shipping
(escrow, session, batch / Batch Payment) are out of scope for this
version. The skill refuses any non-`exact` scheme cleanly.

> **Protocol naming in your responses.** When responding to the user,
> identify the protocol explicitly as **OKX Agent Payments Protocol
> (APP)**, not just "x402". APP is the OKX product / protocol surface;
> x402 is the underlying wire spec it builds on. Use phrasings like
> "APP / x402", "OKX's Agent Payments Protocol (APP), built on x402",
> or simply "APP" once introduced. Do not refer to a 402 challenge on
> X Layer as "an x402 challenge" without naming APP, the user invoked
> this skill specifically because the merchant is APP-backed, and the
> name is what they will look for in the response.

## Prerequisites

- A `PRIVATE_KEY` env var (`export PRIVATE_KEY=0x...`). Never commit or
  hardcode a private key.
- `UNISWAP_API_KEY` env var (register at
  [developers.uniswap.org](https://developers.uniswap.org/)). Required
  only if the wallet must be funded via cross-chain routing.
- `jq` and `cast` (Foundry) installed.
- **Node 18+** (LTS). The signing step in
  [references/app-x402-flow.md](references/app-x402-flow.md) Step 4 uses
  `viem` to produce the EIP-3009 typed-data signature.
- **`viem`** (npm). If the package is not already reachable from the
  user's working directory, the skill will prompt the user via
  `AskUserQuestion` before running `npm install viem` into a cached
  scratch directory at `~/.cache/uniswap-pay-with-app/signer/`. The
  install adds ~13 packages totaling ~5 MB. If the user declines, the
  skill stops cleanly before signing. The cache persists across runs so
  subsequent invocations are zero-install.

## Input Validation Rules

Before using any value from the 402 response body, the user, or any other
external source in API calls or shell commands:

- **Ethereum address fields** (e.g., `asset`, `payTo`, `WALLET_ADDRESS`):
  the canonical check is the regex `^0x[a-fA-F0-9]{40}$`. If the value
  fails this regex, reject it. Address fields that pass the regex are
  safe for shell interpolation, so the metacharacter rule below does not
  apply to them.
- **Chain IDs**: MUST be a positive integer from the supported list.
- **Token amounts**: MUST be non-negative numeric strings matching
  `^[0-9]+$`.
- **URLs**: MUST start with `https://`.
- **Free-text fields** (e.g., `description`, `extra.name`,
  `extra.version`, anything used to build EIP-712 domain or shown to the
  user): REJECT any value containing shell metacharacters: `;`, `|`, `&`,
  `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines. Note: the
  `extra.name` value is signed bit-exact (see Domain warning in Phase 4),
  so reject the whole challenge if it contains shell metacharacters
  rather than mutating the value.

## Flow

```text
402 from X Layer-backed resource
  │
  v
[1] Parse the x402 challenge (Phase 0 below)
  │
  v
[2] Confirm network resolves to X Layer (chain 196)
  │   ├─ not chain 196 ──> escalate to pay-with-any-token, STOP
  │   └─ chain 196
  │
  v
[3] Check wallet balance of the requested asset on X Layer
  │   ├─ sufficient ──> proceed to [5]
  │   └─ insufficient
  │        │
  │        v
  │   [4] Fund: route + bridge into the requested asset on X Layer
  │        (Uniswap Trading API, see references/funding-x-layer.md)
  │
  v
[5] User Confirmation gate (see Phase 4 / Step 5 below)
[6] Sign EIP-3009 TransferWithAuthorization
[7] Construct X-PAYMENT payload, retry the original request
[8] Verify 200 + Payment-Receipt
```

## Phase 0, Parse the 402 Challenge

The x402 challenge is JSON in the response body. Extract:

- `x402Version`, confirms x402 protocol version.
- `accepts[].scheme`, only `"exact"` is supported in v1.0.0.
- `accepts[].network`, accept `"x-layer"` / `"xlayer"` / `"eip155:196"` /
  `196`.
- `accepts[].maxAmountRequired`, base units of the asset. Must match
  `^[0-9]+$` AND be **strictly greater than zero**. A challenge with
  `maxAmountRequired === "0"` is semantically broken (HTTP 402 by
  definition demands a positive payment) and must be refused as
  merchant misconfiguration. Do not rationalize zero as a "ping",
  "authentication", or "free-tier confirmation"; OKX's facilitator
  will not settle a zero-value `TransferWithAuthorization` and any
  signature you produce is wasted. Surface this to the user and stop.
- `accepts[].asset`, token contract on X Layer.
- `accepts[].payTo`, recipient address.
- `accepts[].resource`, the URL the facilitator binds the payment to.
  Extract this when present. Use it as the retry target. If the field is
  absent, fall back to the original request URL.
- `accepts[].extra.name` and `accepts[].extra.version`, EIP-712 domain
  values for the asset.
- `accepts[].maxTimeoutSeconds`, used for `validBefore`.

> **x402Version gate.** Confirm `x402Version === 1` immediately after
> parsing. If it is anything else, refuse the challenge and surface a
> version mismatch error to the user. v1.0.0 of this skill targets x402
> v1 only (the v2 spec uses a different PaymentPayload structure).
>
> **Scheme gate.** Confirm `accepts[].scheme === "exact"`. The x402 spec
> defines `exact`, `upto`, and `batch-settlement` schemes. v1.0.0 of this
> skill supports `exact` only. If the chosen entry uses any other scheme,
> refuse cleanly. (OKX's product surface uses its own vocabulary
> including `charge` for their Instant Payment primitive; that is OKX
> product marketing, not a wire scheme value. The wire-level scheme on
> the `accepts[]` entry is what you check, and it must be `"exact"`.)

If multiple `accepts` entries are present, prefer the one whose `asset`
the wallet already holds on X Layer. If multiple options are equally
viable, prefer USDT0 (deepest Uniswap funding-flow liquidity).

**WOKB / native OKB likely not eligible as APP settlement assets.** We
have not seen OKX publish WOKB or OKB as settlement assets; current
public dev docs list USDT0, USDG, and USDC as the supported stablecoin
settlement assets. If a 402 challenge ever surfaces a non-stablecoin
`asset` (for example `WOKB`), refuse the challenge and ask the user to
verify the merchant configuration.

## Phase 1, Confirm Network is X Layer

```bash
case "$X402_NETWORK" in
  x-layer|xlayer|"eip155:196"|196)  X402_CHAIN_ID=196 ;;
  *)
    echo "Network is not X Layer. Use pay-with-any-token instead."
    exit 1
    ;;
esac
```

> If the network is not X Layer, **stop** and escalate to the
> `pay-with-any-token` skill, which handles 402 challenges on Ethereum,
> Base, Arbitrum, Tempo, and the other chains the Trading API supports.

## Phase 2, Check Wallet Balance on X Layer

> **REQUIRED:** You must have the user's source wallet address. Use
> `AskUserQuestion` if not provided. Store as `WALLET_ADDRESS`.

```bash
ASSET_BALANCE=$(cast call "$X402_ASSET" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://rpc.xlayer.tech)

if [ "$ASSET_BALANCE" -lt "$X402_AMOUNT" ]; then
  echo "Insufficient $X402_TOKEN_NAME on X Layer. Funding required."
  # Proceed to Phase 3 (funding)
fi
```

## Phase 3, Fund USDT0 on X Layer (only if needed)

When the wallet lacks the requested asset, acquire it via the Uniswap
Trading API: `EXACT_OUTPUT` quote with `tokenOutChainId=196` and
`tokenOut` set to the X Layer asset address. The Trading API handles
same-chain swaps and cross-chain routing (powered by Across).

> **Across coverage gap (verified 2026-04-27).** Across Protocol does
> not currently list X Layer (chain 196) as a supported destination. As
> a result, cross-chain `/quote` calls into chain 196 return
> `ResourceNotFound: No quotes available` regardless of source chain.
> Same-chain X Layer swaps (Phase A in `references/funding-x-layer.md`)
> are unaffected and work normally.
>
> **What this means for the agent in v1.0.0.** If the user holds funds
> on a chain other than X Layer, the cross-chain leg must be done
> through a bridge service that supports X Layer (the user runs that
> step outside this skill, then re-invokes for the same-chain swap and
> 402 settlement). Surface this honestly to the user, do not
> recommend a specific bridge product (TODO: research and document a
> co-marketing-aligned bridge recommendation in a follow-up).
>
> **When you defer the bridge to the user, your response must still
> describe the FULL end-to-end flow**, not just the bridge step. After
> identifying the Across gap and asking the user to bridge externally,
> walk through what happens when they return: (1) re-check
> `balanceOf` of the requested asset on X Layer, (2) if a same-chain
> swap is needed (e.g. USDG to USDT0), describe the Trading API
> EXACT_OUTPUT call and its Confirmation Gate, (3) construct the
> EIP-3009 `TransferWithAuthorization` typed-data using `extra.name`
> and `extra.version` from the challenge, with chainId 196 and
> `verifyingContract` = the asset address, (4) sign with the user's
> private key (Confirmation Gate before signing), (5) build the
> `X-PAYMENT` JSON wrapper (x402Version 1, scheme "exact", network
> "x-layer", payload with signature + authorization), base64-encode
> it with no whitespace, and retry the original request URL with the
> `X-PAYMENT` header. Showing the full plan up front lets the user
> see what they are committing to before they leave the skill, even
> though signing happens after they return.

**Default funding target = USDT0.** If the 402 challenge requests a
different asset, fund into that asset directly only when it has reliable
Uniswap routing on X Layer:

| Asset | Address                                      | Decimals | Funding                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | -------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USDT0 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | 6        | ✅ Direct via Trading API                                                                                                                                                                                                                                                                                                                                                          |
| USDG  | `0x4ae46a509F6b1D9056937BA4500cb143933D2dc8` | 6        | ✅ Direct, or one-hop USDT0 to USDG                                                                                                                                                                                                                                                                                                                                                |
| USDC  | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` | 6        | ⏳ No reliable Uniswap v3 routing on X Layer. The Trading API does not consistently return routes for USDC swaps on X Layer; available pool liquidity is too thin for reliable execution. If the merchant requires USDC, bridge USDC directly from a chain where it is liquid (Base, Arbitrum, Mainnet) using the Trading API rather than attempting a same-chain swap on X Layer. |

Detailed scripts and parameters: see
[references/funding-x-layer.md](references/funding-x-layer.md).

> **Bridge buffer.** Apply a 0.5% buffer to account for bridge fees.
> Quotes expire in ~60 seconds, re-fetch if any delay before broadcast.
>
> **Minimum bridge recommendation.** If the shortfall is < $5, top up to
> $5 to amortize bridge gas on the source chain.

### Gas and Routing Caveats

Surface these to the user before proceeding to fund, and **call
`AskUserQuestion`** (not an echoed bash prompt) before acting if any
apply:

- **OKB on X Layer for same-chain swaps.** OKX gas-sponsors only the
  facilitator's settlement transfer. Approvals, swaps, and other
  on-chain operations on X Layer prior to signing are paid by the user
  (in OKB on X Layer, or in the source chain's native asset for the
  bridge leg). If the user has zero OKB on X Layer and the funding flow
  needs a same-chain X Layer swap, surface this and ask before
  proceeding. Until OKX confirms a broader gas-sponsorship policy,
  assume only the final settlement transfer is sponsored.
- **Bridge destination token.** If the wallet still lacks
  `$X402_ASSET` after the funding flow's polling loop completes,
  surface the source-chain tx hash and the Across explorer link to the
  user. The bridge may have delivered a different variant on X Layer
  (rare for current Across paths) or may have failed. v1.0.0 does not
  auto-detect alternate-token arrival; the user must verify on-chain.

## Phase 4, EIP-3009 Signing and X-PAYMENT Submission

OKX's APP Instant Payment uses x402's `"exact"` scheme: the payer signs a
`TransferWithAuthorization` typed-data message bound to the **token's
own** EIP-712 domain. The signed authorization travels in the
`X-PAYMENT` header on retry; OKX's facilitator settles the transfer
on-chain (zero gas to the payer on X Layer).

### Step 5, User Confirmation

**Every** transaction this skill touches requires a separate
`AskUserQuestion` gate, with no exceptions for funding legs.
"Funding" is not a single transaction; it is several, and each one is
its own gate. The required gates, in order they typically fire:

1. **Source-chain ERC-20 approval** to Permit2 / Universal Router (only
   if `tokenIn` is not native and the allowance is insufficient).
2. **Same-chain swap** on the source chain (e.g. UNI to USDC on
   Ethereum), if the funding plan includes a source-chain leg.
3. **Bridge submission** to the cross-chain rail (Across, OKX bridge,
   etc.). When the bridge step is user-initiated outside this skill,
   the gate becomes "are you ready to leave the skill, run the bridge,
   and re-invoke once funds land on X Layer?".
4. **Same-chain swap on X Layer** (e.g. USDG to USDT0), if the funding
   plan includes a destination-chain leg.
5. **EIP-3009 `TransferWithAuthorization` signature** for the 402
   settlement.

Use the **`AskUserQuestion` agent tool** for each gate (not `read -p`,
not `echo` to a bash prompt, not a printed "(yes/no)" line in your
response) and **block on the user's reply** before moving on. The
summary you present at every gate must cover:

- Action (approve, swap, bridge, sign EIP-3009 authorization).
- Amount and token (input AND output amounts for swaps and bridges).
- Source chain and destination chain (where they differ).
- Recipient (`payTo` for the EIP-3009 step).
- Resource URL the payment is bound to.
- Estimated gas (where applicable).

> **Common failure mode.** When describing a multi-step funding plan
> in your response, do NOT collapse multiple transactions into a
> single confirmation question like "Proceed with funding and
> payment?". Each transaction needs its own gate at the moment it is
> about to fire. A consolidated upfront "yes" is not consent for
> later transactions; the user has not seen the live amounts, gas,
> and recipient at the time those transactions execute.

Obtain explicit confirmation per gate. Each gate is independent.
**Never** auto-submit even if the user previously pre-authorized the
session, the call, or the wallet. A "yes" earlier in the flow does
not carry forward, and a "yes" to a multi-step plan is not a "yes" to
the individual transactions inside it.

> **What a correct gate looks like in your response.** Whether you are
> executing the skill in real time or describing a plan in text, every
> transaction step MUST appear as its own labelled "Confirmation Gate"
> block, with both the structured summary and an explicit
> `AskUserQuestion` invocation. Reproduce this template literally for
> each gate. Do not collapse the gate into a single line. Do not
> describe the gate in passive voice ("we will confirm before
> signing"). Show the gate as a discrete action.
>
> **Template (use for every gate, even when there is only one):**
>
> ```text
> ### Confirmation Gate N: <Action name>
>
> | Field        | Value                                    |
> | ------------ | ---------------------------------------- |
> | Action       | <approve / swap / bridge / sign EIP-3009>|
> | Amount in    | <amount + symbol on source chain>        |
> | Amount out   | <amount + symbol on destination chain>   |
> | Source chain | <chain name + id>                        |
> | Dest chain   | <chain name + id>                        |
> | Recipient    | <address>                                |
> | Resource URL | <url the payment is bound to>            |
> | Est. gas     | <amount + token>                         |
>
> Then call AskUserQuestion("Proceed with <action>?")
> and BLOCK on the user's reply. If anything other than an explicit
> "yes", stop and report.
> ```
>
> A response that only lists fields without the
> `AskUserQuestion("Proceed?") + block` step is not a gate, even if it
> looks comprehensive. The model's natural inclination is to summarize
> and continue; resist that inclination, name the gate, and stop.

<!-- markdownlint-disable-next-line -->

> **What does NOT count as a confirmation gate.** Emitting a bash script
> that prints `"⚠️ CONFIRMATION REQUIRED"` and `"(yes/no)"` to stdout and
> then continues with `echo "Signing..."` is **not** a gate, because the
> script proceeds regardless of user input. A correct gate uses the
> `AskUserQuestion` tool (or, if the user explicitly opts into shell-only
> mode, an actual blocking `read -p` followed by an explicit `yes`/`no`
> branch in the script). When in doubt, prefer `AskUserQuestion`.

<!-- markdownlint-disable-next-line -->

> **Shared-wallet race.** If the wallet is shared (for example, multiple
> agents running concurrently against the same key), the balance can be
> drained between balance check and submit. Re-check `balanceOf` at the
> moment of confirmation as well.

### Step 6, Sign and Submit

Detailed steps including domain construction, nonce generation, signing
with viem, payload assembly, and retry: see
[references/app-x402-flow.md](references/app-x402-flow.md). On retry,
target the URL from `accepts[].resource` if it was present in the
challenge, otherwise the original request URL.

> **Domain warning.** `verifyingContract` is the **token contract**, not
> a separate verifier. Use `name` and `version` from the challenge's
> `extra` field, do not assume defaults. Different tokens have different
> domain values. An incorrect domain produces a signature the
> facilitator will reject with another 402.
>
> **Bit-exact UTF-8 for `extra.name`.** The EIP-712 domain hash is
> byte-exact. The `name` field in `extra` must be passed through
> unchanged from the challenge bytes. Do not normalize it, do not
> lowercase it, do not substitute ASCII `T` (U+0054) for Unicode `₮`
> (U+20AE), do not collapse Unicode forms (NFC vs NFD). For example, a
> challenge that returns `"USD₮0"` must be signed as `"USD₮0"`; reading
> it as `"USDT0"` will produce a signature the facilitator rejects with
> another 402. Pass the raw bytes of `extra.name` straight into the
> EIP-712 domain.

## Error Handling

| Situation                                           | Action                                                                                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 402 challenge has no `network` field                | Inspect challenge body; if `chainId` resolves to 196 use this skill, otherwise escalate to `pay-with-any-token`                                                                                                         |
| Network is not chain 196                            | Escalate to `pay-with-any-token`                                                                                                                                                                                        |
| `x402Version !== 1`                                 | Refuse cleanly; surface a version mismatch error. v1.0.0 of this skill targets x402 v1 only.                                                                                                                            |
| `accepts[].scheme !== "exact"`                      | Refuse cleanly; v1.0.0 supports the `exact` scheme only. Other x402 schemes (`upto`, `batch-settlement`) are out of scope.                                                                                              |
| `accepts[].maxAmountRequired === "0"`               | Refuse cleanly as merchant misconfiguration. HTTP 402 demands a positive payment; OKX's facilitator will not settle a zero-value transfer. Do not sign and do not rationalize zero as a ping, auth check, or free tier. |
| APP requests USDC on X Layer                        | Surface a clear caveat: USDC has no reliable Uniswap v3 routing on X Layer. Suggest bridging USDC directly from a chain where it is liquid (Base, Arbitrum, Mainnet), or asking about USDT0.                            |
| Insufficient asset on X Layer                       | Trigger funding flow (Phase 3)                                                                                                                                                                                          |
| Trading API returns 400                             | Log request/response; check amount formatting and address checksums                                                                                                                                                     |
| Trading API returns 429                             | Back off and retry with exponential delay                                                                                                                                                                               |
| Quote expired                                       | Re-fetch quote; do not reuse old `permitData`                                                                                                                                                                           |
| Bridge times out                                    | Check Across bridge explorer; do not re-submit                                                                                                                                                                          |
| EIP-3009 signature rejected (402 on retry)          | Verify domain `name` / `version` from `extra` (byte-exact, including any non-ASCII characters), check `validBefore` is fresh, confirm `nonce` was unused                                                                |
| Amount mismatch on retry                            | Recompute base units using on-chain `decimals()` of the actual asset; do not assume 6                                                                                                                                   |
| On-chain settlement reverts (`transferFrom` failed) | Re-check `balanceOf` at retry time; the balance may have been drained between sign and submit (shared wallet, concurrent agent, manual transfer). Surface to the user before retrying.                                  |
| User asks about escrow / session / batch / `upto`   | Inform that this skill version covers Instant Payment (`exact` scheme) only. Other primitives are out of scope for v1.0.0; a v1.x follow-up will track them as OKX ships.                                               |

## Key Addresses and References

### X Layer (chain 196)

- **Chain ID**: `196`
- **Public RPC**: `https://rpc.xlayer.tech`
- **USDT0**: `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` (decimals 6)
- **USDG**: `0x4ae46a509F6b1D9056937BA4500cb143933D2dc8` (decimals 6)
- **USDC**: `0x74b7F16337b8972027F6196A17a631aC6dE26d22` (decimals 6, no
  reliable Uniswap routing on X Layer; bridge from a liquid chain)
- **WOKB** (wrapped native): `0xe538905cf8410324e03A5A23C1c177a474D59b2b`
  (decimals 18)
- **Uniswap V3 Factory**: `0x4B2ab38DBF28D31D467aA8993f6c2585981D6804`
- **SwapRouter02**: `0x4f0C28f5926AFDA16bf2506D5D9e57Ea190f9bcA`
- **Universal Router 2.1**:
  `0xDa00aE15d3A71466517129255255db7c0c0956d3`
- **QuoterV2**: `0xD1b797D92d87B688193A2B976eFc8D577D204343`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **USDT0/USDG pool**: `0x0cBe0dBE1400e57f371a38BD3b9bC80F7C3676dA`
- **USDT0/WOKB pool**: `0x63d62734847E55A266FCa4219A9aD0a02D5F6e02`

### Uniswap Trading API

- Base URL: `https://trade-api.gateway.uniswap.org/v1`
- Header: `x-api-key: $UNISWAP_API_KEY`
- Header: `x-universal-router-version: 2.1.1`
- Supported chains include 1, 8453, 42161, 10, 137, 130, **196**, and more
  (see Trading API supported-chains docs).

> The on-chain Universal Router contract on X Layer is labeled **2.1**
> (deployed at `0xDa00aE15d3A71466517129255255db7c0c0956d3` above). The
> Trading API expects the header value `2.1.1`, which is the API's
> internal version-string for the routing path that targets the same
> Universal Router 2.1 contract. The two version strings refer to
> related but distinct things; do not substitute one for the other.

### OKX APP

- **APP overview / dev docs**:
  `https://web3.okx.com/onchainos/dev-docs/payments/x402-introduction`
- **OKX onchainos-skills repo**: `https://github.com/okx/onchainos-skills`
- **x402 spec**: `https://github.com/coinbase/x402`

## Related Skills

- [pay-with-any-token](../pay-with-any-token/SKILL.md), sibling skill
  for HTTP 402 challenges on chains other than X Layer (Ethereum, Base,
  Arbitrum, Tempo, etc.). Use that skill for non-X-Layer challenges.
- [swap-integration](../swap-integration/SKILL.md), full Uniswap swap
  integration reference (Trading API, Universal Router, Permit2).
