# Permissioned Pools Contract Architecture

Contract-by-contract reference for the Uniswap v4 Permissioned Pools stack: what each contract does, which repository it lives in, and the exact names an implementer has to get right.

Line references are to the pinned commits listed in [Packaging and Sources](./packaging-and-sources.md).

## Sourcing Rule

The stack spans **two** repositories, and this matters when you go looking for behaviour:

- Everything except the hook lives in `Uniswap/v4-periphery`, under `src/hooks/permissionedPools/`.
- The hook itself lives in `Uniswap/v4-hooks-public`, at `src/permissioned-pools/PermissionedHooks.sol:29`
  (`contract PermissionedHooks is IHooks, BaseHook`).

Cite hook behaviour from `v4-hooks-public/src/permissioned-pools/PermissionedHooks.sol`. `v4-periphery` ships only a test double of the hook, so do not infer hook behaviour from `v4-periphery` tests.

## The Stack

| Contract                      | Repository and path                                                         | Who deploys it                  |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| `BaseAllowlistChecker`        | `v4-periphery/src/hooks/permissionedPools/BaseAllowListChecker.sol`         | you, by extending it (abstract) |
| `IAllowlistChecker`           | `v4-periphery/src/hooks/permissionedPools/interfaces/IAllowlistChecker.sol` | interface only                  |
| `PermissionsAdapter`          | `v4-periphery/src/hooks/permissionedPools/PermissionsAdapter.sol`           | the factory, one per token      |
| `PermissionsAdapterFactory`   | `v4-periphery/src/hooks/permissionedPools/PermissionsAdapterFactory.sol`    | Uniswap, shared                 |
| `PermissionedPositionManager` | `v4-periphery/src/hooks/permissionedPools/PermissionedPositionManager.sol`  | Uniswap, shared                 |
| `PermissionedV4Router`        | `v4-periphery/src/hooks/permissionedPools/PermissionedV4Router.sol`         | nobody — it is `abstract`       |
| `PermissionedHooks`           | `v4-hooks-public/src/permissioned-pools/PermissionedHooks.sol`              | Uniswap, shared                 |
| `PermissionFlags`             | `v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol`    | library                         |

`PermissionedV4Router` is declared `abstract contract PermissionedV4Router is V4Router`
(`PermissionedV4Router.sol:13`). It is not an address you can register. Its own doc comment says concrete routers — for example the Universal Router's `V4SwapRouter` — inherit it (`:11-12`), and it exposes two payment hooks for them, `_payStandard` (`:48`) and `_payPermissionedFromPayer` (`:51-56`). The thing you register as an allowed wrapper is the deployed Universal Router.

---

## The Allowlist Checker

This is the only contract in the stack you write. It answers one question for the adapter.

`BaseAllowListChecker.sol:7`:

```solidity
abstract contract BaseAllowlistChecker is IAllowlistChecker, ERC165 {
```

Note the mismatch: the **file** is `BaseAllowListChecker.sol` (capital `L`), the **contract** is `BaseAllowlistChecker` (lowercase `l`). Forge's `path:Contract` form is therefore `BaseAllowListChecker.sol:BaseAllowlistChecker`.

The single virtual to implement, `BaseAllowListChecker.sol:8`:

```solidity
function checkAllowlist(address account, address tokenAddress) public view virtual returns (PermissionFlag);
```

Two facts change how you write it:

1. **Two parameters, not one.** The checker is asked about an `account` _and_ a `tokenAddress`, so one
   checker contract can serve several assets.
2. **The adapter performs an ERC-165 check on your checker.** `PermissionsAdapter._updateAllowListChecker`
   (`PermissionsAdapter.sol:78-81`) calls `ERC165Checker.supportsInterface(checker, type(IAllowlistChecker).interfaceId)`
   and reverts `InvalidAllowListChecker(checker)` when it fails. The adapter constructor ends by calling
   that same internal function (`:33-42`), so the check runs at creation time.

### Two legitimate implementation shapes

| Route                                                 | `checkAllowlist` visibility    | `supportsInterface`                                      |
| ----------------------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| Extend `BaseAllowlistChecker`                         | `public view virtual override` | inherited — `BaseAllowListChecker.sol:10-12` provides it |
| Implement `IAllowlistChecker` (and `ERC165`) directly | `external view`                | you write it yourself                                    |

Both compile. You cannot mix them: Solidity will not let you override the base's `public virtual` with `external`, so copying an `external` signature into a base-extending contract is a compile error.

