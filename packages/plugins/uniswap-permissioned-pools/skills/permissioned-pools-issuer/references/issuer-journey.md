# The Issuer Setup Journey, Step by Step

The full sequence for bringing a transfer-restricted ERC-20 into a Uniswap v4 permissioned pool.

The step numbers match the published deploy guide's seven steps, so you can read this alongside it without reconciling two numbering schemes. Sub-steps are lettered. Every step states whether ordering is enforced at that point and, when it is, which revert you get if you are early.

**Read [Enforced Ordering and Reverts](./enforced-ordering-and-reverts.md) for the revert catalogue**, and [Contract Architecture](./contract-architecture.md) for the exact-casing inventory referenced throughout.

Only five ordering edges are enforced by the contracts. Everything else in this file is the order the published guide recommends — a convention that works, not a constraint. Where a step is unenforced, this file says so rather than inventing a revert for it.

## Journey Overview

| Step | Primary call               | Contract                      | Who may call          | Ordering enforced?                                                   |
| ---- | -------------------------- | ----------------------------- | --------------------- | -------------------------------------------------------------------- |
| 0    | —                          | your token                    | you                   | n/a                                                                  |
| 1    | deploy your checker        | yours                         | you                   | must exist before Step 2                                             |
| 2    | `createPermissionsAdapter` | `PermissionsAdapterFactory`   | anyone                | ERC-165 precondition on the checker                                  |
| 3a   | allowlist the adapter      | your token                    | you only              | gates Step 4                                                         |
| 3b   | `approve`                  | your token                    | the depositor         | before 3c                                                            |
| 3c   | `depositForVerification`   | `PermissionsAdapter`          | anyone                | before Step 4                                                        |
| 4    | `verifyPermissionsAdapter` | `PermissionsAdapterFactory`   | anyone                | **the hinge** — three later edges depend on it                       |
| 5a   | `updateAllowedWrapper`     | `PermissionsAdapter`          | adapter owner         | **yes** — before the first mint, swap or quote through that contract |
| 5b   | `setAllowedHook`           | `PermissionedPositionManager` | adapter owner         | **yes** — after Step 4                                               |
| 6a   | `initialize`               | PoolManager, via the hook     | anyone                | **yes** — after Step 4                                               |
| 6b   | `updateSwappingEnabled`    | `PermissionsAdapter`          | adapter owner         | **no** — convention only                                             |
| 6c   | mint                       | `PermissionedPositionManager` | an allowlisted wallet | **yes** — see the step                                               |
| 7    | routing request            | dev-portal form               | you                   | n/a                                                                  |

---

## Step 0: Prerequisites

Nothing here involves Uniswap contracts. It is the state you need before Step 1.

- **A deployed, transfer-restricted ERC-20.** The permissioned pool does not by itself restrict who can
  hold your token — your token's own allowlist does that, and the pool enforces those rules on-chain for
  swaps and liquidity. Make sure your token's allowlist already reflects the requirements that apply to
  your asset.
- **A source of truth for who is allowed.** Whatever your checker will read: a mapping you write to, an
  external registry, a merkle root. Step 1 wraps it in the interface the adapter expects.
- **`name()`, `symbol()` and `decimals()` exposed on your token.** The virtual token's identity is derived
  from them: always `Uniswap v4 <name>` with symbol `v4<symbol>`. When they are missing it falls back to
  `Uniswap v4 Permissioned Token`, `v4PT` and `18` decimals. Your app team will see whichever you make
  available, so expose all three.
- **The `PermissionsAdapterFactory` and `PermissionedHooks` addresses for your target network.** Resolve
  them from the deploy guide's deployment-addresses table and verify each on a block explorer for your
  chain — see [Packaging and Sources](./packaging-and-sources.md). This skill deliberately contains no
  addresses.
- **The contracts, pinned.** `forge install` at the pinned commit plus the remapping, both in
  [Packaging and Sources](./packaging-and-sources.md). The published guide gives the import lines but no
  install step, and the sources are not in any published npm release of `@uniswap/v4-periphery`.

