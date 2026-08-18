---
name: permissioned-pools-configurator
description: Interactively collect and validate the parameters for a Uniswap v4 Permissioned Pool setup - chain, underlying token, allowlist checker, adapter owner, verification deposit, the four wrapper registrations, hook, and pool pricing - and emit the JSON config the deployer skill consumes. Use when the user says "configure a permissioned pool", "permissioned pool config", "adapter parameters", "permissioned pool setup parameters", "PermissionsAdapter configuration", or asks to set up parameters for a permissioned pool before deploying. Covers contract mechanics only - does not constitute legal, financial, investment, tax, or compliance advice, and is not a compliance review.
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '0.1.0'
---

# Permissioned Pools Configurator

Interactive bulk-form configurator for a Uniswap v4 Permissioned Pool. Collects every
parameter the setup journey needs, validates each one, and displays a single JSON
configuration object that the `permissioned-pools-deployer` skill consumes to run the
on-chain sequence. For the contract mechanics behind any of these parameters, see
[`permissioned-pools-issuer`](../permissioned-pools-issuer/SKILL.md).

> **Runtime Compatibility:** This skill uses `AskUserQuestion` to collect parameters in
> batches. If `AskUserQuestion` is not available in your runtime, collect the same
> parameters through natural language conversation instead, in the same batch groupings
> and with the same validation after each group.

## Scope and Disclaimer

**This is a configuration tool, not deployment guidance and not a compliance review.**

- ✅ It collects and validates the inputs a permissioned-pool setup needs and produces a
  JSON document. It does not call any contract, does not broadcast anything, and holds
  no signing keys.
- ✅ **Treat this as contract mechanics only.** This skill does not constitute legal, financial, investment, or tax advice, and it is **not** a compliance review of your token, your allowlist, your KYC or AML program, or your configuration. It covers what each parameter means and what breaks if it is wrong.
- ✅ It never invents a contract address. Addresses you supply are recorded as given;
  addresses you do not yet have — whether because they still need to be looked up
  against the deploy guide's table or because the issuer has not decided on them yet —
  are stored as the literal string `"RESOLVE"`, never guessed or recalled from memory.
- ✅ Review the emitted configuration yourself, and re-resolve every address it marks for
  resolution, before handing it to a deployment flow.
- ✅ **Read the repo's usage guidelines.** The repo root `DISCLAIMER.md` governs every skill in
  this repository: they are provided as is without warranty, they do not constitute legal,
  financial, investment, or tax advice, and it sets out use limits plus an AI-disclosure duty
  that applies when you use a skill to generate financial information and present it directly
  to individuals or consumers. Point the user to it.

State this framing inline (quoted or in your own words) and continue with the
configuration flow in the same response — this is reference and data-collection
content, not an action-oriented deployment step, so no acknowledgment gate is needed
here. The deployer skill gates on acknowledgment before anything gas-spending.

## What This Config Is (and Isn't)

The output is a **pre-deployment plan**, not a record of what already exists on-chain.

- The **`PermissionsAdapter` address does not appear in this config.** It does not exist
  until the deployer's Step 2 (`createPermissionsAdapter`) creates it. If the issuer
  already has a deployed adapter for this token, that is a re-run/import scenario this
  skill does not currently handle — collect its address as a note and confirm with the
  deployer skill's preflight checks instead of adding it here. **This declines only the
  adapter address itself — it does not block the rest of the request.** Continue
  validating and including every other field the user supplied (or marked `"RESOLVE"`)
  in the emitted configuration exactly as the flow below describes.
- The **underlying permissioned token is the only token address this config records.**
  See the two-addresses distinction in `permissioned-pools-issuer` — the pool currency
  the deployer builds later is the adapter, derived at deploy time, not configured here.
- Wrapper and hook addresses are **chain-specific and change over time.** This skill asks
  whether you already have them resolved for your target chain; if not, it marks them
  for resolution rather than filling in a value.

## Configuration Flow

Collect parameters in four batches of at most four questions each. After each batch,
validate every answer against [`config-schema.md`](./references/config-schema.md) before
moving on, and show a running summary of what has been collected and what remains.
Field-by-field meaning, how to choose each value, and what breaks if it is wrong are all
in [`parameter-reference.md`](./references/parameter-reference.md).

### Front-loaded or skip-ahead answers

