# Enforced Ordering and What Each Revert Means

A decoder ring for the reverts you will encounter while bringing a permissioned pool up.

Ordering in this stack is enforced by the contracts themselves. When you call something before its precondition holds, the call reverts with a specific selector — deterministically, on every attempt, before any state changes. That is what the rest of this file catalogues: **reverts that will happen**, and what each one is telling you.

Two working rules carry most of the value here:

1. **Only five ordering edges are enforced.** Everything else in the setup sequence is convention. A step
   that is unenforced has no revert attached to it, and this file does not pretend otherwise.
2. **Decode a revert by its call site, never by its name.** Three of the selectors below are declared more
   than once, in different contracts, with different meanings.

---

## The Five Enforced Edges

| Enforced edge                                                                                    | Revert if you are early                                                  | Where the check lives                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter allowlisted on the token **and** holding a non-zero balance → `verifyPermissionsAdapter` | `PermissionsAdapterNotVerified(adapter)`                                 | `PermissionsAdapterFactory.sol:42`                                                                                                                                                     |
| `verifyPermissionsAdapter` → `setAllowedHook`                                                    | `NotPermissionsAdapterAdmin()`                                           | `PermissionedPositionManager.sol:68-70`, via `_getOwner` at `:270-275`                                                                                                                 |
| Adapter created by the factory and verified → pool `initialize`                                  | `NoVerifiedAdapter()` or `UnverifiedAdapter()`                           | `PermissionedHooks.sol:81`, `:82-87`                                                                                                                                                   |
| Verified adapter + approved hook + `LIQUIDITY_ALLOWED` on caller **and** recipient → first mint  | `NoVerifiedAdapter()`, `InvalidHook()`, or bare `Unauthorized()`         | `PermissionedPositionManager.sol:157-160`, `:162`, `:201-207`, plus the hook's `beforeAddLiquidity`                                                                                    |
| The calling contract registered with `updateAllowedWrapper` → any mint, swap or quote through it | bare `Unauthorized()`, then `UnauthorizedWrapper(wrapper)` on settlement | `PermissionedHooks.sol:151-154` (`allowedWrappers(router)`, where `router` is the position manager or router that called the PoolManager, `:131-136`), and `PermissionsAdapter.sol:46` |

There is also one precondition that is not an ordering edge between steps but fires on the very first Uniswap call: `createPermissionsAdapter` reverts `InvalidAllowListChecker(checker)` when your checker does not advertise `IAllowlistChecker` through ERC-165.

## What Is Not Enforced

None of these is enforced against the position of another setup step, because nothing in the code depends on where it falls in the sequence. Where one of them is nonetheless enforced against _use_, the bullet says so:

- **`updateAllowedWrapper` relative to verification and pool creation.** An `onlyOwner` call on the
  adapter, with no dependency on verification or on the pool existing. Register wrappers before or after
  pool creation. What _is_ enforced is the fifth edge above: nothing can be routed through a contract
  that is not registered, so the position manager must be registered before the first mint and each
  router and quoter before the first swap or quote.
- **`updateSwappingEnabled`.** Same — `onlyOwner` on the adapter, independent of the pool. The published
  guide puts it _after_ pool creation.
- **`setAllowedHook` relative to `initialize`.** Enforced against _verification_ but not against pool
  creation. Approve the hook before or after initializing; both work.

The published guide orders two of these differently from a "configure everything, then create the pool" reading, and both sequences work. If a sequence you are given differs from the guide's, check it against the five enforced edges above rather than assuming one of them is wrong.

---

## Revert Catalogue

Grouped by declaring contract. `IPermissionsAdapter.sol`, `PermissionsAdapter.sol`, `PermissionsAdapterFactory.sol`, `PermissionedPositionManager.sol`, `PermissionedV4Router.sol` and `IERC721Permit_v4.sol` are in `Uniswap/v4-periphery`; `PermissionedHooks.sol` is in `Uniswap/v4-hooks-public`.

### Declared on the adapter interface