**Ordering:** not applicable. **Check before moving on:** your token's allowlist can be updated by a key you control, because Step 3a depends on it.

---

## Step 1: Implement an Allowlist Checker

The adapter delegates every permission decision to a contract you write. It must satisfy `IAllowlistChecker`, which extends `IERC165`, and answer for an `(account, tokenAddress)` pair — so one checker can serve several assets.

**The call you are implementing:**

```solidity
function checkAllowlist(address account, address tokenAddress) returns (PermissionFlag)
```

Return a `PermissionFlag` combining `SWAP_ALLOWED` (`0x0001`) and `LIQUIDITY_ALLOWED` (`0x0002`) as appropriate; `ALL_ALLOWED` is `0xFFFF` and `NONE` is `0x0000`. `PermissionFlags` is the library, `PermissionFlag` is the type.

**Two routes, both valid, and you must not mix them:**

| Route                                                                      | Declare `checkAllowlist` as    | `supportsInterface`     |
| -------------------------------------------------------------------------- | ------------------------------ | ----------------------- |
| (a) extend `BaseAllowlistChecker` from the file `BaseAllowListChecker.sol` | `public view virtual override` | inherited from the base |
| (b) implement `IAllowlistChecker` and `ERC165` directly                    | `external view`                | write it yourself       |

Route (b) is what the published guide's example does. The guide does **not** extend `BaseAllowlistChecker` and never mentions it, which is why its signature is `external view`. If you follow the guide's code but the base-extending advice from elsewhere, you get a compile error: Solidity will not let `external` override the base's `public virtual`.

Full skeletons for both routes are in [Contract Architecture](./contract-architecture.md).

- **Who may call:** the adapter, on every gated interaction. Keep it a cheap `view`.
- **Emits:** nothing required. Emit your own events for allowlist changes if you want them indexable.
- **Ordering:** not enforced relative to anything else — but the checker must exist and pass ERC-165
  before Step 2, because Step 2 takes its address as a constructor argument and validates it.
- **Check afterwards:** on your deployed checker, confirm all three of
  `supportsInterface(type(IAllowlistChecker).interfaceId) == true`,
  `supportsInterface(0x01ffc9a7) == true` (ERC-165 itself) and
  `supportsInterface(0xffffffff) == false`. `ERC165Checker` requires all three; the first alone is not
  enough, and any of them wrong makes Step 2 revert.

---

## Step 2: Create the Permissions Adapter

One adapter per permissioned token by convention — the factory does not enforce it.
`createPermissionsAdapter` has no existence check and no access control
(`PermissionsAdapterFactory.sol:22-32`), so anyone can create further adapters naming your token, and
none of them can do anything until you allowlist one on your token and it is verified. Keep your own
record of which adapter address is canonical; `PermissionsAdapterCreated` alone does not tell you.

**The call:**

```solidity
PermissionsAdapterFactory(factory).createPermissionsAdapter(
    IERC20 permissionedToken,
    address initialOwner,
    IAllowlistChecker allowListChecker
);
```

Those are the real parameter names, including the capital `L` on `allowListChecker`.

- **Who may call:** **anyone.** There is no access control on `createPermissionsAdapter`. Ownership of the
  resulting adapter is whatever you pass as `initialOwner`, not whoever sends the transaction.
- **Emits:** `PermissionsAdapterCreated`.
- **Ordering:** this is the first Uniswap call in the journey, and it has one hard precondition —
  **the constructor reverts `InvalidAllowListChecker(checker)` unless your checker advertises
  `IAllowlistChecker` through ERC-165.** The constructor ends by calling the same internal
  `_updateAllowListChecker` that the later admin function uses
  (`PermissionsAdapter.sol:33-42`, `:78-81`), so the check runs at creation time. This is the most likely
  first-transaction failure for a hand-rolled checker. Extending `BaseAllowlistChecker` satisfies it for
  you (`BaseAllowListChecker.sol:10-12`); a direct interface implementation must write
  `supportsInterface` itself, as the guide's example does.
- **Check afterwards:** `permissionsAdapterOf(adapter)` returns your token's address, and `owner()` on the
  adapter is `initialOwner`.