A user may answer several batches' worth of questions in one free-form message, or ask
to skip the remaining questions and finish immediately. Do not withhold the whole
configuration while asking whether to proceed. Instead: validate everything the user did
supply against `config-schema.md`, apply the literal string `"RESOLVE"` (or `null` for
`allowlistChecker.address` when the checker is `to-be-deployed`) to every address-type
field left open, and produce that partial configuration in the same response. Fields with
no `"RESOLVE"` sentinel — the verification deposit amount, pool currency, fee tier, tick
spacing, starting price, and seeding — have no safe default; flag each one explicitly as
still needing an answer rather than guessing at it, and ask only about those. **This
includes the verification deposit amount even though Batch 2 lists "1 wei" as the
recommended option:** a menu option a user has not actually picked is not a value the
skill may silently apply on their behalf — treat an unanswered verification deposit
amount exactly like the other sentinel-less fields, never as an already-resolved `"1"`.
Skipping the batch-by-batch confirmation step never means skipping validation — every
rule above still applies to whatever the user did supply.

### Batch 1: Network, Token & Ownership (4 questions)

**Question 1 — Network**

- Prompt: "Which network is this permissioned pool for?"
- Options: "Ethereum Mainnet (chain ID 1)", "Unichain (chain ID 130)", "Sepolia (chain ID
  11155111)", Custom chain ID (via "Other")
- Note in the prompt: availability of the permissioned-pools contracts on a given chain is
  not something this skill asserts — confirm the chain has a row in the deploy guide's
  `#deployment-addresses` table before proceeding.
- Store: `chainId`

**Question 2 — Underlying permissioned token**

- Prompt: "What is the address of the permissioned ERC-20 being listed?"
- Options: "Not deployed yet" (stores the literal string `"RESOLVE"`), custom address
  (via "Other")
- Validation: `^0x[a-fA-F0-9]{40}$`, or the literal string `"RESOLVE"` if not yet deployed
- Store: `permissionedToken`

**Question 3 — Allowlist checker**

- Prompt: "Do you already have an allowlist checker deployed for this token?"
- Options, each mapped to the exact `allowlistChecker` value it produces:
  - "Yes, use an existing address" (then ask for the address via "Other") →
    `mode: "existing"`, `address` set to that address.
  - "No, I still need to deploy one" → `mode: "to-be-deployed"`, `address` set to `null`.
- Validation: address form above when "existing" is chosen
- Store: `allowlistChecker.mode` (`existing` | `to-be-deployed`), `allowlistChecker.address`

**Question 4 — Adapter owner**

- Prompt: "What address should own the `PermissionsAdapter` (`initialOwner`)?"
- Options: "Not yet decided — mark for resolution" (stores the literal string
  `"RESOLVE"`), custom address (via "Other")
- Note in the prompt: this key can change the allowlist checker, add or remove wrappers,
  pause and resume swapping, and force-exit any LP position — the published guide
  recommends a multisig. Do not pick this in a hurry just to finish the flow; use the
  resolution marker instead if the multisig or key is not decided yet.
- Validation: `^0x[a-fA-F0-9]{40}$` and not the zero address, or the literal string
  `"RESOLVE"`
- Store: `adapterOwner`

**Validate:** confirm chain ID is a positive integer, the token address is either a
valid address or the literal string `"RESOLVE"`, the checker address (if "existing" was
chosen) matches the address regex, and the adapter owner is either a valid non-zero
address or the literal string `"RESOLVE"`. Show a summary of the four collected values,
flagging any field still marked `"RESOLVE"`.

---

### Batch 2: Verification & Core Wrappers (4 questions)

**Question 1 — Verification deposit amount**