The published guide's example takes the second route — it implements `IAllowlistChecker` and `ERC165` directly and does not use `BaseAllowlistChecker`, which is why its `checkAllowlist` is `external view` and why it writes its own `supportsInterface`. The guide never mentions the base contract, so if you are following it you will not encounter the file-versus-contract casing pair at all.

### Route (a): extend the base contract

```solidity
import {BaseAllowlistChecker} from "@uniswap/v4-periphery/src/hooks/permissionedPools/BaseAllowListChecker.sol";
import {PermissionFlag, PermissionFlags} from "@uniswap/v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";

contract IssuerAllowlistChecker is BaseAllowlistChecker {
    // Your allowlist storage and its update path are yours to write; the base
    // supplies the ERC-165 `supportsInterface` and the virtual declaration only.
    mapping(address account => PermissionFlag) internal _permissions;

    function checkAllowlist(address account, address tokenAddress)
        public
        view
        virtual
        override
        returns (PermissionFlag)
    {
        // `tokenAddress` is supplied so one checker can serve several assets.
        return _permissions[account];
    }
}
```

Note the import: the contract name is lowercase-`l`, the file name is capital-`L`. Both appear on that one line, and getting either wrong is a resolution failure rather than a subtle bug.

### Route (b): implement the interface directly

```solidity
import {IAllowlistChecker} from "@uniswap/v4-periphery/src/hooks/permissionedPools/interfaces/IAllowlistChecker.sol";
import {PermissionFlag, PermissionFlags} from "@uniswap/v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";
import {ERC165, IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract IssuerAllowlistChecker is IAllowlistChecker, ERC165 {
    mapping(address account => PermissionFlag) public permissions;

    function checkAllowlist(address account, address tokenAddress)
        external
        view
        returns (PermissionFlag)
    {
        return permissions[account];
    }

    // Required — without it, adapter creation reverts InvalidAllowListChecker.
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IAllowlistChecker).interfaceId || super.supportsInterface(interfaceId);
    }
}
```

Those three import lines are the ones the published guide gives, and they resolve as Foundry paths once you apply the remapping in [Packaging and Sources](./packaging-and-sources.md).

---

## PermissionsAdapter

One adapter per permissioned token by convention; the factory does not enforce uniqueness (`PermissionsAdapterFactory.sol:22-32`). It is the pool-facing proxy and the issuer's control surface. It inherits OpenZeppelin `Ownable2Step` (`PermissionsAdapter.sol:15`), so ownership transfer is two-step.

### The virtual token mechanics

The adapter _is_ an ERC-20 — the virtual token that appears in the `PoolKey`. Four behaviours define it:

1. **Minting is to the PoolManager only.** `wrapToPoolManager` mints to `POOL_MANAGER`
   (`PermissionsAdapter.sol:45-50`).
2. **Mintable headroom is a subtraction.** `:47` computes
   `availableBalance = PERMISSIONED_TOKEN.balanceOf(address(this)) - totalSupply()`, and a request above
   that reverts `InsufficientBalance(amount, available)`.
3. **Only the PoolManager may hold it.** `_update` (`:100-121`) rejects any other transfer with
   `InvalidTransfer(from, to)`, raised at `:113` and `:116`. This is the enforcement behind the statement
   that the virtual token never circulates.
4. **Unwrapping is automatic on the way out.** `_unwrap` (`:123-126`) is reached from `_update`
   (`:100-121`, at the call site `:118`) when the PoolManager sends adapter tokens to a recipient,
   releasing the underlying to them.

A consequence worth internalizing: the verification deposit described in [Issuer Journey](./issuer-journey.md) Step 3 **is** the headroom at `:47`. It is not consumed by verification and it is not burned; it sits there as balance that an allowed wrapper can convert into adapter tokens for the PoolManager without paying anything new in. There is no withdraw, rescue, or sweep function on the adapter — reading all 164 lines, the only outbound transfer of the underlying is `_unwrap`, and `Ownable2Step` gives the owner no token-moving power — so treat whatever you deposit as permanently committed to the adapter.

### Virtual token naming

You do not choose the virtual token's name. It is always `Uniswap v4 <name>` with symbol `v4<symbol>`, read from the underlying's `name()`, `symbol()` and `decimals()`. When those are missing it falls back to `Uniswap v4 Permissioned Token`, `v4PT` and `18` decimals. Expose all three on your token so your app team gets the names they expect.

### Shared address edge case