**What the owner key can do.** From this point the adapter owner can change the allowlist checker, approve and revoke allowed wrappers, pause and resume swapping, and — through the position manager — unwind any position in a pool where this adapter is a currency. It cannot transfer positions and cannot pull funds out through the virtual token. The guide's own callout on this step recommends a multisig for the owner key. Ownership transfer is two-step (`Ownable2Step`), so a transfer needs the new owner to accept.

---

## Step 3: Allowlist and Fund the Adapter

Three sub-steps. This is the step only you can do, and the one everything downstream waits on.

### Step 3a: Allowlist the adapter on your token

Add the adapter address to your permissioned token's allowlist so the adapter can hold a balance.

- **Who may call:** you, through whatever admin path your token has. No Uniswap contract is involved.
- **Ordering:** **enforced, indirectly and absolutely.** Without this, the adapter cannot hold a balance,
  so Step 4 cannot succeed — `verifyPermissionsAdapter` reverts `PermissionsAdapterNotVerified` while the
  balance is zero (`PermissionsAdapterFactory.sol:42`). This is the whole security property of
  verification: it proves the adapter is allowed to hold the underlying, which only you can arrange.
- **Check afterwards:** a `balanceOf` read on the adapter shows a test transfer landed.

### Step 3b: Approve the adapter to pull the deposit

`depositForVerification` pulls the tokens rather than receiving a push:

```solidity
// PermissionsAdapter.sol:54, inside depositForVerification (:53-56)
SafeERC20(address(PERMISSIONED_TOKEN)).safeTransferFrom(msg.sender, address(this), amount);
```

So the depositor must `approve` the adapter for at least `amount` first, or the call reverts inside your token's allowance check. The published guide does not mention this.

- **Who may call:** the depositor, on your token.
- **Ordering:** must precede Step 3c. Nothing else depends on it.

### Step 3c: Deposit for verification

```solidity
PermissionsAdapter(adapter).depositForVerification(1);
```

- **Who may call:** **anyone.** No access control.
- **Emits:** `VerificationDeposit(address indexed depositor, uint256 amount)`.
- **Ordering:** must precede Step 4. It does not have to be this function at all — the verification gate
  is a plain `balanceOf` read at `PermissionsAdapterFactory.sol:42`, so an ordinary ERC-20 transfer to the
  adapter satisfies it identically. `depositForVerification` exists to emit a filterable event instead of
  a bare `Transfer`.
- **Check afterwards:** `permissionedToken.balanceOf(adapter)` is non-zero.

**1 wei is enough.** The docs say so in three places across two pages, and Uniswap's own test fixture calls `depositForVerification(1)`. Deposit dust.

**There is no withdraw.** `PermissionsAdapter` has no withdraw, rescue, sweep or recover function, and `Ownable2Step` gives the owner no token-moving power — so treat whatever you deposit as permanently committed to the adapter. It is **not** burned and it does **not** reduce your mintable headroom: the deposited balance **is** the headroom. `wrapToPoolManager` computes availability as `PERMISSIONED_TOKEN.balanceOf(address(this)) - totalSupply()` (`PermissionsAdapter.sol:47`), so the deposit sits there as balance an allowed wrapper can convert into virtual tokens for the PoolManager without paying anything new in. It stays economically live; you simply cannot pull it back out directly. That is the reason to deposit dust rather than a meaningful sum.

---

## Step 4: Verify the Adapter

Registers the adapter with the factory as a legitimate adapter for its token.

**The call:**

```solidity
PermissionsAdapterFactory(factory).verifyPermissionsAdapter(adapter);
```

- **Who may call:** **anyone.** `external`, no modifier, no admin check. The security property comes from
  the non-zero balance requirement — which only your allowlist can make possible — not from caller
  authorization. There is no "wait for Uniswap" here and no approval queue.
- **Emits:** `PermissionsAdapterVerified`.
- **Ordering:** **this is the hinge of the whole journey.** Three of the five enforced edges depend on it.
  Its own preconditions:

| Condition                                     | Revert                                       |
| --------------------------------------------- | -------------------------------------------- |
| The address was never created by this factory | `PermissionsAdapterNotFound(adapter)`        |
| It is already verified                        | `PermissionsAdapterAlreadyVerified(adapter)` |
| Its permissioned-token balance is zero        | `PermissionsAdapterNotVerified(adapter)`     |

- **Check afterwards:** `verifiedPermissionsAdapterOf(adapter)` returns your token's address.

**Verification is one-shot and irreversible.** A second call reverts, so verification can never be revoked — and the factory has no owner and no setters at all, so there is nothing on it that anyone can reconfigure later. Neither of these properties is stated in the published guide, so a reader arriving from the guide will not know them.

---

## Step 5: Approve the Virtual-Token Contracts

Two independent operations that the guide groups into one step. Neither is enforced against the other, but 5b is enforced against Step 4.

### Step 5a: Register the allowed wrappers

**The call, once per wrapper:**

```solidity
PermissionsAdapter(adapter).updateAllowedWrapper(wrapper, true);
```

- **Who may call:** the adapter owner (`onlyOwner`).
- **Emits:** `AllowedWrapperUpdated(address indexed wrapper, bool allowed)`.
- **Ordering:** **enforced against use, not against setup.** This is an `onlyOwner` call on the adapter
  with no dependency on verification or on the pool existing, so register before or after pool creation;
  both work, and the guide places it here. But nothing can be routed through an unregistered contract:
  the hook checks `allowedWrappers(router)` where `router` is whatever called the PoolManager
  (`PermissionedHooks.sol:131-136`, `:151-154`), so **the `PermissionedPositionManager` must be
  registered before your first mint** — it reverts a bare `Unauthorized()` at `PermissionedHooks.sol:154`
  otherwise — and each router and quoter before the first swap or quote through it.

**The four the guide names:**

1. `PermissionedPositionManager`
2. The Universal Router
3. `V4Quoter`
4. `MixedRouteQuoterV2`

**The rule behind the four.** Register every contract that will call the PoolManager on this pool. Two separate checks enforce it: the hook checks `allowedWrappers(router)`, where `router` is the calling router or position manager (`PermissionedHooks.sol:134-135`, `:151-154`), and `wrapToPoolManager` independently checks `allowedWrappers[msg.sender]` (`PermissionsAdapter.sol:46`). The guide's four are the production callers, not a closed set — if you deploy a router of your own that reaches the PoolManager, register that too. Each of the four qualifies because it reports the true originating caller through `msgSender()`, which is what the hook's allowlist check consumes; `MixedRouteQuoterV2` lives in `Uniswap/mixed-quoter` and implements `IMsgSender` at `src/MixedRouteQuoterV2.sol:209`, and `V4Quoter` implements it at `v4-periphery/src/lens/V4Quoter.sol:154-156`.

**Three traps on this sub-step:**

1. **The step says four; the table it links has six rows.** `PermissionsAdapterFactory` and
   `PermissionedHooks` are also in the deployment-addresses table and are **not** wrappers. Never register
   the factory. Never register the hook.
2. **The Universal Router must be 2.2.0 or higher**, and its canonical deployments key is
   `UniversalRouter#v2.2`. The plain `UniversalRouter` key is a different, non-permissioned router on both
   chains, and only the `#v2.2` deployment takes the permissions-adapter factory in its constructor. Also
   do not source a router address from the general v4 deployments page — it carries no permissioned rows
   and lists an older Universal Router. Use the deploy guide's own table.
3. **`PermissionedV4Router` is not an address.** It is `abstract contract PermissionedV4Router is V4Router`
   (`PermissionedV4Router.sol:13`), inherited by concrete routers. What you register is the deployed
   Universal Router.

**How a wrong registration presents.** Both failure modes are quiet until someone transacts. An unregistered caller of `wrapToPoolManager` reverts `UnauthorizedWrapper(msg.sender)`. An unregistered quoter makes quote simulation revert `Unauthorized()` from the hook at `PermissionedHooks.sol:154` — so your pool looks live but your interface cannot price it.

