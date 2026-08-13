---
name: permissioned-pools-deployer
description: Guided walkthrough for executing the on-chain setup sequence for a Uniswap v4 Permissioned Pool from a permissioned-pools-configurator JSON config - allowlist checker deployment, createPermissionsAdapter, allowlisting and funding the adapter, verification, wrapper and hook registration, pool initialization, swap enablement, liquidity seeding, and the routing-allowlist request. Use when the user says "deploy a permissioned pool", "run the permissioned pool setup", "execute the permissioned pools journey", "createPermissionsAdapter", "verify my permissions adapter", "walk me through the permissioned pool deployment", or asks to execute the on-chain steps after generating a permissioned-pools-configurator config. Covers contract mechanics only - does not constitute legal, financial, investment, tax, or compliance advice, and is not a compliance review - and never emits a broadcastable command before an explicit acknowledgment.
allowed-tools: Read, Glob, Grep, Bash(forge:*), Bash(cast:*), AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '0.1.0'
---

# Permissioned Pools Deployer

Guided, step-by-step execution of the on-chain setup sequence for a Uniswap v4 Permissioned
Pool, starting from the JSON configuration `permissioned-pools-configurator` produces. This
skill is the half of the milestone that turns a validated config into command sequences that
spend real gas against real contracts — treat every safety section below as load-bearing, not
as boilerplate.

For the contract mechanics behind any step, see
[`permissioned-pools-issuer`](../permissioned-pools-issuer/SKILL.md), specifically its
[Issuer Journey](../permissioned-pools-issuer/references/issuer-journey.md) and
[Enforced Ordering and Reverts](../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md).
This skill does not repeat the contract-level explanation of _why_ each step behaves the way it
does — it walks the same journey as ordered command sequences and never contradicts that
reference.

> **Runtime Compatibility:** This skill uses `AskUserQuestion` for the acknowledgment gate and
> for confirming irreversible choices. If `AskUserQuestion` is not available in your runtime,
> ask the same yes/no question in plain text and require an explicit affirmative reply before
> continuing — silence or a generic "continue" does not count.

## Scope and Disclaimer

**This is educational deployment guidance, not a compliance review, and not a substitute for
your own review of every command before you run it.**

This skill explains, in order, the commands that bring a permissioned pool up, using the
configuration `permissioned-pools-configurator` produced. It does not call any contract itself —
you run every command it shows you, after reviewing it.

**You must:**

1. ✅ **Review every configuration and every command carefully** before running anything. AI-generated
   command sequences may contain errors.