| Selector                                                        | Declared                     | Raised                                                                                                                                | Condition                                                                                                                                                                                                         |
| --------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InvalidAllowListChecker(IAllowlistChecker)`                    | `IPermissionsAdapter.sol:23` | `PermissionsAdapter._updateAllowListChecker:78-81`, reached from the constructor (`:33-42`) and from `updateAllowListChecker` (`:59`) | the checker fails `ERC165Checker.supportsInterface(checker, type(IAllowlistChecker).interfaceId)`                                                                                                                 |
| `InvalidTransfer(address from, address to)`                     | `IPermissionsAdapter.sol:26` | `PermissionsAdapter` transfer hook, `:113` and `:116` (the same `_update` path that calls `_unwrap` at `:118`)                        | any adapter-token transfer other than PoolManager → a distinct recipient — including a PoolManager → PoolManager self-transfer (`:115-116`, "reject self-transfer: would unwrap raw underlying into PoolManager") |
| `UnauthorizedWrapper(address wrapper)`                          | `IPermissionsAdapter.sol:29` | `PermissionsAdapter.wrapToPoolManager:46`                                                                                             | `!allowedWrappers[msg.sender]`                                                                                                                                                                                    |
| `InsufficientBalance(uint256 amount, uint256 availableBalance)` | `IPermissionsAdapter.sol:32` | `PermissionsAdapter.wrapToPoolManager` (`:45-50`)                                                                                     | requested amount exceeds `balanceOf(adapter) - totalSupply()` (`:47`)                                                                                                                                             |

`InvalidTransfer` is the enforcement behind "only the PoolManager holds the adapter token". If you were expecting the virtual token to circulate, this is the selector telling you it does not.

### Declared on the factory

| Selector                                     | Raised                                | Condition                                                                              |
| -------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| `PermissionsAdapterNotFound(address)`        | `PermissionsAdapterFactory.sol:37`    | the address was never created by this factory (`permissionsAdapterOf` is `address(0)`) |
| `PermissionsAdapterAlreadyVerified(address)` | `PermissionsAdapterFactory.sol:38-40` | a second verification attempt                                                          |
| `PermissionsAdapterNotVerified(address)`     | `PermissionsAdapterFactory.sol:42`    | `permissionedToken.balanceOf(permissionsAdapter) == 0`                                 |

`PermissionsAdapterAlreadyVerified` is worth internalizing for what it implies rather than as a failure: verification is one-shot, so it can never be revoked.

### Declared on the position manager

| Selector                       | Declared                                | Raised                                                                      | Condition                                                                                                      |
| ------------------------------ | --------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `InvalidHook()`                | `PermissionedPositionManager.sol:40-43` | `_mint:162`, `_increase:181`, `_increaseFromDeltas:194`                     | the pool's hook is not allowed for that currency on **this** position manager                                  |
| `TransferDisabled()`           | `:41`                                   | `transferFrom:131`, `safeTransferFrom:135`, `safeTransferFrom(…,bytes):139` | always — unconditional                                                                                         |
| `NotPermissionsAdapterAdmin()` | `:42`                                   | `setAllowedHook:69` — the **only** raise site                               | `_getOwner(currency) != msg.sender`, including when `_getOwner` returns `address(0)` for an unverified adapter |
| `NoVerifiedAdapter()`          | `:43`                                   | `_mint:157-160`                                                             | neither currency is a **verified** adapter                                                                     |

### Declared on the hook

| Selector              | Declared                   | Raised                                                      | Condition                                                                 |
| --------------------- | -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Unauthorized()`      | `PermissionedHooks.sol:55` | `_isAllowed:151-154`                                        | `!isAllowed(sender, permission)` **or** `!allowedWrappers(router)`        |
| `SwappingDisabled()`  | `:56`                      | `_isAllowed:146`                                            | `!swappingEnabled()` on the adapter, checked **before** the wrapper check |
| `NoVerifiedAdapter()` | `:57`                      | `_beforeInitialize:81`                                      | neither pool currency was **created by the factory**                      |
| `UnverifiedAdapter()` | `:58`                      | `_beforeInitialize:82-84` (currency0), `:85-87` (currency1) | the currency is a factory-created adapter but is not verified             |