- **Check afterwards:** `allowedWrappers(x)` is `true` for each of the four (and any custom caller), and
  `false` for the factory and the hook.

### Step 5b: Allow the hook on the position manager

**The call:**

```solidity
PermissionedPositionManager(permissionedPositionManager).setAllowedHook(
    Currency.wrap(adapter),
    IHooks(permissionedHooks),
    true
);
```

- **Who may call:** the adapter owner. Authorization is `_getOwner(currency) != msg.sender` →
  `NotPermissionsAdapterAdmin` (`PermissionedPositionManager.sol:68-70`).
- **Emits:** `AllowedHooksUpdated` (plural), and note the function is `setAllowedHook` (singular) while
  the mapping is `isAllowedHooks` (plural).
- **Ordering:** **enforced against Step 4.** `_getOwner` returns `address(0)` for a currency whose adapter
  is not verified (`:270-275`), so before verification this reverts `NotPermissionsAdapterAdmin` — even
  when you genuinely are the owner. The guide orders it correctly but never explains why. It is **not**
  enforced against pool creation: you may approve the hook before or after `initialize`.
- **Check afterwards:** `isAllowedHooks(Currency.wrap(adapter), IHooks(permissionedHooks))` is `true` on
  **that** position manager.

**Four properties of hook approval:**

1. **Per position manager.** `isAllowedHooks` is storage on this contract, so another deployed position
   manager, or the same one on another chain, needs its own call.
2. **LP path only.** It is read from `_mint` (`:162`), `_increase` (`:181`) and `_increaseFromDeltas`
   (`:194`), each reverting `InvalidHook`. No swap path reads it. The guide's Step 5 says "every attempt to
   mint a liquidity position", which is narrower than the code — increases are gated too.
3. **Decrease and burn are never gated** (`:168-172`), so revoking a hook cannot trap anyone in a position.
4. **A no-op is a no-op.** Setting the same value twice short-circuits without emitting (`:72`), so an
   absent event does not mean the call failed.

---

## Step 6: Create the Pool, Then Enable Swapping

### Step 6a: Initialize the pool

Build a `PoolKey` whose currencies are the adapter and the paired asset, with `hooks` set to `PermissionedHooks`, then initialize it with a starting price.

```solidity
PoolKey memory key = PoolKey({
    currency0: /* lower of the two currency addresses */,
    currency1: /* higher of the two */,
    fee: fee,
    tickSpacing: tickSpacing,
    hooks: IHooks(permissionedHooks)
});
```

`currency0` must sort strictly below `currency1` as an address. The PoolManager rejects an
out-of-order or equal pair before the hook ever runs, so that failure is a v4-core one and not any of
the permissioned selectors in this file.

- **Who may call:** anyone, as with any v4 pool.
- **Ordering:** **enforced against Step 4.** `PermissionedHooks._beforeInitialize` (`:74-90`) reverts
  `NoVerifiedAdapter` when neither currency was created by the factory (`:81`), and `UnverifiedAdapter`
  when a factory-created currency is not yet verified (`:82-87`).
- **Check afterwards:** the pool's slot0 reads back your initial price, and the `PoolKey` currency is the
  **adapter**, not the underlying token.

Remember which address goes where: the pool currency is the adapter. The underlying token never appears in the `PoolKey`.

### Step 6b: Enable swapping

```solidity
PermissionsAdapter(adapter).updateSwappingEnabled(true);
```

- **Who may call:** the adapter owner (`onlyOwner`).
- **Emits:** `SwappingEnabledUpdated(bool)`.
- **Ordering:** **not enforced.** The guide places this after pool creation, and nothing requires that
  position — it is an `onlyOwner` call on the adapter with no dependency on the pool.
- **Check afterwards:** `swappingEnabled()` is `true`.

**`swappingEnabled` defaults to `false`** (`PermissionsAdapter.sol:28`), so swaps revert until you turn it on. It is checked in two places, and the hook checks it _before_ the wrapper check: `SwappingDisabled` at `PermissionedHooks.sol:146`, and independently again by the router on settlement at `PermissionedV4Router.sol:35`. There is no equivalent flag for liquidity — liquidity needs only `LIQUIDITY_ALLOWED` from your checker, so LPs can act while swapping is paused.