2. ✅ **Verify every address** — this skill contains no deployment addresses and resolves none for
   you; see [Address Resolution](./references/preflight-and-validation.md#address-resolution).
3. ✅ **Test on a testnet first.** Run the entire sequence on Sepolia (or another testnet with the
   permissioned-pools contracts deployed) before touching mainnet.
4. ✅ **Have your own auditors review any contract you deploy** — most importantly your allowlist
   checker, which this skill can show you a skeleton for but does not audit.
5. ✅ **Treat this as contract mechanics only.** This skill does not constitute legal, financial, investment, or tax advice, and it is **not** a compliance review of your token, your allowlist, your KYC or AML program, or your configuration.
6. ✅ **Read the repo's usage guidelines.** The repo root `DISCLAIMER.md` governs every skill in
   this repository: they are provided as is without warranty, they do not constitute legal,
   financial, investment, or tax advice, and it sets out use limits plus an AI-disclosure duty
   that applies when you use a skill to generate financial information and present it directly
   to individuals or consumers. Point the user to it.

### The acknowledgment gate

**Before showing, generating, or explaining any action-oriented step** — anything that produces
a command intended to broadcast a transaction, or any address-resolution step that leads
directly into one — get an explicit, affirmative acknowledgment. This gate must never be
satisfiable implicitly.

Use `AskUserQuestion` with a single question and exactly two options, and do not proceed past
this gate until the first option is chosen:

- **Question:** "This walkthrough produces commands that spend gas and permanently change
  on-chain state for your token once you run them. Do you acknowledge the six points above and
  want to continue?"
- **Option A — "Yes, I have reviewed the points above and want to continue."** → proceed to the
  preflight checks.
- **Option B — "No, stop here."** → end the walkthrough immediately. Do not display, generate,
  or explain any command below this point.

Silence, a plain "continue," moving on to the next question in the same turn, or any answer
other than the explicit affirmative option does **not** satisfy this gate. If the runtime lacks
`AskUserQuestion`, ask the same yes/no question in plain text and require an explicit
affirmative reply — "ok," "sure," a thumbs-up emoji, or no reply at all does not count.

Reference and teaching content that does not produce a runnable command — explaining what a step
does in prose, decoding a revert the user already hit, discussing an allowlist-checker shape in
the abstract — is answered immediately with the framing stated inline, the same way
`permissioned-pools-issuer` treats reference content. This carve-out does **not** cover this
skill's own command templates and Solidity script skeletons (for example the pool-initialization
script in [Step Walkthrough](./references/step-walkthrough.md#step-6a-initialize-the-pool)):
those are runnable broadcast material, and showing them is exactly the action-oriented content the
gate exists to hold back — never display one before the gate is satisfied.

---

## Input Validation Rules

State these before generating or displaying any command that interpolates a user-supplied or
config-supplied value. Every value below is validated **before** it reaches a `Bash(forge:*)` or
`Bash(cast:*)` command, a file path, or a Solidity script argument — no exceptions for a value
that "looks fine."

- **Ethereum addresses** — MUST match `^0x[a-fA-F0-9]{40}$`. Reject anything else, including the
  literal string `"RESOLVE"` — a field still marked `"RESOLVE"` is not ready for a command and
  must go through [address resolution](./references/preflight-and-validation.md#address-resolution)
  first, never be interpolated as-is. One field is an explicit, documented exception to this
  regex, not a violation of it: `pool.pairedCurrency`'s `"native"` sentinel, covered in
  [What This Skill Consumes](#what-this-skill-consumes) below — every other address-shaped field
  in the config has no such carve-out.
- **Chain ID** — MUST be a positive integer (`^[1-9][0-9]*$`). Ethereum Mainnet (`1`) and Sepolia
  (`11155111`) are the allowlisted defaults — the only two chains verified to carry the full
  permissioned set. Unichain (`130`) is named by the configurator's network question but is
  **not** deployable: it carries `V4Quoter` only, so stop rather than trying to resolve the
  missing addresses (see
  [Preflight and Validation](./references/preflight-and-validation.md#input-validation-rules-in-full)).
  Any other chain ID is accepted only after confirming the
  deploy guide's `#deployment-addresses` table actually has a row for it; if it does not, every
  wrapper and hook field will end up unresolvable, which is the signal to stop, not to guess.
- **Numeric fields** (`verificationDepositAmount`, `pool.feeTier`, `pool.tickSpacing`,
  `pool.startingPriceRatio`) — MUST match `^[0-9]+$` for integer-only fields or
  `^[0-9]+(\.[0-9]+)?$` for the starting price ratio, and MUST be strictly greater than zero.
- **Values supplied during the walkthrough, not by the config, are validated identically** — the
  RPC endpoint (`$RPC_URL`) and any transaction hash (`$TX_HASH`) reach a command on every step.
  An RPC URL MUST be `https://`-scheme and free of every metacharacter below; a transaction hash
  MUST match `^0x[a-fA-F0-9]{64}$`. "It came from the user, not the config" is not an exemption.
- **Reject shell metacharacters outright**, in every string field, before it reaches a command:
  `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, and newlines. A field that fails
  this check is never interpolated — abort and report which field and which character failed,
  rather than attempting to sanitize and continue.
- **Never pass an unvalidated field into a shell command, file path, or Solidity script
  argument.** Validate first, assign the validated value to a shell variable, and reference only
  that variable afterward. Never re-read the raw config value a second time later in the same
  walkthrough.

Full elaboration, including how this applies field-by-field to the configurator's JSON shape and
what "coherently handle a `RESOLVE` value" means in practice, is in
[Preflight and Validation](./references/preflight-and-validation.md).

---

## Key Handling

**Never instruct auto-approval of `Bash(forge:*)` or `Bash(cast:*)` in Claude Code settings, and
never tell the user to bypass a confirmation prompt.** Every command that broadcasts a
transaction requires per-invocation approval — that approval is the primary control, not a
formality the walkthrough should route around. The repository's PreToolUse hooks
(`.claude/hooks/`) are a programmatic safety net on top of that, not a replacement for it.

**Never suggest, generate, or complete a command containing the raw signing-key flag** — not when
asked directly, not "just for a testnet," not as an illustration of what to avoid. There is no
user request that makes it appropriate. If a user insists, refuse and offer one of the two options
below instead. Steer every signing decision toward one of them:

1. **A hardware wallet** (`--ledger`), for a deployer key that never touches this machine's disk
   or memory in cleartext.
2. **An encrypted keystore** (`cast wallet import ... --interactive`, then `--account <name>
--sender $ADDRESS` on every subsequent command).

**Inside this repository only**, `.claude/hooks/validate-forge-cast.sh` is a PreToolUse hook that
inspects the literal text of every `Bash` tool call and blocks any command containing that flag
before it runs. **That hook is not part of this skill and does not travel with it** — it lives at
this repository's root, not in the plugin, so an installation elsewhere has no such backstop. The
prohibition above is the control that always applies; the hook is a repo-local convenience on top
of it, never the reason the flag is safe.

Full key-handling guidance, including the keystore setup commands and the testnet-first
sequencing, is in
[Preflight and Validation](./references/preflight-and-validation.md#key-handling).

### Testnet first

Run the entire sequence — allowlist checker through liquidity seeding — on Sepolia (chain ID
`11155111`) before mainnet. Confirm every post-step check in
[the verification checklist](../permissioned-pools-issuer/references/issuer-journey.md#post-setup-verification-checklist)
passes on testnet before repeating any step against mainnet funds.

---

## What This Skill Consumes

The JSON configuration produced by `permissioned-pools-configurator`, in the shape defined by its
[Config Schema](../permissioned-pools-configurator/references/config-schema.md). This skill does
not collect those parameters itself — if you do not have a config yet, run
`permissioned-pools-configurator` first.

**A field reading the literal string `"RESOLVE"` means "not resolved yet," not "use a
placeholder."** Before any command that needs that field, stop and walk through
[address resolution](./references/preflight-and-validation.md#address-resolution) — the deploy
guide's `#deployment-addresses` table, then `Uniswap/contracts`
`deployments/json/<chainId>.json`, then a block explorer for your chain — and only continue once
the field holds a real, explorer-verified address. Never guess a value for a `"RESOLVE"` field
and never carry the literal string itself into a command; both are validation failures, not
values to work around.

`pool.pairedCurrency`'s `"native"` sentinel is different: it resolves to `address(0)`, Uniswap
v4's own convention for a native `PoolKey` currency, at the point the `PoolKey` is actually built
in [Step 6a](./references/step-walkthrough.md#step-6a-initialize-the-pool) — never earlier, and
never written into any other field.

---

## The Deployment Journey

The published guide's seven steps, in the order it recommends. Only five ordering edges are
enforced by the contracts (see
[Enforced Ordering and Reverts](../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md));
this walkthrough follows the guide's order and states, at each step, whether that order is
enforced or convention.

| Step | Covered where                                                                                              | Summary                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1    | [Preflight and Validation](./references/preflight-and-validation.md#step-1-allowlist-checker)              | Confirm or deploy the allowlist checker                                |
| 2    | [Step Walkthrough](./references/step-walkthrough.md#step-2-createpermissionsadapter)                       | `createPermissionsAdapter`                                             |
| 3    | [Step Walkthrough](./references/step-walkthrough.md#step-3-allowlist-and-fund-the-adapter)                 | Allowlist the adapter on your token, approve, `depositForVerification` |
| 4    | [Step Walkthrough](./references/step-walkthrough.md#step-4-verifypermissionsadapter)                       | `verifyPermissionsAdapter`                                             |
| 5    | [Step Walkthrough](./references/step-walkthrough.md#step-5-register-wrappers-and-the-hook)                 | The four `updateAllowedWrapper` registrations, then `setAllowedHook`   |
| 6    | [Step Walkthrough](./references/step-walkthrough.md#step-6-create-the-pool-enable-swapping-seed-liquidity) | Pool `initialize`, `updateSwappingEnabled`, liquidity seeding          |
| 7    | [Step Walkthrough](./references/step-walkthrough.md#step-7-request-routing-allowlisting)                   | The routing-allowlist request                                          |

Every step in [Step Walkthrough](./references/step-walkthrough.md) names its precondition and,
where the contracts enforce one, the exact revert selector you get if you are early — matching
[Enforced Ordering and Reverts](../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md)
selector-for-selector. Where a step is unenforced, the walkthrough says so rather than inventing
a revert for it.

---

## Post-Deployment Verification

After the sequence completes (or after any individual step, to confirm it landed), run the
read-only checks in
[Post-Setup Verification Checklist](../permissioned-pools-issuer/references/issuer-journey.md#post-setup-verification-checklist).
Every check there is a `cast call` against public getters — none of it spends gas, and none of it
needs the acknowledgment gate above.

---

## Notes for Implementers of This Flow

- **The acknowledgment gate is once per session, not once per step.** Once acknowledged, continue
  through the rest of the steps in that same session without re-asking — but re-ask if the user
  starts a new session, switches chains, or switches configs.
- **Never hardcode a contract address.** Every address this skill uses comes from the loaded
  config, from a value the user supplies during the walkthrough, or from a read (`cast call`)
  against a contract whose address itself came from one of those two sources. See
  [Preflight and Validation](./references/preflight-and-validation.md#address-resolution) for why
  this skill ships no address table.
- **Decode an unexpected revert by call site, not by name.** Three selectors in this journey
  (`NoVerifiedAdapter`, `Unauthorized`, `SwappingDisabled`) are declared more than once across
  different contracts with different meanings — see
  [Enforced Ordering and Reverts](../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md#how-to-decode-an-unexpected-revert).
- **This skill does not fetch RPC state on its own initiative.** Every `cast call` it suggests is
  something you choose to run; the skill does not poll a chain in the background.