When the adapter and the permissioned token share an address, the token already behaves as its own adapter.

### PermissionsAdapter function inventory

Anything not listed here does not exist.

| Function                                                      | Line                     | Authorization         |
| ------------------------------------------------------------- | ------------------------ | --------------------- |
| `updateAllowListChecker(IAllowlistChecker)`                   | `:59`                    | `onlyOwner`           |
| `updateAllowedWrapper(address,bool)`                          | `:64`                    | `onlyOwner`           |
| `updateSwappingEnabled(bool)`                                 | `:69`                    | `onlyOwner`           |
| `wrapToPoolManager(uint256)`                                  | `:45`                    | allowed wrappers only |
| `depositForVerification(uint256)`                             | `:53`                    | none — anyone         |
| `transferOwnership` / `acceptOwnership` / `renounceOwnership` | inherited `Ownable2Step` | two-step              |

Views and state, with exact casing:

| Member                              | Line   | Note                      |
| ----------------------------------- | ------ | ------------------------- |
| `allowListChecker()`                | `:25`  | capital `L`               |
| `swappingEnabled()`                 | `:28`  | defaults to `false`       |
| `allowedWrappers(address)`          | `:31`  | the wrapper allowlist     |
| `isAllowed(address,PermissionFlag)` | `:74`  | delegates to your checker |
| `POOL_MANAGER()`                    | `:19`  | immutable                 |
| `PERMISSIONED_TOKEN()`              | `:22`  | immutable                 |
| `owner()`                           | `:161` | from `Ownable2Step`       |

Events (`interfaces/IPermissionsAdapter.sol:10`, `:13`, `:16`, `:20`): `AllowListCheckerUpdated`, `AllowedWrapperUpdated`, `SwappingEnabledUpdated`, `VerificationDeposit(address indexed depositor, uint256 amount)`.

Errors (`IPermissionsAdapter.sol:23`, `:26`, `:29`, `:32`): `InvalidAllowListChecker`, `InvalidTransfer`, `UnauthorizedWrapper`, `InsufficientBalance`.

---

## PermissionsAdapterFactory

A shared, Uniswap-deployed contract. Two write functions, both callable by anyone, and nothing else.

| Function                                                     | Line  | Authorization         |
| ------------------------------------------------------------ | ----- | --------------------- |
| `createPermissionsAdapter(IERC20,address,IAllowlistChecker)` | `:22` | none — anyone         |
| `verifyPermissionsAdapter(address)`                          | `:35` | none — anyone         |
| `permissionsAdapterOf(address)`                              | `:13` | view (mapping getter) |
| `verifiedPermissionsAdapterOf(address)`                      | `:15` | view (mapping getter) |
| `POOL_MANAGER()`                                             | `:10` | view                  |

The parameter names on `createPermissionsAdapter` are `permissionedToken`, `initialOwner`, `allowListChecker` (`PermissionsAdapterFactory.sol:22-25`) — capital `L` on the third, matching the adapter's own getter.

**The factory has no owner and no setters at all.** Nothing on it can be revoked, reconfigured or upgraded. Verification is one-shot: a second `verifyPermissionsAdapter` call reverts `PermissionsAdapterAlreadyVerified` (`:38-40`), so verification can never be undone. The only gate on verification is a balance read — `:42` reverts `PermissionsAdapterNotVerified` when `permissionedToken.balanceOf(permissionsAdapter) == 0`.

The factory maps each adapter to its underlying token and never the reverse, which is what stops anyone from registering an arbitrary allowlist check against an existing ERC-20.

Events for indexers: `PermissionsAdapterCreated` (emitted `:31`) and `PermissionsAdapterVerified` (emitted `:46`), both declared on `interfaces/IPermissionsAdapterFactory.sol:9` and `:12`. Together with the adapter's `VerificationDeposit`, these are the filterable signals for tracking adapter lifecycle — emitting a filterable event is the stated reason `depositForVerification` exists at all, since a plain ERC-20 transfer would satisfy the balance gate identically.

---

## PermissionedPositionManager

Extends the standard v4 `PositionManager` with allowlist enforcement, hook approval, non-transferable position NFTs, and an admin force-exit path.

| Function                                  | Line   | Authorization                            |
| ----------------------------------------- | ------ | ---------------------------------------- |
| `setAllowedHook(Currency,IHooks,bool)`    | `:67`  | the currency's adapter `owner()`         |
| `unwindPosition(uint256)`                 | `:82`  | **either** adapter `owner()` on the pool |
| `withdrawClaim(Currency,uint256,address)` | `:117` | the claim holder                         |
| `isAllowedHooks(Currency,IHooks)`         | `:26`  | view (mapping getter)                    |
| `PERMISSIONS_ADAPTER_FACTORY()`           | `:24`  | view                                     |