### Step 6c: Allowlist your own seeding wallet, then seed liquidity

**Before the first mint, both the wallet that sends it and the wallet that will own the position must hold `LIQUIDITY_ALLOWED` on your allowlist.** This is the step that most often breaks an otherwise-correct setup, because being the adapter owner grants nothing here.

Four independent checks run on a mint, and three of them produce the identical bare `Unauthorized()`:

| Check                                             | Where                                                                                      | Which address                                                                | Revert                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------- |
| Recipient allowed                                 | `PermissionedPositionManager._checkRecipientAllowed` (`:201-207`), for **both** currencies | the position recipient                                                       | bare `Unauthorized()` |
| Caller allowed                                    | the hook's `beforeAddLiquidity`, through `_isAllowed` (`PermissionedHooks.sol:151-154`)    | the transaction sender, as the position manager reports it via `msgSender()` | bare `Unauthorized()` |
| Caller allowed, again                             | `PermissionedPositionManager._pay` (`:231-233`) on settlement                              | the same `msgSender()`                                                       | bare `Unauthorized()` |
| Position manager registered as an allowed wrapper | the same expression in the hook (`allowedWrappers(router)`)                                | the `PermissionedPositionManager` address                                    | bare `Unauthorized()` |

`SWAP_ALLOWED` does not imply `LIQUIDITY_ALLOWED` — the liquidity guide states this explicitly. So a treasury multisig that is allowlisted for swapping, or allowlisted for nothing because it is "the owner", cannot seed the pool it just created. The revert is a bare `Unauthorized()` and there are three separate declarations of that name in the stack, so decode it by call site rather than by name.

**Then mint through the `PermissionedPositionManager`**, not the standard `PositionManager`. Approvals
go on the **underlying** token through Permit2, not on the adapter, and they are two calls — the
position manager pulls with `permit2.transferFrom(payer, adapter, amount, permissionedToken)`
(`PermissionedPositionManager.sol:237`), so both must be in place before the first mint:

```solidity
// 1. Approve Permit2 to move the underlying permissioned token.
IERC20(permissionedToken).approve(address(permit2), type(uint256).max);

// 2. Approve the PermissionedPositionManager as a Permit2 spender.
permit2.approve(permissionedToken, address(permissionedPositionManager), type(uint160).max, type(uint48).max);
```

Missing either one fails inside Permit2 with an allowance error, not with a permissioned-pools
selector. Note that Permit2 itself never holds the token and is **not** an allowed wrapper.

- **Who may call:** any wallet holding `LIQUIDITY_ALLOWED`, minting to a recipient that also holds it.
- **Ordering:** **enforced.** The mint needs a verified adapter on at least one side
  (`NoVerifiedAdapter`, `PermissionedPositionManager.sol:157-160`), the pool's hook approved on this
  position manager (`InvalidHook`, `:162`), `LIQUIDITY_ALLOWED` on caller and recipient
  (`Unauthorized`), the position manager registered as an allowed wrapper on the adapter (bare
  `Unauthorized()` from the hook, then `UnauthorizedWrapper` on settlement), and both Permit2
  approvals on the underlying token.
- **Check afterwards:** the position NFT exists and the pool has liquidity at your intended range.

**Before inviting third-party LPs**, read [Trust Model](./trust-model.md). Two properties they will ask about — positions are permanently non-transferable, and either adapter admin can force-exit a position — are worth being able to explain in your own words before anyone else's capital is in the pool.

---

## Step 7: Request Routing Allowlisting

The on-chain pool is complete after Step 6. This step is about appearing in the Uniswap interface and API, and it is the one part of the journey coordinated with Uniswap Labs rather than executed by you.

Once your adapter is verified, request allowlisting through the published dev-portal form. There are two distinct forms: one for issuers with a deployed and verified permissioned token, and a separate interest form for teams still exploring. Allowlisting is required on **every** network, including Sepolia — testnet is not self-serve.

