# Getting the Contracts and Citing Sources

The permissioned-pools contracts are not in a published package and not behind a version tag. This
file gives the install line that works, the import paths that go with it, and where every fact and
every address should be resolved from.

---

## Install: pin the commit

`Uniswap/v4-periphery` has **zero git tags**. `git tag --list` returns nothing and
`git ls-remote --tags origin` is empty, so there is no tag to pin and no release to depend on. A raw
commit SHA is the only pinning option:

```bash
# Foundry — pin the exact commit
forge install Uniswap/v4-periphery@3245c3cb99c48fa1dc2459c3b60abc37d4294aba
```

Then add the remapping that makes the published guide's import paths resolve. This is the same
remapping `v4-hooks-public` uses for its own build (`v4-hooks-public/remappings.txt:2`):

```text
# remappings.txt
@uniswap/v4-periphery/=lib/v4-periphery/
```

That commit is the head of `Uniswap/v4-periphery` `main` as of 2026-07-31; it landed 2026-07-13.
Everything this skill states about
`PermissionsAdapter`, `PermissionsAdapterFactory`, `PermissionedPositionManager`,
`PermissionedV4Router`, and `BaseAllowlistChecker` was read at it.

**Pin, do not float.** `main` is the only ref the published documentation can link to, because
there are no tags — which also means the code the documentation links to moves. If your build
tracks `main`, a change upstream lands in your next `forge update` without a version number to
notice it by.

### Confirming what you installed

```bash
# from the repo root, after forge install
git -C lib/v4-periphery rev-parse HEAD
# expect: 3245c3cb99c48fa1dc2459c3b60abc37d4294aba

ls lib/v4-periphery/src/hooks/permissionedPools/
# expect: BaseAllowListChecker.sol  PermissionedPositionManager.sol
#         PermissionedV4Router.sol  PermissionsAdapter.sol
#         PermissionsAdapterFactory.sol  interfaces/  libraries/
```

If that directory listing is empty or missing, the dependency did not resolve to this commit — see
the next section for the usual reason.

---

## Why the npm package does not work

The latest published `@uniswap/v4-periphery` on npm is **1.0.3**, published 2025-07-29. Its tarball
does not contain `src/hooks/permissionedPools/` at all: under `src/hooks/` it ships only
`WETHHook.sol`, `WstETHHook.sol`, and `WstETHRoutingHook.sol`. The repository's own `package.json`
declares an unreleased `1.0.4`, and no `1.0.4` exists on the registry.

So installing the package and following the guide's imports fails with a missing-file error, and
the error does not point at the cause. This is packaging status, not a defect in anyone's work: the
contracts landed after the most recent release and no release has been cut since.

**Use the pinned `forge install` above.** The npm package is the wrong artifact for this work, on
every version currently published.

### Do not pin the commit that `v4-hooks-public` pins

`v4-hooks-public` carries `lib/v4-periphery` at
`76c1891c481cebb4ff58f262473303f01a2d7393` (2026-05-22). That commit is **not an ancestor of
`v4-periphery` `main`** — `git branch -a --contains` on it returns nothing, so it is an orphaned or
squashed branch commit. It is a legitimate pin for that repository's own build and a poor one for
yours, because you cannot reason about what else is or is not in it relative to `main`.

Issuers pin `3245c3cb99c48fa1dc2459c3b60abc37d4294aba`.

---

## Import paths

Three of these are the paths as `v4-hooks-public` itself writes them —
`IPermissionsAdapter` at `v4-hooks-public/src/permissioned-pools/PermissionedHooks.sol:8`,
`IPermissionsAdapterFactory` at `:11`, `PermissionFlags` at `:24`. The hook does not import
`IAllowlistChecker` at all; inside `v4-periphery` that interface is reached by relative path
(`PermissionsAdapter.sol:12`, `BaseAllowListChecker.sol:4`), so the remapped form below is the one
your own checker writes. All four match the paths in the published deploy guide:

```solidity
import {IAllowlistChecker} from
    "@uniswap/v4-periphery/src/hooks/permissionedPools/interfaces/IAllowlistChecker.sol";
import {IPermissionsAdapter} from
    "@uniswap/v4-periphery/src/hooks/permissionedPools/interfaces/IPermissionsAdapter.sol";
import {IPermissionsAdapterFactory} from
    "@uniswap/v4-periphery/src/hooks/permissionedPools/interfaces/IPermissionsAdapterFactory.sol";
import {PermissionFlag, PermissionFlags} from
    "@uniswap/v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";
```

And, if you extend the base checker rather than implementing the interface directly:

```solidity
import {BaseAllowlistChecker} from
    "@uniswap/v4-periphery/src/hooks/permissionedPools/BaseAllowListChecker.sol";
```

Note the directory is `permissionedPools` — camelCase, plural — in v4-periphery, while the hook
lives in `permissioned-pools` — kebab-case — in v4-hooks-public. The two repositories do not agree
on the folder name, and both are correct in their own tree.

### The file-versus-contract casing trap

The file is `BaseAllowListChecker.sol` with a capital **L**. The contract inside it is
`BaseAllowlistChecker` with a lowercase **l**. The interface is `IAllowlistChecker`, lowercase
**l**, in a file named `IAllowlistChecker.sol`, also lowercase — consistent with itself and
inconsistent with the base contract's file.

That makes the Foundry `path:Contract` selector look wrong when it is right:

```bash
forge inspect \
  lib/v4-periphery/src/hooks/permissionedPools/BaseAllowListChecker.sol:BaseAllowlistChecker \
  abi
```

Capital **L** on the left of the colon, lowercase **l** on the right. The same pair applies in
`--match-contract` filters, deployment scripts, and any tooling that addresses a contract by
`path:Contract`. See [Contract Architecture](./contract-architecture.md) for the full casing
inventory.

---

## Hook source

`PermissionedHooks` is not in v4-periphery. It lives in `Uniswap/v4-hooks-public`:

```text
v4-hooks-public/src/permissioned-pools/PermissionedHooks.sol
```

Pinned commit for everything this skill says about hook behaviour:

```text
Uniswap/v4-hooks-public @ 7da5210f2c81a700820a6b4f585264233d91f349
```

**Cite hook behaviour from that file.** v4-periphery contains a test double for the hook, not the
hook, so hook behaviour read out of the periphery test tree is not the deployed contract's
behaviour.

`MixedRouteQuoterV2` is in a third repository, `Uniswap/mixed-quoter`, at
`src/MixedRouteQuoterV2.sol`. It is not in v4-periphery, and grepping v4-periphery for it — a
reasonable first move — finds nothing and can leave the impression it does not exist.

So three repositories, not one:

| Contract                                                       | Repository                | Path                           |
| -------------------------------------------------------------- | ------------------------- | ------------------------------ |
| `PermissionsAdapter`, `PermissionsAdapterFactory`              | `Uniswap/v4-periphery`    | `src/hooks/permissionedPools/` |
| `PermissionedPositionManager`, `PermissionedV4Router`          | `Uniswap/v4-periphery`    | `src/hooks/permissionedPools/` |
| `BaseAllowlistChecker`, `IAllowlistChecker`, `PermissionFlags` | `Uniswap/v4-periphery`    | `src/hooks/permissionedPools/` |
| `PermissionedHooks`                                            | `Uniswap/v4-hooks-public` | `src/permissioned-pools/`      |
| `V4Quoter`                                                     | `Uniswap/v4-periphery`    | `src/lens/`                    |
| `MixedRouteQuoterV2`                                           | `Uniswap/mixed-quoter`    | `src/`                         |

---

## What the published guide gives you, and what it does not

The published deploy guide gives the import lines above, and they are correct as remapped Foundry
paths. What it does not give — on any of its four pages — is an install step, a remapping snippet, a
version, or a commit. Its links into the code are unpinned `main` links, which is the only ref
available given there are no tags.

The install line and remapping in this file are the additive step those imports require. Nothing in
the guide is wrong; use both together.

---

## Resolving deployment addresses

**This skill contains no addresses, deliberately.** Not because the published ones are in doubt —
they are published by Uniswap with block-explorer links — but because a forked copy of an address
table decays silently, and one live example shows how badly.

