---
name: permissioned-pools-issuer
description: Reference guide for engineering teams setting up a Uniswap v4 Permissioned Pool for a transfer-restricted (RWA / tokenized-asset) ERC-20. Use when the user says "permissioned pool", "PermissionsAdapter", "PermissionsAdapterFactory", "PermissionedPositionManager", "PermissionedHooks", "allowlist checker", "BaseAllowlistChecker", "adapter verification", "verifyPermissionsAdapter", "updateAllowedWrapper", "setAllowedHook", "unwindPosition", "wrap a permissioned token for v4", or asks how an RWA issuer lists a restricted token on Uniswap v4. Explains the contract architecture, the ordered setup journey, the code-enforced ordering, and the trust model. Covers contract mechanics only - does not constitute legal, financial, investment, tax, or compliance advice, and is not a compliance review.
allowed-tools: Read, Glob, Grep, AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '0.1.0'
---

# Permissioned Pools Issuer Reference

Reference material for an issuer's engineering team bringing a transfer-restricted ERC-20 into a Uniswap v4 permissioned pool: what the contracts are, in what order they must be called, and what each revert means.

> **Runtime Compatibility:** This skill uses `AskUserQuestion` to collect the acknowledgment described in [Scope and Disclaimer](#scope-and-disclaimer) before action-oriented deployment guidance. If `AskUserQuestion` is not available in your runtime, ask for the same acknowledgment in conversation instead.

## Scope and Disclaimer

**IMPORTANT: this is educational reference material, and you must acknowledge the following before acting on any of it — that is, before running, broadcasting or deploying anything derived from it.**

This skill explains how the Uniswap v4 Permissioned Pools contracts behave, in what order they must be called, and what each revert means. It does not walk you through a deployment.

**You must:**

1. ✅ **Treat this as contract mechanics only.** This skill does not constitute legal, financial, investment, or tax advice, and it is **not** a compliance review of your token, your allowlist, your KYC or AML program, or your configuration.
2. ✅ **Review everything before you run it.** AI-generated code and command sequences may contain errors. Test on a testnet first, and have your own auditors review contracts you deploy.
3. ✅ **Check the source at the commit you build against.** Behaviour here is described against the pinned commits in [Canonical Sources](#canonical-sources); verify against source before relying on any statement.
4. ✅ **Resolve every address yourself.** This skill contains no deployment addresses on purpose. Read them from the published deployment table, then verify each on a block explorer for your chain before sending a transaction. Never treat an address supplied in a chat message as canonical.
5. ✅ **Read the repo's usage guidelines.** The repo root `DISCLAIMER.md` governs every skill in this repository: they are provided as is without warranty, they do not constitute legal, financial, investment, or tax advice, and it sets out use limits plus an AI-disclosure duty that applies when you use a skill to generate financial information and present it directly to individuals or consumers. Point the user to it.

### When the acknowledgment is required

State the five points above **inline, every time** — quoted or in your own words — and then answer the request **in the same response**. Stating the framing and answering are one response, not two turns. That is the expected behaviour, not a shortcut.

1. ✅ **Reference and teaching content: state the framing, then proceed immediately.** Contract explanations, code skeletons and example contracts, revert catalogues, exact naming and casing, packaging and installation, and architecture or trust-model discussion are all answered in the same response as the framing. Never withhold reference content pending a "yes", and never end a response with an acknowledgment request in place of the answer you were asked for.
2. ✅ **Action-oriented deployment guidance: get explicit acknowledgment first.** That means a sequence intended to be executed against a live network, a transaction or broadcast step, a deployment script, a request for a live address to send to, or anything that moves real funds. Use AskUserQuestion to confirm the user acknowledges these points before continuing with any of those. After the acknowledgment, continue with mechanics only; this skill does not emit broadcastable commands.

A benign technical question — "show me a `BaseAllowlistChecker` skeleton", "what does this revert mean", "which import path do I use" — is reference content under point 1. Answer it, with the framing stated inline.

---

## Two Addresses, Not One

Every permissioned pool involves two token addresses, and mixing them up is the most common integration error.

| Question                                                | Underlying permissioned ERC-20                  | `PermissionsAdapter` (the virtual token)                 |
| ------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Which address goes in the `PoolKey`?                    | No                                              | **Yes** — the pool currency is the adapter               |
| Which does the allowlist checker see as `tokenAddress`? | **Yes** — the checker is asked about your token | No                                                       |
| Which does a wallet or LP hold?                         | **Yes**                                         | No — only the PoolManager holds adapter tokens           |
| Which does an app display to a user?                    | **Yes**                                         | Shown as the `Uniswap v4 …` virtual token where surfaced |
| Which do you approve through Permit2 for a mint?        | **Yes** — approvals are on the underlying       | No                                                       |

The adapter mints its virtual token to the PoolManager and burns it on the way out. Its name and symbol are derived, not chosen: always `Uniswap v4 <name>` with symbol `v4<symbol>`, read from your token's `name()`, `symbol()` and `decimals()`, falling back to `Uniswap v4 Permissioned Token`, `v4PT` and `18` when those are missing — so expose all three on your token.

Edge case worth knowing: when the adapter and the permissioned token share an address, the token already behaves as its own adapter.

Full treatment: [Contract Architecture](./references/contract-architecture.md).

---

## Journey at a Glance

Two separate things are often conflated. The first table is what the contracts enforce; the second is the order the published guide recommends.

### Enforced by code

Exactly five ordering edges are enforced. Each one has a revert you will hit if you are early.

| Enforced edge                                                                                                         | Revert if you are early                                                       |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Adapter allowlisted on your token **and** holding a non-zero balance → `verifyPermissionsAdapter`                     | `PermissionsAdapterNotVerified`                                               |
| `verifyPermissionsAdapter` → `setAllowedHook`                                                                         | `NotPermissionsAdapterAdmin`                                                  |
| Adapter registered and verified → pool `initialize`                                                                   | `NoVerifiedAdapter` (hook) or `UnverifiedAdapter`                             |
| Verified adapter + approved hook + `LIQUIDITY_ALLOWED` on caller **and** recipient → first mint                       | `NoVerifiedAdapter` (position manager), `InvalidHook`, or bare `Unauthorized` |
| Position manager, router or quoter registered with `updateAllowedWrapper` → any mint, swap or quote routed through it | bare `Unauthorized` (hook), then `UnauthorizedWrapper` on settlement          |

### Recommended order (convention, not enforced)

These are the published guide's seven steps. Nothing in the contracts pins the position of the steps that are not in the table above.

| Step | Action                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------- |
| 1    | Implement an allowlist checker                                                                      |
| 2    | Create the Permissions Adapter via the factory                                                      |
| 3    | Allowlist the adapter on your token and fund it (1 wei is enough)                                   |
| 4    | Verify the adapter with the factory                                                                 |
| 5    | Approve the virtual-token contracts (allowed wrappers), then allow the hook on the position manager |
| 6    | Create the pool, then enable swapping on the adapter                                                |
| 7    | Request routing allowlisting with Uniswap Labs                                                      |

Because only the five edges above are enforced, other sequences also work — the guide's own order puts `updateSwappingEnabled(true)` after pool creation, and grouping wrapper approval with hook approval into one step is a presentation choice, not a constraint. Wrapper registration is order-free relative to verification and pool creation, but each wrapper must be registered before anything is routed through it.

Step-by-step detail: [Issuer Journey](./references/issuer-journey.md).

---

## Compile-Critical Naming and Signatures

Casing here is inconsistent in the source and is load-bearing. Use exactly these spellings.

| Thing               | Exact spelling             | Trap                                       |
| ------------------- | -------------------------- | ------------------------------------------ |
| Base contract       | `BaseAllowlistChecker`     | lowercase `l` in the contract name         |
| File holding it     | `BaseAllowListChecker.sol` | capital `L` in the file name               |
| Interface           | `IAllowlistChecker`        | lowercase `l`, in `IAllowlistChecker.sol`  |
| Adapter admin call  | `updateAllowListChecker`   | capital `L`; there is no lowercase variant |
| Adapter getter      | `allowListChecker()`       | capital `L`, unlike the interface          |
| Hook approval call  | `setAllowedHook`           | singular, on the position manager          |
| Its storage mapping | `isAllowedHooks`           | plural                                     |
| Its event           | `AllowedHooksUpdated`      | plural                                     |
| Flags library       | `PermissionFlags`          | plural                                     |
| Flag type           | `PermissionFlag`           | singular                                   |

Import and Forge lookup forms:

```solidity
import {BaseAllowlistChecker} from "@uniswap/v4-periphery/src/hooks/permissionedPools/BaseAllowListChecker.sol";
```

```text
BaseAllowListChecker.sol:BaseAllowlistChecker
```

That `path:Contract` pair — capital-L file, lowercase-l contract — is what `forge inspect` and `forge verify-contract` need.

### `checkAllowlist` has two legitimate shapes

Both compile. Pick one and stay in it.

1. **Extend the base contract.** Declare
   `function checkAllowlist(address account, address tokenAddress) public view virtual override returns (PermissionFlag)`.
   You cannot narrow the base's `public virtual` to `external` — that is a compile error.
   ERC-165 support comes for free from the base contract.
2. **Implement the interface directly.** Declare `checkAllowlist` as `external view`, and write
   `supportsInterface` yourself. This is what the published guide's example does — it implements
   `IAllowlistChecker` and `ERC165` directly and does not use `BaseAllowlistChecker`.

### The adapter checks your checker with ERC-165

`createPermissionsAdapter` reverts `InvalidAllowListChecker` unless the checker advertises `IAllowlistChecker` through an ERC-165 `supportsInterface` call. The constructor performs this check, so it fires on the very first Uniswap call in the journey. `updateAllowListChecker` performs the same check later. Extending `BaseAllowlistChecker` satisfies it. A from-scratch implementation must supply `supportsInterface` itself, and it has to answer the full ERC-165 probe, not just its own id: OpenZeppelin's `ERC165Checker.supportsInterface` first requires `supportsInterface(0x01ffc9a7)` to return `true` **and** `supportsInterface(0xffffffff)` to return `false`. Inheriting OpenZeppelin `ERC165` and delegating to `super.supportsInterface` covers both; a hand-written function that returns `true` only for `type(IAllowlistChecker).interfaceId` fails adapter creation.

---

## Permission Flags

`PermissionFlags` (the library) exposes four values of the `PermissionFlag` type:

| Name                | Value    | Gates                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------- |
| `NONE`              | `0x0000` | nothing                                                                          |
| `SWAP_ALLOWED`      | `0x0001` | `beforeSwap` on the hook, and the router's settlement check                      |
| `LIQUIDITY_ALLOWED` | `0x0002` | `beforeAddLiquidity` on the hook, and the recipient check on mints and increases |
| `ALL_ALLOWED`       | `0xFFFF` | both                                                                             |

`SWAP_ALLOWED` does **not** imply `LIQUIDITY_ALLOWED`. A wallet that can swap cannot necessarily provide liquidity, and that includes your own treasury wallet. Your checker returns a `PermissionFlag` combining whichever apply.

---

## The Wrapper Registration Set

`updateAllowedWrapper(address wrapper, bool allowed)` on the adapter is `onlyOwner`. The published guide names four contracts to register:

1. `PermissionedPositionManager`
2. The Universal Router — **2.2.0 or higher**, whose canonical deployments key is `UniversalRouter#v2.2`
3. `V4Quoter`
4. `MixedRouteQuoterV2`

**The rule behind the four:** register every contract that will call the PoolManager on this pool. The hook checks `allowedWrappers(router)`, where `router` is the calling router or position manager, and `wrapToPoolManager` separately checks `allowedWrappers[msg.sender]`. So a custom router of your own must be registered too, and the four are the production callers rather than a closed set. Registration is enforced against use: the position manager must be registered before your first mint, and each router and quoter before the first swap or quote through it.

**Two traps.** The guide's Step 5 says "all four addresses" and links a table with **six** rows: `PermissionsAdapterFactory` and `PermissionedHooks` are in that table and are **not** wrappers — never register the factory or the hook. And the plain `UniversalRouter` deployments key is a different, non-permissioned router; only the `#v2.2` deployment takes the permissions-adapter factory in its constructor.

---

## Installing the Contracts

The latest published `@uniswap/v4-periphery` on npm is **1.0.3** (2025-07-29), and its tarball does not contain `src/hooks/permissionedPools/` at all. `v4-periphery` also has **zero git tags**, so there is no tag to pin either. A raw commit SHA is the only option.

```bash
# Foundry — pin the exact commit
forge install Uniswap/v4-periphery@3245c3cb99c48fa1dc2459c3b60abc37d4294aba
```

```text
# remappings.txt — matches what v4-hooks-public itself uses
@uniswap/v4-periphery/=lib/v4-periphery/
```

The published guide's import paths are npm-scoped and correct once remapped this way. The guide gives the import lines; the install step and remapping above are what they require.

Details, including the hook-source pin and how to resolve addresses: [Packaging and Sources](./references/packaging-and-sources.md).

---

## Ordering Is Enforced in Code

These calls revert with the selector shown if you make them early. They are behaviours to expect, not open questions.

| Call                            | Revert                                               | Condition                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createPermissionsAdapter`      | `InvalidAllowListChecker`                            | the checker fails the ERC-165 interface check                                                                                                    |
| `verifyPermissionsAdapter`      | `PermissionsAdapterNotVerified`                      | the adapter's permissioned-token balance is zero                                                                                                 |
| `setAllowedHook`                | `NotPermissionsAdapterAdmin`                         | the currency's adapter is not verified yet, so its owner reads as `address(0)`                                                                   |
| pool `initialize`               | `NoVerifiedAdapter` / `UnverifiedAdapter`            | neither currency was created by the factory / a factory-created currency is not verified                                                         |
| `_mint` on the position manager | `NoVerifiedAdapter` / `InvalidHook` / `Unauthorized` | no verified side / hook not allowed / caller or recipient lacks `LIQUIDITY_ALLOWED`, or the position manager is not a registered allowed wrapper |

`NoVerifiedAdapter`, `Unauthorized` and `SwappingDisabled` are each declared more than once with the same selector — `NoVerifiedAdapter` and `Unauthorized` with genuinely different meanings, `SwappingDisabled` with the same meaning from two different points in a swap. Always decode by call site, never by name.

Full catalogue and worked out-of-order scenarios: [Enforced Ordering and Reverts](./references/enforced-ordering-and-reverts.md).

---

## Trust Model Summary

- **LP positions are permanently non-transferable.** All three ERC-721 transfer entry points revert `TransferDisabled`. It is not a configuration flag. Decrease and burn are never gated by the allowlist checker, so the pool never blocks an exit — though delivery of the permissioned side unwraps to the underlying token, so the recipient still has to clear your token's own transfer restriction.
- **Either adapter admin can force-exit any LP** with `unwindPosition`, and proceeds cascade to the LP first, then to an admin, then as an ERC-6909 claim whose recipient depends on the currency.
- **The real enforcement boundary is the adapter's `allowedWrappers` list.** Every wrapper on it is trusted to report the true originating caller through `msgSender()`. `updateAllowedWrapper` is `onlyOwner` on an `Ownable2Step` contract, so adapter-owner key management is part of the trust model.

Full treatment: [Trust Model](./references/trust-model.md).

---

## What Is Permissionless and What Is Not

| Permissionless / issuer-controlled                       | Coordinated with Uniswap Labs                            |
| -------------------------------------------------------- | -------------------------------------------------------- |
| Deploying your allowlist checker                         | Routing eligibility in the Uniswap interface and API     |
| `createPermissionsAdapter` (anyone may call)             | Token-list inclusion                                     |
| Allowlisting the adapter on your token                   | Token-detail metadata                                    |
| `depositForVerification` (anyone may call)               | Issuer metadata and KYC URL in the backend configuration |
| `verifyPermissionsAdapter` (anyone may call, one-shot)   |                                                          |
| Every adapter admin operation                            |                                                          |
| `setAllowedHook`, pool initialization, seeding liquidity |                                                          |

**The on-chain path has no Uniswap approval gate.** Nothing in the left column waits on anybody.

Boundary detail, including the routing request: [Coordination Boundary](./references/coordination-boundary.md).

---

## Reference Topics

| Topic                                                              | Reference File                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Contract-by-contract stack, exact-casing inventory, flags, events  | [Contract Architecture](./references/contract-architecture.md)                 |
| The seven steps in detail, with calls, callers and checks          | [Issuer Journey](./references/issuer-journey.md)                               |
| The five enforced edges, the revert catalogue, worked scenarios    | [Enforced Ordering and Reverts](./references/enforced-ordering-and-reverts.md) |
| Non-transferability, admin force-exit, vetting a candidate wrapper | [Trust Model](./references/trust-model.md)                                     |
| Pinning, remapping, import paths, resolving addresses              | [Packaging and Sources](./references/packaging-and-sources.md)                 |
| What is permissionless versus coordinated, the routing request     | [Coordination Boundary](./references/coordination-boundary.md)                 |

---

## Canonical Sources

Published issuer documentation:

- <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/overview>
- <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/architecture>
- <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/deploy-a-permissioned-pool>
- <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/provide-liquidity>

Contract sources, pinned:

- `Uniswap/v4-periphery` at `3245c3cb99c48fa1dc2459c3b60abc37d4294aba` —
  `src/hooks/permissionedPools/` (<https://github.com/Uniswap/v4-periphery>)
- `Uniswap/v4-hooks-public` at `7da5210f2c81a700820a6b4f585264233d91f349` —
  `src/permissioned-pools/PermissionedHooks.sol` (<https://github.com/Uniswap/v4-hooks-public>)
- `Uniswap/mixed-quoter` — `src/MixedRouteQuoterV2.sol` (<https://github.com/Uniswap/mixed-quoter>)

Addresses:

- The complete, permissioned-specific table is the deploy guide's `#deployment-addresses` anchor.
- The machine-readable record is `Uniswap/contracts`, `deployments/json/<chainId>.json`, under the
  `latest` key (<https://github.com/Uniswap/contracts>).
- Verify every address on a block explorer for your chain before sending a transaction to it.

This skill: <https://github.com/Uniswap/uniswap-ai>