The guide lists three values that go into the backend configuration — the permissioned token address, the verified adapter address, and a KYC URL where unapproved users complete verification, keyed by the **lowercased** permissioned token address. The live form asks for more than that, including a Telegram handle and a CoinGecko API link for your token logo, neither of which the guide mentions. Arrive prepared with all of them.

Timelines, eligibility and outcomes for this step are not defined by the contracts. The published material does not state a turnaround time, so plan your launch without one.

Full detail, including the complete field list: [Coordination Boundary](./coordination-boundary.md).

---

## Which Address Goes in Which Argument

Every call in this journey takes either the underlying token or the adapter, and the two are not interchangeable. This table is the whole disambiguation.

| Call                              | Argument that is the **underlying token** | Argument that is the **adapter**     |
| --------------------------------- | ----------------------------------------- | ------------------------------------ |
| `createPermissionsAdapter`        | `permissionedToken`                       | — (the adapter is the return value)  |
| your token's allowlist update     | —                                         | the address you allowlist            |
| `approve` (Step 3b)               | the token you call it on                  | the spender                          |
| `depositForVerification`          | —                                         | the contract you call it on          |
| `verifyPermissionsAdapter`        | —                                         | the argument                         |
| `updateAllowedWrapper`            | —                                         | the contract you call it on          |
| `setAllowedHook`                  | —                                         | `Currency.wrap(adapter)`             |
| `PoolKey.currency0` / `currency1` | —                                         | the permissioned side is the adapter |
| Permit2 approval before a mint    | the token you approve                     | —                                    |
| routing-request form              | "permissioned token address"              | "verified adapter address"           |

Your checker sees the **underlying** token as its `tokenAddress` argument, not the adapter.

---

## Events Emitted Along the Way

Useful if you are building an indexer or a launch runbook that verifies each step from logs.

| Event                                                            | Emitted by                    | Step                     |
| ---------------------------------------------------------------- | ----------------------------- | ------------------------ |
| `PermissionsAdapterCreated`                                      | `PermissionsAdapterFactory`   | 2                        |
| `VerificationDeposit(address indexed depositor, uint256 amount)` | `PermissionsAdapter`          | 3c                       |
| `PermissionsAdapterVerified`                                     | `PermissionsAdapterFactory`   | 4                        |
| `AllowedWrapperUpdated(address indexed wrapper, bool allowed)`   | `PermissionsAdapter`          | 5a                       |
| `AllowedHooksUpdated`                                            | `PermissionedPositionManager` | 5b                       |
| `SwappingEnabledUpdated(bool)`                                   | `PermissionsAdapter`          | 6b                       |
| `AllowListCheckerUpdated`                                        | `PermissionsAdapter`          | any later checker change |
| `ClaimWithdrawn`                                                 | `PermissionedPositionManager` | after a `withdrawClaim`  |

Note that `depositForVerification` exists specifically so this sequence is filterable without falling back to a bare ERC-20 `Transfer` — a plain transfer satisfies the verification gate but emits no permissioned-pools-specific event.

---

## Ongoing Adapter Operations After Launch

All of these are `onlyOwner` on the adapter unless noted, and none of them requires coordination with Uniswap.

**Change the allowlist checker** — `updateAllowListChecker(IAllowlistChecker newAllowListChecker)` (capital `L`). The **same ERC-165 check as adapter creation** applies: a replacement checker that does not advertise `IAllowlistChecker` reverts `InvalidAllowListChecker` (`PermissionsAdapter.sol:78-81`). Emits `AllowListCheckerUpdated`. Verify `supportsInterface` on the new checker before sending this.

**Revoke a wrapper** — `updateAllowedWrapper(wrapper, false)`. Takes effect immediately: that contract's next `wrapToPoolManager` reverts `UnauthorizedWrapper`, and swaps or liquidity routed through it revert `Unauthorized()` from the hook. Revoking the quoters stops quotes; revoking the position manager stops new liquidity.

**Pause or resume swapping** — `updateSwappingEnabled(false)` then `true`. Swaps revert `SwappingDisabled`; liquidity is unaffected, because liquidity has no equivalent flag.