### Declared on the router

| Selector             | Declared                      | Raised       | Condition                                             |
| -------------------- | ----------------------------- | ------------ | ----------------------------------------------------- |
| `Unauthorized()`     | `PermissionedV4Router.sol:16` | `_pay:36-38` | `!isAllowed(msgSender(), SWAP_ALLOWED)`               |
| `SwappingDisabled()` | `PermissionedV4Router.sol:17` | `:35`        | `!permissionsAdapter.swappingEnabled()` on settlement |

### Inherited, and easy to misattribute

| Selector         | Declared                                             | Raised inside the position manager                                                                     |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Unauthorized()` | `v4-periphery/src/interfaces/IERC721Permit_v4.sol:9` | `unwindPosition:86`, `_checkRecipientAllowed:204-206`, `_pay:231-233`, `_handleAction:285-286`, `:300` |

The position manager's own `error` block declares only `InvalidHook`, `TransferDisabled`, `NotPermissionsAdapterAdmin` and `NoVerifiedAdapter`. The bare `Unauthorized()` you get from a mint is inherited from `IERC721Permit_v4`, not declared there — so searching the position manager for its declaration will not find it.

---

## Three Names That Mean More Than One Thing

### `NoVerifiedAdapter` is declared twice, with different meanings

Same name, same selector, two independent declarations in two contracts.

| Raised from                                 | What it actually means                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PermissionedHooks._beforeInitialize:81`    | **neither currency was created by the factory.** The hook decides "is an adapter" using `permissionsAdapterOf` — _registered_ — not `verifiedPermissionsAdapterOf` |
| `PermissionedPositionManager._mint:157-160` | neither side is **verified**                                                                                                                                       |

The hook's version is the counter-intuitive one: despite the name, it is not telling you "verify your adapter". It is telling you neither address in your `PoolKey` came out of the factory at all — a wrong currency, or the underlying token where the adapter belongs. The selector that genuinely means "created but not verified" is `UnverifiedAdapter`.

### `Unauthorized` is declared three times

`PermissionedHooks.sol:55` (allowlist or wrapper check failed), `PermissionedV4Router.sol:16` (the payer lacks `SWAP_ALLOWED` at settlement), and `IERC721Permit_v4.sol:9` inherited into the position manager (caller or recipient not permitted, including the mint recipient check and the `unwindPosition` admin check). A bare `Unauthorized()` on its own tells you almost nothing; the call you made tells you everything.

### `SwappingDisabled` is declared twice

`PermissionedHooks.sol:56` and `PermissionedV4Router.sol:17`. Both mean `swappingEnabled()` is `false` on the adapter, but they fire at different points in a swap — the hook first, the router again on settlement.

**One more thing to expect:** the published documentation names neither `NoVerifiedAdapter` nor `UnverifiedAdapter` anywhere. It describes the behaviour correctly but without the selector, so a reader arriving from the guide has no prior for these names at all. Decode by call site.

---

## How to Decode an Unexpected Revert

When a selector arrives that you did not predict, work it in this order rather than searching the name:

1. **Identify the entry point you called** — the adapter, the factory, the position manager, a router, or
   a quoter. This alone disambiguates `Unauthorized`, `SwappingDisabled` and `NoVerifiedAdapter`.
2. **Check verification state.** Read `permissionsAdapterOf(adapter)` and
   `verifiedPermissionsAdapterOf(adapter)`. An empty first mapping means the address never came from the
   factory; an empty second means Step 4 has not landed. Three of the five enforced edges resolve here.
3. **Check the flags for the exact addresses involved.** `isAllowed(caller, …)` and
   `isAllowed(recipient, …)` are different questions, and `SWAP_ALLOWED` is a different question from
   `LIQUIDITY_ALLOWED`.
4. **Check `allowedWrappers` for the contract that actually reached the PoolManager** — which is the
   router, position manager or quoter, not the wallet that started the transaction.
5. **Check `swappingEnabled()`** if the failing operation is a swap. It is checked before the wrapper
   check, so it can mask a second problem.
6. **Only then compare against the catalogue above,** matching on the raise site rather than the name.