- Prompt: "How much of the underlying token should be deposited for verification?"
- Options: "1 wei (recommended)", Custom amount (via "Other")
- Note in the prompt: this deposit becomes the adapter's mintable headroom, there is no
  withdraw function, and 1 wei is sufficient — see
  [Parameter Reference](./references/parameter-reference.md#verificationdepositamount)
  before choosing anything larger.
- "Recommended" describes the value if asked and picked — it is never a license to fill
  in `"1"` on the user's behalf when this question was skipped. See
  [Front-loaded or skip-ahead answers](#front-loaded-or-skip-ahead-answers) above.
- Store: `verificationDepositAmount`

**Question 2 — `PermissionedPositionManager` address**

- Prompt: "Do you have the `PermissionedPositionManager` address resolved for this
  chain?"
- Options: "Not yet resolved — mark for resolution" (stores the literal string
  `"RESOLVE"`), custom address (via "Other")
- Validation: address form, or the literal string `"RESOLVE"`
- Store: `allowedWrappers.permissionedPositionManager`

**Question 3 — Universal Router (v2.2+) address**

- Prompt: "Do you have the Universal Router `#v2.2` (or higher) address resolved for
  this chain?"
- Options: "Not yet resolved — mark for resolution" (stores the literal string
  `"RESOLVE"`), custom address (via "Other")
- Note in the prompt: the plain `UniversalRouter` deployments key is a different,
  non-permissioned router — only the `#v2.2` deployment works here.
- Validation: address form, or the literal string `"RESOLVE"`
- Store: `allowedWrappers.universalRouterV2_2`

**Question 4 — `PermissionedHooks` address**

- Prompt: "Do you have the `PermissionedHooks` address resolved for this chain, for
  `setAllowedHook`?"
- Options: "Not yet resolved — mark for resolution" (stores the literal string
  `"RESOLVE"`), custom address (via "Other")
- Note in the prompt: this is the shared hook address, registered with
  `setAllowedHook` on the position manager — it is never registered as a wrapper.
- Validation: address form, or the literal string `"RESOLVE"`
- Store: `hook`

**Validate:** confirm the deposit amount is a positive integer (not zero) expressed in
the token's smallest unit, and that every address field is either a valid address or the
literal string `"RESOLVE"` — never a guessed or invented value. Show a summary.

---

### Batch 3: Remaining Wrappers & Pool Currency (4 questions)

**Question 1 — `V4Quoter` address**

- Prompt: "Do you have the `V4Quoter` address resolved for this chain?"
- Options: "Not yet resolved — mark for resolution" (stores the literal string
  `"RESOLVE"`), custom address (via "Other")
- Validation: address form, or the literal string `"RESOLVE"`
- Store: `allowedWrappers.v4Quoter`

**Question 2 — `MixedRouteQuoterV2` address**

- Prompt: "Do you have the `MixedRouteQuoterV2` address resolved for this chain?"
- Options: "Not yet resolved — mark for resolution" (stores the literal string
  `"RESOLVE"`), custom address (via "Other")
- Validation: address form, or the literal string `"RESOLVE"`
- Store: `allowedWrappers.mixedRouteQuoterV2`

**Question 3 — Paired currency**

- Prompt: "What currency should the pool pair against the permissioned token?"
- Options: "Native ETH", custom ERC-20 address (via "Other")
- Note in the prompt: the permissioned token's side of the pool is always the adapter,
  never the underlying token — this question is only about the _other_ currency.
- Validation: address form for an ERC-20 and not the zero address, or the literal string
  `"native"` (the native-currency sentinel; see [Address Validation](./references/config-schema.md#address-validation)
  for the full semantics). A user who supplies the zero address here means `"native"` —
  record `"native"`, never the zero address.
- Store: `pool.pairedCurrency`

**Question 4 — Fee tier**

- Prompt: "What fee tier should the pool use?"
- Options: "0.05% (500)", "0.30% (3000)", "1.00% (10000)", Custom (via "Other")
- Validation: positive integer, hundredths of a basis point
- Store: `pool.feeTier`

**Validate:** confirm both remaining wrapper fields are a valid address or the literal
string `"RESOLVE"`, the paired currency is a valid non-zero address or the literal string
`"native"`, and the fee tier is a positive integer. When the paired currency is a resolved
address and `permissionedToken` is also a resolved address, confirm the two differ —
pairing the permissioned token against itself builds a `PoolKey` that either fails at the
PoolManager level or creates a pool nobody intended (see
[Parameter Reference](./references/parameter-reference.md#poolpairedcurrency)). Show a
summary of all four wrappers,
the hook, and the pool currency collected so far, and flag every field still marked
`"RESOLVE"`.

---

### Batch 4: Pricing & Seeding (3 questions)

**Question 1 — Tick spacing**

- Prompt: "What tick spacing should the pool use?"
- Options: "10 (stable-like pairs)", "60 (standard)", "200 (wide-range pairs)", Custom
  (via "Other")
- Validation: positive integer
- Store: `pool.tickSpacing`

**Question 2 — Starting price**

- Prompt: "What should the pool's starting price be, expressed as paired-currency per
  permissioned-token?"
- Options: "1:1 (equal value ratio)", Custom ratio (via "Other")
- Validation: positive number
- Store: `pool.startingPriceRatio` (a human-readable ratio; the deployer skill converts
  this to `sqrtPriceX96` at initialization time, since that conversion depends on the
  decimals of both currencies, which are not yet resolved at configuration time)

**Question 3 — Seeding intent**

- Prompt: "Do you plan to seed liquidity as part of this same setup?"
- Options, each mapped to the exact `seeding.intent` value it produces:
  - "Yes, from the adapter owner's wallet" → `intent: "seed-now"`, `wallet` set to the
    same address already collected as `adapterOwner` in Batch 1. **Offer this option
    only when `adapterOwner` is a real address — not when it is the literal string
    `"RESOLVE"`.** `seeding.wallet` must always be a real address (see Validation
    below), so this option cannot copy forward an unresolved owner.
  - "Yes, from a different wallet" (then ask for the address via "Other") →
    `intent: "seed-now"`, `wallet` set to that address
  - "Not yet — pool creation only" → `intent: "none"`, `wallet: null`
- If `adapterOwner` is `"RESOLVE"`, present only the second and third options — drop the
  first option from the list entirely rather than showing it disabled.
- Note in the prompt: whichever wallet seeds liquidity, and the wallet that will receive
  the position, both need `LIQUIDITY_ALLOWED` on the issuer's own allowlist before the
  first mint — being the adapter owner grants nothing on the liquidity path.
- Validation: when `intent` is `"seed-now"`, `wallet` is required and must match the
  address regex — never the literal string `"RESOLVE"` or any other sentinel; when
  `intent` is `"none"`, `wallet` must be `null`. This flow never produces `"seed-later"`
  — that enum value exists in the schema for a config edited or extended outside this
  flow, not for output from these three options.
- Store: `seeding.intent`, `seeding.wallet`

**Validate:** confirm tick spacing is a positive integer, the starting price ratio is a
positive number, and — per the branch taken above — either `seeding.wallet` is a valid,
non-`"RESOLVE"` address (when `intent` is `"seed-now"`) or it is `null` (when `intent` is
`"none"`). `seeding.wallet` never accepts the literal string `"RESOLVE"`, even when it
was going to be copied from `adapterOwner` — see the option restriction above. Show the
full configuration collected across all four batches.

---

## Generate and Display the Configuration

Assemble everything collected into the JSON shape defined in
[`config-schema.md`](./references/config-schema.md), keyed by `chainId` at the top
level:

```json
{
  "<chainId>": {
    "permissionedToken": "...",
    "allowlistChecker": { "mode": "...", "address": "..." },
    "adapterOwner": "...",
    "verificationDepositAmount": "...",
    "allowedWrappers": {
      "permissionedPositionManager": "...",
      "universalRouterV2_2": "...",
      "v4Quoter": "...",
      "mixedRouteQuoterV2": "..."
    },
    "hook": "...",
    "pool": {
      "pairedCurrency": "native",
      "feeTier": 3000,
      "tickSpacing": 60,
      "startingPriceRatio": 1
    },
    "seeding": { "intent": "seed-now", "wallet": "..." }
  }
}
```

**Display this JSON directly in the transcript. Do not automatically create a file.**
Let the user copy it or choose a filepath in the next-steps question below.

## Display Summary

Immediately after the JSON, show a human-readable summary:

- Network and chain ID.
- Underlying token and allowlist-checker mode.
- Adapter owner.
- Verification deposit amount, with a one-line reminder that it is not recoverable.
- Every wrapper and the hook, each flagged **resolved** or **needs resolution**.
- Pool currency, fee tier, tick spacing, starting price ratio.
- Seeding intent and wallet, with a reminder that the wallet needs `LIQUIDITY_ALLOWED`.
- A validation checklist: which rules from `config-schema.md` passed, and which fields
  still need a real address before this config can be used to deploy anything.

## Next Steps

Ask the user what they want to do:

- "Save to file" — ask for a filepath, default `permissioned-pool-config.json`. Require
  a relative path ending in `.json`; reject an absolute path (leading `/`), reject a
  leading `~` (a runtime that expands it can write outside the working directory —
  including over Claude Code's own config store), and reject any path containing a `..`
  segment. Resolve the path and confirm it still stays within the current working
  directory before writing. If the resolved path already exists, ask for confirmation
  before overwriting it — including a file that looks unrelated to this skill, such as
  `package.json` or `tsconfig.json`. Re-prompt once on a rejected path rather than
  silently substituting the default. Then write exactly the JSON object shown above.
  (This validation is intentionally stricter than other skills' "save to file" steps in
  this repo — the `~` and `..` rejections were added in response to a security audit
  finding that a leading `~` could target `~/.claude.json`, so keep them here rather
  than trimming to match a lighter-weight equivalent elsewhere.)
- "View the setup walkthrough" — point at `permissioned-pools-deployer`.
- "Modify configuration" — re-run the relevant batch above.
- "Exit" — end here; the user can copy the JSON from the transcript.

## Notes for Implementers of This Flow

- **Never fill in a token, wrapper, hook, or adapter-owner address from memory.** If the
  user does not supply one, store the exact literal string `"RESOLVE"` in that field —
  full stop. This includes not "helpfully" completing a partially-typed address.
- **Batch, validate, summarize — every time.** Do not run all four batches back to back
  without the validation and summary steps in between; that is what keeps a bad input
  from propagating into the next batch's defaults.
- **This skill does not read chain state, fetch an RPC, or consult a deployments JSON
  file.** It has no `Bash` or `WebFetch` in its tool list, on purpose — resolving
  addresses against `Uniswap/contracts` `deployments/json/<chainId>.json` and the deploy
  guide's table is the user's job, or a later step in the deployer skill's preflight.