**Revoke a hook** — `setAllowedHook(currency, hooks, false)` on the position manager, adapter-owner-only. Blocks new mints and increases with `InvalidHook`. It cannot block anyone's exit: decrease and burn are never gated.

**Force-exit a position** — `unwindPosition(tokenId)` on the position manager, callable by **either** adapter owner on the pool. See [Trust Model](./trust-model.md) for the proceeds cascade and the ERC-6909 claim path.

**Transfer adapter ownership** — `transferOwnership` then `acceptOwnership` by the new owner (`Ownable2Step`). The transfer is not complete until accepted.

**What you cannot change.** Verification, once done, is permanent. The factory's adapter-to-token mapping is write-once. The factory has no owner and no setters. Position NFTs cannot be made transferable. And the virtual token's name and symbol are derived from your token, not settable on the adapter.

---

## Notes for the App Team

Three things the engineers building your own front end or back office need from this journey.

- **The virtual token's identity is derived, not configured.** It is `Uniswap v4 <name>` with symbol
  `v4<symbol>`, from your token's `name()` / `symbol()` / `decimals()`, falling back to
  `Uniswap v4 Permissioned Token` / `v4PT` / `18`. If your token omits any of the three, that fallback is
  what surfaces — decide now whether that is acceptable copy.
- **Pricing needs the quoters registered.** `V4Quoter` and `MixedRouteQuoterV2` are on the wrapper list
  precisely so quote simulation works; without them the hook reverts `Unauthorized()` on every quote and
  your pool cannot be priced even though it is live and mintable.
- **Wallet balances are the underlying, pool state is the adapter.** Users hold and approve the underlying
  token; the pool's currency is the adapter. When the adapter and the permissioned token share an address,
  the token already behaves as its own adapter and there is only one address to display.

---

## Post-Setup Verification Checklist

Read-only checks that catch the common misconfigurations, in the order they would bite.

- [ ] `supportsInterface(type(IAllowlistChecker).interfaceId)` on your checker returns `true`.
- [ ] `permissionsAdapterOf(adapter)` returns your permissioned token.
- [ ] `verifiedPermissionsAdapterOf(adapter)` returns your permissioned token.
- [ ] `owner()` on the adapter is the key you intend to keep — and, if you transferred it, the new owner
      has accepted (`Ownable2Step`).
- [ ] `allowListChecker()` on the adapter is your checker.
- [ ] `allowedWrappers(x)` is `true` for the position manager, the Universal Router at 2.2.0 or higher,
      `V4Quoter`, `MixedRouteQuoterV2`, and any custom caller of your own.
- [ ] `allowedWrappers(x)` is `false` for `PermissionsAdapterFactory` and `PermissionedHooks`.
- [ ] `isAllowedHooks(Currency.wrap(adapter), IHooks(permissionedHooks))` is `true` on the position manager
      you will actually use.
- [ ] `swappingEnabled()` is `true` when you intend swaps to be live.
- [ ] Your seeding wallet and the position recipient both return `LIQUIDITY_ALLOWED` from
      `isAllowed(wallet, PermissionFlags.LIQUIDITY_ALLOWED)`.
- [ ] Permit2 is approved on the underlying token and the position manager is approved as a Permit2
      spender, from the wallet that will send the mint.
- [ ] Every address you used was read from the deploy guide's deployment-addresses table and confirmed on
      a block explorer for your chain.

---

## Related Reading

- [Enforced Ordering and Reverts](./enforced-ordering-and-reverts.md) — which five edges are enforced, the
  full revert catalogue, and worked out-of-order scenarios.
- [Contract Architecture](./contract-architecture.md) — the exact-casing inventory and checker skeletons.
- [Trust Model](./trust-model.md) — non-transferability, admin force-exit, vetting a candidate wrapper.
- [Packaging and Sources](./packaging-and-sources.md) — the pin, the remapping, resolving addresses.
- [Coordination Boundary](./coordination-boundary.md) — what is permissionless and what is coordinated.