A revert that survives all six is more likely an argument mix-up between the underlying token and the adapter than a protocol behaviour — see the address table in [Issuer Journey](./issuer-journey.md).

---

## Worked Scenarios

Each one is "I called things in this order, and here is what happened."

### Scenario 1: initialize the pool before verifying the adapter

**You did:** created the adapter (Step 2), skipped Steps 3 and 4, went straight to pool initialization with the adapter as a currency.

**What happens:** `UnverifiedAdapter()` from `PermissionedHooks._beforeInitialize` (`:82-87`).

**Why:** the currency _is_ a factory-created adapter, so the hook recognizes it — and then rejects it because `verifiedPermissionsAdapterOf` is still `address(0)`.

**Fix:** allowlist the adapter on your token, seed it with 1 wei, call `verifyPermissionsAdapter`, then initialize.

### Scenario 2: initialize with the underlying token instead of the adapter

**You did:** built the `PoolKey` with your permissioned ERC-20 as a currency.

**What happens:** `NoVerifiedAdapter()` from the hook (`:81`).

**Why:** neither currency was created by the factory. Despite the selector's name this is not a verification problem — it is the wrong address in the `PoolKey`.

**Fix:** use the adapter address as the pool currency.

### Scenario 3: mint before the adapter is verified

**You did:** initialized somehow, then tried to mint a position where no side is a verified adapter.

**What happens:** `NoVerifiedAdapter()` from `PermissionedPositionManager._mint` (`:157-160`).

**Why:** the mint path requires at least one verified adapter currency. Note this is the _position manager's_ declaration of that name, not the hook's.

**Fix:** verify the adapter first.

### Scenario 4: `setAllowedHook` before verification

**You did:** created the adapter, are unambiguously its owner, and called `setAllowedHook` before Step 4.

**What happens:** `NotPermissionsAdapterAdmin()` (`PermissionedPositionManager.sol:68-70`).

**Why:** authorization is `_getOwner(currency) != msg.sender`, and `_getOwner` (`:270-275`) returns `address(0)` for a currency whose adapter is not verified. You are the owner; the position manager cannot see that yet.

**Fix:** verify, then approve the hook. This is why the guide's order puts verification first — it does not say why.

### Scenario 5: the first seeding mint from a wallet that is not on your own allowlist

**You did:** adapter created and verified, hook approved, pool initialized. Your treasury multisig — which is the adapter owner — attempts the first mint and gets a bare `Unauthorized()`.

**What happens:** four checks can produce the same bare selector. The position manager checks the **recipient** for each currency (`_checkRecipientAllowed`, `:201-207`) and the **sender** on settlement (`_pay:231-233`, `isAllowed(msgSender(), LIQUIDITY_ALLOWED)`); the hook independently checks the **caller** in `beforeAddLiquidity` and, in the same expression, that the **position manager is a registered allowed wrapper** (`PermissionedHooks.sol:151-154`). Rule out the wrapper registration first — it is the one that is not about your allowlist at all.

**Why:** being the adapter owner grants nothing on the liquidity path, and `SWAP_ALLOWED` does not imply `LIQUIDITY_ALLOWED`.

**Fix:** confirm `allowedWrappers(permissionedPositionManager)` is `true` on the adapter, then allowlist the sending wallet **and** the position recipient with `LIQUIDITY_ALLOWED` before the first mint, and retry. Confirm the allowlist half with `isAllowed(wallet, PermissionFlags.LIQUIDITY_ALLOWED)` on the adapter for both addresses.

### Scenario 6: swap while swapping is still disabled

**You did:** completed everything except `updateSwappingEnabled(true)`, then attempted a swap.

**What happens:** `SwappingDisabled()` from `PermissionedHooks._isAllowed:146`.

**Why:** `swappingEnabled` defaults to `false` (`PermissionsAdapter.sol:28`), and the hook checks it **before** the wrapper check — so this selector arrives even if your wrapper list is also incomplete. Fixing the flag can surface a second, different revert.

**Fix:** `updateSwappingEnabled(true)` as the adapter owner. Note there is no equivalent flag for liquidity.

