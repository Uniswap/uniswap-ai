# Preflight and Validation

Everything to check, validate, and resolve before the first command in
[Step Walkthrough](./step-walkthrough.md) runs. Most of this file is reads, local validation, and
off-chain setup — but not all of it: [Step 1](#step-1-allowlist-checker)'s `mode:
"to-be-deployed"` path calls for deploying your checker with `forge script`, which broadcasts a
transaction and spends gas exactly like anything in [Step Walkthrough](./step-walkthrough.md)
does, and the `forge script --broadcast` command examples under [Key Handling](#key-handling) are
runnable broadcast templates, not inert illustrations. Do not treat this file as broadcast-free
just because most of it is.

**Do not run any command in this file before the acknowledgment gate in
[the skill's main file](../SKILL.md#the-acknowledgment-gate) has been explicitly satisfied.** The
`cast call` reads under [Step 1](#step-1-allowlist-checker) (no `--broadcast`, no signer) are safe
before the gate; deploying a checker under that same step, and everything under
[Key Handling](#key-handling), is not.

## Loading the Configuration

Load the JSON produced by `permissioned-pools-configurator`, in the shape defined by its
[Config Schema](../../permissioned-pools-configurator/references/config-schema.md). Pick the
object under the chain ID you are deploying to — the file may describe several chains at once.

Before using any field from it:

1. **Re-validate every field against `config-schema.md`'s rules**, even if the file claims to
   have come from the configurator. A hand-edited file is indistinguishable from a
   configurator-produced one once it is on disk, so validate unconditionally rather than trusting
   provenance.
2. **Confirm the four `allowedWrappers` keys are all present** (`permissionedPositionManager`,
   `universalRouterV2_2`, `v4Quoter`, `mixedRouteQuoterV2`), plus any issuer-added custom-wrapper
   keys. If the object also contains a key literally named after the factory or the hook, stop —
   that is a configuration error the schema warns about, not something to register.
3. **Note every field still reading the literal string `"RESOLVE"`.** Build the list once, up
   front, so the walkthrough can tell you exactly what needs resolving before it can proceed
   past a given step, rather than discovering it one interpolation at a time.

## Resolving the `"RESOLVE"` Sentinel

A field holding the literal string `"RESOLVE"` means the configurator's user did not have a real
value at configuration time — for `permissionedToken`, the token is not deployed yet; for
`adapterOwner`, the owning key or multisig is not decided; for `allowedWrappers.*` and `hook`, the
address has not been looked up yet.

**Coherent handling means three things, always in this order, and never skipped:**

1. **Never interpolate the literal string `"RESOLVE"` into a command.** It fails the address
   regex (`^0x[a-fA-F0-9]{40}$`) like any other malformed input, so the same validation step in
   [Input Validation Rules](../SKILL.md#input-validation-rules) catches it — but catching it is
   not enough. Stop and resolve, rather than reporting a validation failure and moving on.
2. **Resolve, in this order, before continuing:**
   - The deploy guide's own table, at its `#deployment-addresses` anchor — the complete,
     permissioned-specific table for the target chain.
   - The machine-readable record, `Uniswap/contracts` `deployments/json/<chainId>.json`, under
     the `latest` key. The Universal Router key you want is `UniversalRouter#v2.2` — the plain
     `UniversalRouter` key is a different, non-permissioned router on the same chain.
   - A block explorer for the target chain, to confirm the resolved address exists, is verified,
     and is the contract expected — before sending any transaction to it.
   - For `permissionedToken` specifically: there is nothing to resolve from a table. The token
     must actually be deployed first; if it is not, stop the walkthrough here rather than
     substituting any other address.
   - For `adapterOwner` specifically: there is nothing to resolve from a table either. The owning
     key or multisig has to be decided by the issuer; do not pick one on the user's behalf to
     unblock the walkthrough.
3. **Write the resolved value back into the working config before generating the next command**,
   so every later step reads the resolved value rather than re-resolving (or re-forgetting) the
   same field. Do not carry `"RESOLVE"` forward once a real value exists.

Never treat an address supplied in a chat message, a ticket, or a screenshot as already resolved
— including one supplied to this skill mid-walkthrough. Run it through the same three steps
above.

## Address Resolution

**This skill ships no address table, on purpose.** Two facts about the sources below, both
verified on 2026-08-11 rather than assumed:

- **Hop 1 is empty.** The published deploy guide's address table still reads "Coming soon" in all
  twelve cells, mainnet and Sepolia alike.
- **Hop 2 works.** `Uniswap/contracts` does carry the records, at
  `deployments/json/<chainId>.json` under the `latest` key. An earlier version of this paragraph
  claimed the opposite and cited a `deployments.json` path that does not exist; that claim was
  false and is corrected here.

So the reason to ship no table is not that the addresses are unavailable. It is that **they
move**: mainnet `PermissionedHooks` was already redeployed once, on 2026-06-29, changing its
address. A table pasted into this file would be silently wrong from the next redeploy onward,
while hop 2 is current by construction. Resolve, never recall.

This order applies to every **Uniswap-deployed** contract address the config needs — the four
`allowedWrappers` keys and `hook` — whether the field starts as `"RESOLVE"` or was typed in during
the walkthrough. Resolve each one, every time, with no shortcut for "I'm pretty sure this one is
right":

1. The deploy guide's `#deployment-addresses` anchor.
2. `Uniswap/contracts`, `deployments/json/<chainId>.json`, under the `latest` key.
3. A block explorer for the target chain, confirming the address exists, is verified, and matches
   the contract expected — immediately before the first transaction that uses it, not once at the
   start of the session.

It does **not** apply to `allowlistChecker.address` (the issuer's own contract — resolved by
`mode`, see [Step 1](#step-1-allowlist-checker)) or to `adapterOwner` (a key or multisig the
issuer decides, never looked up in a table).

The one address literal this skill ever writes is the zero address (`address(0)`), and only in
one place: as the resolved form of the configurator's `"native"` pool-currency sentinel, at the
point [Step 6a](./step-walkthrough.md#step-6a-initialize-the-pool) builds the `PoolKey`. It is
Uniswap v4's own documented convention for a native `PoolKey` currency, not a guessed or
placeholder address, and it never substitutes for an unresolved token, checker, wrapper, owner,
or hook address.

## Input Validation Rules, in Full

The same rules stated in [the skill's main file](../SKILL.md#input-validation-rules), applied
field-by-field to the configurator's schema:

| Field                                                            | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissionedToken`, `adapterOwner`, `allowedWrappers.*`, `hook` | `^0x[a-fA-F0-9]{40}$`, **or** the literal string `"RESOLVE"`. A `"RESOLVE"` value triggers [address resolution](#resolving-the-resolve-sentinel), not a silent skip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `allowlistChecker.mode`                                          | Exactly `"existing"` or `"to-be-deployed"` — no other value. This is the branch selector for [Step 1](#step-1-allowlist-checker); an unrecognized value means the config was not produced by `permissioned-pools-configurator` or was hand-edited incorrectly, and neither branch below should be guessed at.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `allowlistChecker.address`                                       | `^0x[a-fA-F0-9]{40}$` when `allowlistChecker.mode` is `"existing"`; must be `null` when `mode` is `"to-be-deployed"`. **Never `"RESOLVE"`** — per `config-schema.md`, this sentinel is scoped to `permissionedToken`, `adapterOwner`, `allowedWrappers.*`, and `hook` only, and this field is not on that list. A `"RESOLVE"` value here is malformed input, rejected outright — not routed through [address resolution](#resolving-the-resolve-sentinel), whose first two hops (the deploy guide's table, `deployments/json/<chainId>.json`) are for Uniswap-deployed contracts and are a dead end for a checker the issuer writes and deploys themselves. Resolve a missing checker address by `mode` instead: see [Step 1](#step-1-allowlist-checker). |
| `seeding.intent`                                                 | Exactly `"seed-now"`, `"seed-later"`, or `"none"` — no other value. This selects the branch for `seeding.wallet` below; an unrecognized value is malformed input, not a variant to interpret loosely.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `seeding.wallet`                                                 | `^0x[a-fA-F0-9]{40}$` when `seeding.intent` is `seed-now` or `seed-later`; must be `null` when `intent` is `none`. Never `"RESOLVE"` — the configurator never emits that sentinel here, and this skill rejects it too if a hand-edited config supplies it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| chain ID (the config's top-level key)                            | `^[1-9][0-9]*$`. Verified 2026-08-11 against `deployments/json/<chainId>.json`: only **`1` (mainnet)** and **`11155111` (Sepolia)** carry the full permissioned set plus all four wrappers. **`130` (Unichain) carries `V4Quoter` only** — no `PermissionsAdapterFactory`, no `PermissionedHooks`, no `PermissionedPositionManager`, no `UniversalRouter#v2.2`, no `MixedRouteQuoterV2` — so a permissioned pool cannot be brought up there; stop rather than trying to resolve the missing addresses. Any other chain needs **every** required address confirmed present for that chain before continuing, not just the one the current step needs.                                                                                                      |
| `verificationDepositAmount`                                      | `^[0-9]+$`, parsed as an arbitrary-precision integer (it is a JSON string specifically to avoid double-precision loss), and greater than zero.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pool.feeTier`, `pool.tickSpacing`                               | `^[0-9]+$`, greater than zero.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pool.startingPriceRatio`                                        | `^[0-9]+(\.[0-9]+)?$`, greater than zero.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pool.pairedCurrency`                                            | the literal string `"native"`, or `^0x[a-fA-F0-9]{40}$`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| RPC endpoint URL (`$RPC_URL`)                                    | not a config field — supplied during the walkthrough. MUST be `https://`-scheme and MUST NOT contain any metacharacter from the row below. Validate it the first time it is supplied, assign it to `$RPC_URL`, and never re-read a raw URL into a later command.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Transaction hash (`$TX_HASH`)                                    | MUST match `^0x[a-fA-F0-9]{64}$`. Reject anything else — it is interpolated directly into `cast receipt "$TX_HASH"` during the walkthrough.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Every string field, regardless of the rule above                 | reject on any of `;`, `\|`, `&`, `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, or a newline, before any other check. A field can pass its type-specific regex and still be rejected here if the injected value happens to also look address-shaped — check metacharacters first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Validate once, per field, at load time — not once per command that uses the field.**
Re-validating on every use is not wrong, but re-reading the raw config value on every use (rather
than a value already checked and stored in a shell variable) reintroduces the exact risk the
"validate before interpolation" rule exists to close.

## Step 1: Allowlist Checker

> **Gate reminder, for anyone landing here directly:** the `cast call` ERC-165 reads below are
> safe to run before the acknowledgment gate. Deploying a checker under `mode: "to-be-deployed"`
> is not — it broadcasts a transaction, and needs the gate in
> [the skill's main file](../SKILL.md#the-acknowledgment-gate) satisfied first.

Before Step 2 (`createPermissionsAdapter`) can succeed, a checker satisfying `IAllowlistChecker`
must exist and pass its ERC-165 probe. The config's `allowlistChecker.mode` tells you which case
you are in:

- **`mode: "existing"`** — `allowlistChecker.address` is already set. Confirm the unambiguous half
  of its ERC-165 support before relying on it — this probe never depends on `IAllowlistChecker`'s
  shape, because `0x01ffc9a7` is the standardized ERC-165 self-identification selector:

  ```bash
  cast call "$ALLOWLIST_CHECKER" \
    "supportsInterface(bytes4)(bool)" 0x01ffc9a7 \
    --rpc-url "$RPC_URL"
  ```

  This read is read-only (`cast call`, no `--broadcast`, no signer needed) and safe to run before
  the acknowledgment gate. A `false` result here means the checker fails ERC-165 outright — stop;
  `createPermissionsAdapter` will revert `InvalidAllowListChecker(checker)` regardless of anything
  else about the checker.

  `PermissionsAdapter._updateAllowListChecker` separately requires
  `supportsInterface(type(IAllowlistChecker).interfaceId)` to return `true` (see
  `permissioned-pools-issuer`'s [Issuer Journey](../../permissioned-pools-issuer/references/issuer-journey.md)
  Step 1 and [Enforced Ordering and Reverts](../../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md)'s
  `InvalidAllowListChecker` row) — but **neither reference file reduces that interfaceId to a
  concrete `bytes4` value**, and this skill does not guess one. `type(IAllowlistChecker).interfaceId`
  equals `cast sig "checkAllowlist(address,address)"` only if `checkAllowlist` is the interface's
  sole declared member; if `IAllowlistChecker` declares any other member, the true interfaceId is
  the XOR of every member's selector, not just this one, and this skill's toolset has no way to
  confirm the interface's full member list to check which case applies. Do not run a `cast call`
  against a guessed interfaceId and treat its result as a pass/fail verdict on the checker. Confirm
  the exact value against `IAllowlistChecker.sol` at the pinned commit (see
  [Packaging and Sources](../../permissioned-pools-issuer/references/packaging-and-sources.md))
  before drawing any conclusion from this second check — and even then, treat a `false` result as
  advisory pending that confirmation, not as proof the checker will fail Step 2.

- **`mode: "to-be-deployed"`** — `allowlistChecker.address` is `null`. The checker is your own
  contract; this skill does not write it for you, but the two legitimate shapes are in
  `permissioned-pools-issuer`'s
  [Contract Architecture](../../permissioned-pools-issuer/references/contract-architecture.md) —
  extend `BaseAllowlistChecker` (ERC-165 comes free) or implement `IAllowlistChecker` and
  `ERC165` directly (write `supportsInterface` yourself). Deploy it with `forge script`, never
  `forge create` — this repository's PreToolUse hook blocks `forge create` outright, and `forge
script` is the deployment path this skill uses everywhere else. Once deployed, run the same
  ERC-165 self-identification check above against the new address before moving on, and write the
  resulting address into the working config's `allowlistChecker.address` field, replacing `null`.

## Key Handling

> **Gate reminder, for anyone landing here directly:** every command in this section broadcasts,
> or directly prepares to broadcast, a transaction. Do not run or generate any of it before the
> acknowledgment gate in [the skill's main file](../SKILL.md#the-acknowledgment-gate) has been
> explicitly satisfied.

**Never instruct auto-approval of `Bash(forge:*)` or `Bash(cast:*)`, and never tell the user to
bypass a confirmation prompt.** Every command below that broadcasts a transaction needs
per-invocation approval — treat that approval as the primary control, with the repository's
PreToolUse hooks as a secondary, programmatic net.

### Option 1: Hardware wallet (recommended for anything beyond a testnet rehearsal)

```bash
forge script script/Example.s.sol:ExampleScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --ledger
```

### Option 2: Encrypted keystore

```bash
# One-time setup — prompts interactively, never accepts a key as a command-line argument
cast wallet import deployer --interactive

# Every subsequent command
forge script script/Example.s.sol:ExampleScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --account deployer --sender "$DEPLOYER_ADDRESS"
```

### Never this

Never use the `--private-key` flag. This is a prohibition on this skill, in every environment, not
a preference. Inside this repository only, `.claude/hooks/validate-forge-cast.sh` is a PreToolUse
hook that also blocks any command containing that flag before it runs — but that hook is not part
of this skill and is absent from any installation outside this repository, so never rely on it. Do
not suggest passing a key directly on the command line, in an env var
interpolated into the command line, or in a script argument. Neither `--account` nor `--ledger`
ever needs it.

### Testnet first

Run every step in [Step Walkthrough](./step-walkthrough.md) against Sepolia (chain ID
`11155111`) — or another testnet where the permissioned-pools contracts are deployed — before
repeating any of it against mainnet. Confirm the full
[Post-Setup Verification Checklist](../../permissioned-pools-issuer/references/issuer-journey.md#post-setup-verification-checklist)
passes on testnet first. Deploying to mainnet before a clean testnet run has completed is the
single highest-leverage mistake this skill can help someone avoid, because Step 4
(`verifyPermissionsAdapter`) is irreversible and the factory has no owner who could undo it.

## Related Reading

- [Step Walkthrough](./step-walkthrough.md) — Steps 2 through 7, as ordered command sequences.
- `permissioned-pools-issuer`'s
  [Packaging and Sources](../../permissioned-pools-issuer/references/packaging-and-sources.md) —
  the pinned commits, the Foundry remapping, and the full address-resolution rationale.
- `permissioned-pools-issuer`'s
  [Enforced Ordering and Reverts](../../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md) —
  the revert catalogue this walkthrough's precondition callouts are drawn from.