### Hook approval lives here, not on the adapter

`setAllowedHook` is a position-manager function, authorized by adapter ownership: `_getOwner(currency) != msg.sender` reverts `NotPermissionsAdapterAdmin` (`:68-70`). Three properties follow.

1. **It is per-PositionManager.** `isAllowedHooks` (`:26`) is storage on this contract, so another
   deployed position manager — or the same one on another chain — needs its own approval.
2. **It gates the LP path only.** The mapping is read through `_checkAllowedHook` (`:217`) via
   `_checkAllowedHooks` (`:209-212`) from exactly three call sites: `_mint` (`:162`), `_increase` (`:181`)
   and `_increaseFromDeltas` (`:194`), each reverting `InvalidHook`. No swap path reads it.
3. **Decrease and burn are never gated** (`:168-172`), which means revoking a hook cannot trap anyone in
   a position.

The published guide's Step 5 describes the effect as "every attempt to mint a liquidity position reverts with `InvalidHook`", which is narrower than the code — increases are gated too. The architecture and liquidity pages state it correctly as mints _and_ liquidity increases.

### Allowlist checks on mints and increases

`_checkRecipientAllowed` (`:201-207`, called from `:163-164`, `:183-184` and `:196-197`) resolves the verified permissioned token behind a currency, returns early when there is none, and otherwise requires `isAllowed(recipient, PermissionFlags.LIQUIDITY_ALLOWED)`, reverting a bare `Unauthorized()`. It runs for **both** currencies. Independently, `_pay` re-checks the **sender** on settlement (`:231-233`), and the hook checks the **caller** in `beforeAddLiquidity` and — in the same expression — that the calling position manager is a registered allowed wrapper. Four checks on three different addresses, all reverting the same bare selector — see [Issuer Journey](./issuer-journey.md) Step 6c.

### Non-transferable positions

`transferFrom` and both `safeTransferFrom` overloads revert `TransferDisabled()` (`:130-140`, declared `:41`). Not a flag, not toggleable.

### Force-exit and claims

`unwindPosition(tokenId)` requires `msg.sender` to equal the `owner()` of the adapter behind `currency0` **or** `currency1` (`:84-86`); it self-approves at `:92` and burns the position. Proceeds route through `_unwindWithFallback` (`:311-337`), and the ERC-6909 claim recipient depends on the currency. `withdrawClaim` (`:117`, event `ClaimWithdrawn` at `:125`) is a **separate follow-up transaction** the claim holder sends later. Full treatment in [Trust Model](./trust-model.md).

Errors declared on this contract (`:40-43`): `InvalidHook`, `TransferDisabled`, `NotPermissionsAdapterAdmin`, `NoVerifiedAdapter`. Note what is _not_ there: `Unauthorized` is inherited from `IERC721Permit_v4` (`v4-periphery/src/interfaces/IERC721Permit_v4.sol:9`).

`_getOwner` (`:270-275`) is the helper behind all of the above, and it has one property that produces an ordering constraint: it returns `address(0)` for a currency whose adapter is **not verified**. That is why `setAllowedHook` cannot succeed before verification.

---

## PermissionedHooks

The shared hook. `getHookPermissions()` (`v4-hooks-public/src/permissioned-pools/PermissionedHooks.sol:65-70`) activates exactly four callbacks: `beforeInitialize`, `beforeSwap`, `afterSwap` and `beforeAddLiquidity`.

Enforcement paths that matter to an issuer:

- **`_beforeInitialize`** (`:74-90`) requires at least one pool currency to be a factory-created adapter,
  reverting `NoVerifiedAdapter` at `:81` when neither is, and rejects a created-but-unverified currency
  with `UnverifiedAdapter` at `:82-87`. Note it decides "is an adapter" with `permissionsAdapterOf`
  — _registered_ — not `verifiedPermissionsAdapterOf`.
- **`_beforeSwap`** (`:93-102`) reaches `_verifyAllowlist` (`:131-136`), which caches `msgSender()` from
  the calling wrapper and passes the calling contract as `router`.