### Scenario 7: swap through a router that is not a registered wrapper

**You did:** enabled swapping, but routed through a router that is not on `allowedWrappers` — or through the plain `UniversalRouter` deployment instead of the `#v2.2` one.

**What happens:** `Unauthorized()` from `PermissionedHooks._isAllowed:151-154`.

**Why:** the check is `isAllowed(sender, permission) && allowedWrappers(router)`; the second half fails. The same selector covers both halves, so it does not distinguish "the swapper is not allowlisted" from "the router is not registered".

**Fix:** register the router with `updateAllowedWrapper`, and confirm you resolved the Universal Router at 2.2.0 or higher.

### Scenario 8: quote against the pool with an unregistered quoter

**You did:** registered the position manager and the router, skipped `V4Quoter` or `MixedRouteQuoterV2`, then asked your interface for a price.

**What happens:** every quote simulation reverts `Unauthorized()` from the hook at `PermissionedHooks.sol:154`.

**Why:** a quoter reaches the PoolManager exactly like a router does, so it goes through the same `allowedWrappers` check. Your pool is live and mintable and still cannot be priced.

**Fix:** register both quoters. This is the failure mode that most often reads as "the pool is broken" when it is a missing registration.

### Scenario 9: `createPermissionsAdapter` with a checker that lacks ERC-165

**You did:** wrote a checker that implements `checkAllowlist` but not `supportsInterface`, and called `createPermissionsAdapter`.

**What happens:** `InvalidAllowListChecker(checker)` — the very first Uniswap call in the journey reverts.

**Why:** the adapter constructor ends by calling `_updateAllowListChecker` (`PermissionsAdapter.sol:33-42`), which performs an ERC-165 `supportsInterface` check (`:78-81`).

**Fix:** either extend `BaseAllowlistChecker`, which supplies `supportsInterface` (`BaseAllowListChecker.sol:10-12`), or add `supportsInterface` to your direct implementation as the published guide's example does. The same check runs on `updateAllowListChecker` later, so a replacement checker can fail the same way.

### Scenario 10: `depositForVerification` without approving first

**You did:** allowlisted the adapter on your token, then called `depositForVerification(1)`.

**What happens:** the call reverts inside your token's allowance check, not with a permissioned-pools selector.

**Why:** `depositForVerification` (`PermissionsAdapter.sol:53-56`) pulls with `safeTransferFrom(msg.sender, address(this), amount)` at `:54`, so it needs an allowance.

**Fix:** `approve` the adapter for at least the amount, then deposit. Alternatively send a plain ERC-20 transfer — the verification gate is a `balanceOf` read (`PermissionsAdapterFactory.sol:42`), so a transfer satisfies it identically, at the cost of not emitting `VerificationDeposit`.

### Scenario 11: verifying twice

**You did:** called `verifyPermissionsAdapter` on an already-verified adapter, perhaps from a retried script.

**What happens:** `PermissionsAdapterAlreadyVerified(adapter)` (`PermissionsAdapterFactory.sol:38-40`).

**Why:** verification is one-shot.

**Fix:** nothing to fix — read `verifiedPermissionsAdapterOf(adapter)` to confirm the first call landed. Make your runbook idempotent by checking that mapping before sending.

### Scenario 12: an LP tries to transfer their position

**You did:** an LP attempted `transferFrom` or either `safeTransferFrom` overload on a position NFT.

**What happens:** `TransferDisabled()` (`PermissionedPositionManager.sol:130-140`).

**Why:** unconditional, on all three entry points. Not a configuration flag and not toggleable.

**Fix:** none exists, and none is intended. Exit is decrease and burn, which are never gated (`:168-172`). Set expectations with LPs before they are in the pool — see [Trust Model](./trust-model.md).

---

## Related Reading

- [Issuer Journey](./issuer-journey.md) — the same ordering presented as the setup sequence, with each
  step's enforcement status stated in place.
- [Contract Architecture](./contract-architecture.md) — which contract declares what, and the
  exact-casing inventory.
- [Trust Model](./trust-model.md) — non-transferability and admin force-exit as properties rather than
  reverts.