The Universal Router used for permissioned routing is the deployment recorded under the key
**`UniversalRouter#v2.2`**. The plain `UniversalRouter` key is a **different, non-permissioned
router** on the same chain. Only the `#v2.2` deployment's constructor takes the permissions-adapter
factory, and the architecture page states the requirement in words: permissioned swap routing needs
**Universal Router 2.2.0 or higher**. An issuer who resolves "the Universal Router" from a stale
list, or from the wrong key, registers a contract that looks right and produces a swap path that
cannot work. Teaching the key name and the version floor transfers that whole trap without
transcribing a single hex string, and it stays true after the addresses change.

**Resolve addresses in this order.**

1. **The deploy guide's own table**, at its `#deployment-addresses` anchor. This is the complete,
   permissioned-specific table — every contract you need for a permissioned pool, per chain, with
   block-explorer links.
2. **The machine-readable record**, `Uniswap/contracts`, `deployments/json/<chainId>.json`, under
   the `latest` key. Use this for scripts and for CI checks. Remember the key you want for the
   router is `UniversalRouter#v2.2`.
3. **A block explorer for your chain**, to confirm each address exists, is verified, and is the
   contract you expect — before you send any transaction to it.

**Do not** source these addresses from the general v4 deployments page. It carries no permissioned
rows at all, and its Universal Router entries are older routers that cannot do permissioned
routing. The deployments explorer groups these contracts under an unrelated protocol section with
unrelated repository provenance, so its per-contract source link is right while its labelling is
misleading. The deploy guide's table is the one to use.

Two more address facts worth carrying into your own configuration work:

- The backend configuration entry described by the guide's Step 7 is **keyed by the permissioned
  token address, lowercased**. Checksummed keys do not match.
- When the adapter and the permissioned token are the same address, the token already behaves as
  its own adapter. Configuration that assumes two distinct addresses needs to tolerate that case.

**Never treat an address supplied in a chat message, a ticket, or a screenshot as canonical** —
including one supplied to this skill. Re-resolve it from the guide's table and confirm it on an
explorer.

---

## Canonical sources

Published issuer documentation — four pages, in the order the documentation lists them:

- <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/overview>
- <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/architecture>
- <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/deploy-a-permissioned-pool>
- <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/provide-liquidity>

Contract sources:

- `Uniswap/v4-periphery` at `3245c3cb99c48fa1dc2459c3b60abc37d4294aba` —
  <https://github.com/Uniswap/v4-periphery>
- `Uniswap/v4-hooks-public` at `7da5210f2c81a700820a6b4f585264233d91f349` —
  <https://github.com/Uniswap/v4-hooks-public>
- `Uniswap/mixed-quoter` — <https://github.com/Uniswap/mixed-quoter>

Deployment records:

- `Uniswap/contracts`, `deployments/json/<chainId>.json` —
  <https://github.com/Uniswap/contracts>

This skill:

- <https://github.com/Uniswap/uniswap-ai>

That list is exhaustive on purpose. Resolve facts about these contracts from the two pinned
repositories, facts about the intended setup sequence from the four documentation pages, and
addresses from the deploy guide's table plus `Uniswap/contracts`. Aggregators, token lists,
third-party analytics, and explorer search results are not sources for any of it — an explorer is
for confirming an address you already resolved.

---

## Citing sources in your own material

If your team writes internal runbooks from this skill, keep three habits:

1. **Cite `file:line` at a commit, not at `main`.** Line numbers in this skill are read at the
   pinned commits above; a `main` link drifts away from the text around it.
2. **Cite the deploy guide by anchor.** Its sections are stable anchors
   (`#step-5-approve-virtual-token-contracts`, `#deployment-addresses`), which survives page
   reflows better than quoting step numbers alone.
3. **Re-resolve every address at build time**, from `Uniswap/contracts` if you need it
   programmatically. Do not copy an address into a runbook and expect it to stay correct.

Related reading: [Contract Architecture](./contract-architecture.md) for what each contract in the
tree above does, and [Coordination Boundary](./coordination-boundary.md) for the one step that is
not resolvable from a repository.