- **`_isAllowed`** (`:139-155`) is the shared gate. For a swap it first requires `swappingEnabled()`,
  reverting `SwappingDisabled` at `:146`; then, for both swaps and liquidity, `:151-154` reverts
  `Unauthorized()` unless `isAllowed(sender, permission)` **and** `allowedWrappers(router)` both hold.
- **`beforeAddLiquidity`** enters the same `_isAllowed` gate with `LIQUIDITY_ALLOWED`, checking the caller.

Errors declared on the hook: `Unauthorized` (`:55`), `SwappingDisabled` (`:56`), `NoVerifiedAdapter` (`:57`), `UnverifiedAdapter` (`:58`). Three of those four names also exist elsewhere in the stack with the same selector — with different meanings for `NoVerifiedAdapter` and `Unauthorized`, and the same meaning from a different call site for `SwappingDisabled` — see [Enforced Ordering and Reverts](./enforced-ordering-and-reverts.md).

The hook is a shared contract Uniswap deploys. It is not issuer-controlled, and it is **not** something you register as an allowed wrapper.

---

## PermissionFlags

`PermissionFlag` is the **type** (`libraries/PermissionFlags.sol:4`); `PermissionFlags` is the **library** (`:22`). The values (`:23-26`):

| Constant            | Value    |
| ------------------- | -------- |
| `NONE`              | `0x0000` |
| `SWAP_ALLOWED`      | `0x0001` |
| `LIQUIDITY_ALLOWED` | `0x0002` |
| `ALL_ALLOWED`       | `0xFFFF` |

`SWAP_ALLOWED` does not imply `LIQUIDITY_ALLOWED`. Grant both explicitly where both are intended, including for your own seeding wallet.

---

## Two Independent Swap Gates

Swapping needs both of these, and they fail differently:

| Gate                               | Where                                                                                                        | Revert when missing |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------- |
| `swappingEnabled()` on the adapter | checked first, `PermissionedHooks._isAllowed:146`; re-checked on settlement at `PermissionedV4Router.sol:35` | `SwappingDisabled`  |
| The router on `allowedWrappers`    | `PermissionedHooks._isAllowed:151-154`                                                                       | `Unauthorized`      |

`swappingEnabled` defaults to `false` (`PermissionsAdapter.sol:28`), so a new adapter blocks swaps until the owner calls `updateSwappingEnabled(true)`. There is no equivalent flag for liquidity — liquidity needs only `LIQUIDITY_ALLOWED` from your checker.

Because the router independently checks the flag on settlement (`PermissionedV4Router.sol:35`), and its own `_pay` path checks `isAllowed(msgSender(), SWAP_ALLOWED)` reverting `Unauthorized` (`:36-38`), a swapper can meet the hook and still fail at the router, or the reverse. Decode by call site.

---

## Where State Lives

When something is not behaving, this is the map of which contract to read.

| State                           | Contract                                                     | Scope                                          |
| ------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Who is allowed, and for what    | your checker, reached through `PermissionsAdapter.isAllowed` | per account, per token                         |
| Which checker is in force       | `PermissionsAdapter.allowListChecker()`                      | per adapter, owner-changeable                  |
| Which contracts may wrap        | `PermissionsAdapter.allowedWrappers`                         | per adapter, owner-changeable                  |
| Whether swapping is on          | `PermissionsAdapter.swappingEnabled()`                       | per adapter, owner-changeable, default `false` |
| Adapter → underlying token      | `PermissionsAdapterFactory.permissionsAdapterOf`             | global, write-once at creation                 |
| Adapter → verified underlying   | `PermissionsAdapterFactory.verifiedPermissionsAdapterOf`     | global, write-once at verification             |
| Which hooks are allowed         | `PermissionedPositionManager.isAllowedHooks`                 | **per position manager**, per currency         |
| Mintable virtual-token headroom | `PermissionsAdapter` balance minus `totalSupply()`           | per adapter, derived                           |
| Position ownership and claims   | `PermissionedPositionManager`                                | per token ID                                   |

Two entries on that list are the ones people get wrong. `isAllowedHooks` is per position manager, so a second deployment needs its own `setAllowedHook` call. And the factory's two mappings are write-once — there is no setter and no owner on the factory to change them with.

## Related Reading

- [Issuer Journey](./issuer-journey.md) — the calls in order, with who may make each one.
- [Enforced Ordering and Reverts](./enforced-ordering-and-reverts.md) — the revert catalogue.
- [Trust Model](./trust-model.md) — what LPs and issuers are relying on.
- [Packaging and Sources](./packaging-and-sources.md) — pinning, remapping, resolving addresses.
