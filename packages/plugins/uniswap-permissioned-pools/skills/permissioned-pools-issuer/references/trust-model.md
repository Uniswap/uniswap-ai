# Trust Model: What Issuers and LPs Are Actually Trusting

A permissioned pool moves some powers into contracts and leaves others with people. This file
states which is which, using only behaviour that is readable in the source.

Three facts drive most product decisions downstream of a permissioned pool:

1. **LP positions are permanently non-transferable.** All three ERC-721 transfer entry points
   revert.
2. **Either adapter admin can force-exit any position in the pool**, with `unwindPosition`.
3. **Enforcement lives on the adapter's `allowedWrappers` list**, and every contract on that list
   is trusted to report the true originating caller.

This file works through each fact, gives a checklist for evaluating a contract you are considering
adding to `allowedWrappers`, and closes with what is _not_ part of the trust model.

File and line references are read at the pinned commits recorded in
[Packaging and Sources](./packaging-and-sources.md). Line numbers move; confirm each one against
the source you actually build against.

---

## Fact 1 — LP positions are permanently non-transferable

`PermissionedPositionManager` overrides every ERC-721 transfer entry point to revert
`TransferDisabled()` (`PermissionedPositionManager.sol:130-140`, error declared at `:41`):

| Entry point                                       | Behaviour                    |
| ------------------------------------------------- | ---------------------------- |
| `transferFrom(address,address,uint256)`           | reverts `TransferDisabled()` |
| `safeTransferFrom(address,address,uint256)`       | reverts `TransferDisabled()` |
| `safeTransferFrom(address,address,uint256,bytes)` | reverts `TransferDisabled()` |

`transferFrom` keeps the base position manager's `onlyIfPoolManagerLocked` modifier, so in a locked
context that check can revert first — but the function is unconditionally unusable either way. The
published documentation states the same behaviour for all three entry points.

**This is not a configuration flag.** There is no setter, no owner-gated toggle, and no
per-position exemption. It is the shape of the contract.

### What follows for a product

- **No secondary market for the position.** The LP NFT cannot be sold, lent, or listed.
- **No custodian migration.** A position cannot be moved to a new wallet or a new custody
  provider. If the LP's key must rotate, the position has to be exited and re-minted by the new
  wallet, and the new wallet needs `LIQUIDITY_ALLOWED` first.
- **No NFT-collateral integrations.** Anything that takes custody of the NFT — vaults, lending
  markets, position-manager wrappers, staking — cannot work with these positions.
- **Approvals are inert for transfer purposes.** `approve` and `setApprovalForAll` do not create a
  transfer path, because the transfer functions themselves revert.

### The pool never gates the exit

Decreasing liquidity and burning a position are deliberately **not** gated by the allowlist checker
(`PermissionedPositionManager.sol:168-172`; the documentation states the same). A holder removed from
`LIQUIDITY_ALLOWED` can still decrease and burn.

One limit to state precisely, because it is the difference between "redeemable" and "redeemable to
me": the pool does not gate the exit, but delivery of the permissioned side does. Taking the adapter
currency out of the PoolManager runs the adapter's `_update` → `_unwrap`
(`PermissionsAdapter.sol:118`, `:123-126`), which ends in a transfer of the **underlying** token to the
recipient — and that transfer is subject to your token's own transfer restriction. The source
contemplates exactly this: `_unwindWithFallback`'s second branch is commented "If LP is not allowed to
receive the currency, try to take to admin" (`PermissionedPositionManager.sol:321`). So a holder whom
the issuer has removed from the **token's** allowlist can still close the position, but must direct the
permissioned proceeds to an address the token permits.

So the position is illiquid as an instrument and not a trap — the pool never blocks the exit — but the
issuer's token contract still controls where the permissioned side can land.

Consequence for the LP-facing copy your team writes: describe the position as **non-transferable
and redeemable**, not as "locked", and say alongside it that redemption of the permissioned side lands
only at an address your token permits.

---

## Fact 2 — Either adapter admin can force-exit any position

`unwindPosition(uint256 tokenId)` (`PermissionedPositionManager.sol:82`) burns another account's
position and returns its proceeds. Authorization is at `:84-86`:

```solidity
address admin0 = _getOwner(poolKey.currency0);
address admin1 = _getOwner(poolKey.currency1);
if (msg.sender != admin0 && msg.sender != admin1) revert Unauthorized();
```

- `_getOwner(currency)` (`:270-275`) resolves the currency to its verified adapter and returns that
  adapter's `owner()`. For a currency that is not a verified adapter it returns `address(0)`.
- The caller must equal **either** side's admin. The published architecture page agrees: either
  adapter owner may unwind.
- The call self-approves at `:92` so the burn passes `onlyIfApproved`, and `_handleAction`
  re-checks admin status per leg (`:279-289`, reverting `Unauthorized` at `:286`).

**In a pool with one permissioned side, that single admin can unwind every position in the pool.**
The mechanic is not symmetric in the way a reader might assume from "either admin": in a
permissioned/ordinary pair there is exactly one admin, and the ordinary side supplies none.

This is the mechanism an issuer needs in order to honour a recall, a court order, or a change in a
holder's eligibility without cooperation from the holder. It is also a power every LP in the pool
is accepting when they mint. Both statements are the same fact seen from two sides; say both when
you brief either audience.

### Where the proceeds go

`_unwindWithFallback` (`PermissionedPositionManager.sol:311-337`) runs this cascade once per
currency:

1. `poolManager.take(currency, lp, amount)` — pay the LP directly. Returns on success.
2. If the currency has **no** admin (`_getOwner(currency) == address(0)`, e.g. an ordinary ERC-20
   such as WETH), mint an ERC-6909 claim **to the LP** and return (`:322-327`, rationale at
   `:307-310`).
3. Otherwise `poolManager.take(currency, admin, amount)` — pay that currency's admin. Returns on
   success.
4. Otherwise mint an ERC-6909 claim **to that admin**.

So the claim recipient is **currency-dependent**, and this is the part most easily misread:

| Currency                                   | If paying the LP fails                 | Claim recipient |
| ------------------------------------------ | -------------------------------------- | --------------- |
| Permissioned currency (a verified adapter) | falls through to that currency's admin | **the admin**   |
| Ordinary ERC-20 with no adapter            | falls straight to a claim              | **the LP**      |

The reason the ordinary side behaves differently is stated in the source comment at `:307-310`: an
admin cannot take a regular ERC-20 on the LP's behalf, so the LP keeps the value as a transferable
ERC-6909 claim. Each currency is resolved independently, so a single unwind of a
permissioned/ordinary pair can pay one side to the admin and leave the other side as a claim held
by the LP.

The final `mint` cannot revert, so the whole unwind is atomic — it never half-completes and never
leaves the position in an intermediate state.

Two guarantees hold across the cascade and are worth repeating to both audiences: proceeds never
route to the _other_ currency's admin, and the position is always fully closed.

### `withdrawClaim` is a separate transaction

An ERC-6909 claim is not the underlying asset. Whoever holds the claim converts it later by
sending a second transaction:

```solidity
function withdrawClaim(Currency currency, uint256 amount, address to) external isNotLocked;
```

`PermissionedPositionManager.sol:117`. It burns the caller's ERC-6909 balance (caller-must-own
check at `:300`), takes the underlying to `to`, and emits `ClaimWithdrawn` (`:125`). The recipient
sentinels `address(1)` and `address(2)` are honoured through `_mapRecipient` (`:110-113`, `:118`).

For a **permissioned** currency, `to` must itself clear the underlying token's restriction: the take
unwraps through `PermissionsAdapter._unwrap` (`:123-126`), which transfers the underlying to `to`, so a
non-permitted recipient makes the whole `withdrawClaim` revert. The contract states this at `:110-113`
("For permissioned currencies, `to` must clear the underlying token's issuer compliance on unwrap").
Put a permitted recipient in the runbook before the claim is redeemed.

**This is not part of the unwind.** `unwindPosition` finishes with a claim minted; nothing happens
to that claim until its holder acts. Two operational consequences:

- If the claim went to the LP (the ordinary-ERC-20 path), **the LP must be told**. Nothing pushes
  the asset to them, and a claim sitting unredeemed looks exactly like a missing payout.
- If the claim went to the admin, the issuer's own runbook needs the `withdrawClaim` step in it,
  with the currency and amount recorded from the unwind.

The published documentation describes this cascade less precisely than the source does: it
correctly says proceeds never reach the other issuer, but it does not distinguish the
ordinary-ERC-20 case in which the claim comes back to the LP, and it does not mention that
`withdrawClaim` is a follow-up transaction. Read the source for this behaviour.

---

## Fact 3 — The enforcement boundary is `allowedWrappers`

Nothing about a permissioned pool is enforced inside the PoolManager. The hook and the periphery
contracts do the enforcing, and they do it by asking two questions about every interaction:

```solidity
if (!isAllowed(sender, permission) || !allowedWrappers(router)) revert Unauthorized();
```

`PermissionedHooks.sol:151-154`. Where `sender` comes from is the whole point. In
`_verifyAllowlist` (`:131-136`) the hook reads the calling contract's `msgSender()` to learn who
originated the interaction, and passes the calling contract itself as `router` for the
`allowedWrappers` check. On the wrapping side, `wrapToPoolManager` independently checks
`allowedWrappers[msg.sender]` and reverts `UnauthorizedWrapper(wrapper)`
(`PermissionsAdapter.sol:46`).

So the allowlist check is only as accurate as the answer each registered contract gives to
`msgSender()`. A contract on the list that reports something other than the true originating
caller — because it forwards on behalf of a third party, because it batches several users into one
PoolManager call, or because it lets a caller choose the value — produces a permission decision
about the wrong account, while every invariant inside the adapter still holds. The adapter's own
accounting is unaffected; the _identity_ the allowlist was consulted about is what changes.

**The four contracts the published guide names all implement `msgSender()`, and that is why they
qualify:**

| Wrapper                                               | Where `msgSender()` lives                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `PermissionedPositionManager`                         | v4-periphery, `src/hooks/permissionedPools/`                                            |
| Universal Router 2.2.0 or higher (its `V4SwapRouter`) | Universal Router, via `PermissionedV4Router`                                            |
| `V4Quoter`                                            | `v4-periphery/src/lens/V4Quoter.sol:154-156`, returning `Locker.get()`                  |
| `MixedRouteQuoterV2`                                  | `Uniswap/mixed-quoter`, `src/MixedRouteQuoterV2.sol:209`, declared through `IMsgSender` |

`updateAllowedWrapper(address wrapper, bool allowed)` (`PermissionsAdapter.sol:64`) is the call
that adds to this list. It is `onlyOwner` on an OpenZeppelin `Ownable2Step` contract (`:15`) and
emits `AllowedWrapperUpdated`. It is the single call with the widest effect on who can interact
with the pool, which makes adapter-owner key management part of the trust model rather than an
operational detail.

### What the adapter owner key can do

| Call                                        | Contract                         | Effect                                                              |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| `updateAllowListChecker(IAllowlistChecker)` | `PermissionsAdapter:59`          | replaces the source of truth for every permission decision          |
| `updateAllowedWrapper(address,bool)`        | `PermissionsAdapter:64`          | adds or removes a contract from the enforcement boundary            |
| `updateSwappingEnabled(bool)`               | `PermissionsAdapter:69`          | halts or resumes all swapping on every pool using this adapter      |
| `setAllowedHook(Currency,IHooks,bool)`      | `PermissionedPositionManager:67` | permits or revokes a hook for the LP path on that position manager  |
| `unwindPosition(uint256)`                   | `PermissionedPositionManager:82` | force-exits any position in a pool with this adapter on either side |
| `transferOwnership` / `acceptOwnership`     | inherited `Ownable2Step`         | hands all of the above to another account, in two steps             |

Ownership is `Ownable2Step`, so a handover needs the recipient to call `acceptOwnership` — a
mistyped address does not silently strand the adapter. `renounceOwnership` is also inherited, and
after it `_getOwner` reads `address(0)` for that currency: nothing above can be called again, and
no admin can unwind or be paid unwind proceeds.

The published guide's own callout on Step 2 describes the initial owner as high-leverage and
suggests a multisig. Whether it is a multisig, an MPC signer set, or a single key is your decision;
the contract enforces nothing beyond "the current owner".

### Also enforced: only the PoolManager may hold the adapter token

The adapter token exists to be held by the PoolManager and nothing else. Transfers that would put
it anywhere else revert `InvalidTransfer(from, to)` (`PermissionsAdapter.sol:113`, `:116`, declared
`IPermissionsAdapter.sol:26`). This is the enforcement behind "the virtual token is not a token
your users hold" — see [Contract Architecture](./contract-architecture.md) for the wrap and unwrap
paths this sits on.

---

## Vetting a Candidate Wrapper

Registering a contract with `updateAllowedWrapper` puts it inside the enforcement boundary
described above. Use these questions to describe what a candidate does. They produce a
description, not a verdict — nothing here substitutes for your own review of the contract.

**Caller reporting**

1. Does the contract implement `msgSender()`, and does it return the true originating caller on
   **every** path that can reach the PoolManager — not only the common one?
2. Can any function make the PoolManager call originate from the contract while the economic
   beneficiary is a different account? Batching, relaying, meta-transactions, and
   "execute on behalf of" helpers all have this shape.
3. Is the value returned by `msgSender()` derived from `msg.sender`, or can a caller supply it as a
   parameter?

**Reachable surface**

1. Does it expose generic `take` / `settle` / `unlock`-callback entry points, or arbitrary
   multicall, that a caller can drive directly?
2. Does it hold balances or claims between transactions, and who can move them?
3. Are there admin functions that change routing behaviour after registration?

**Mutability and provenance**

1. Is it a proxy, or does it delegate to code that can change? An address you register is
   permitted until you revoke it, whatever the code behind it becomes.
2. Who can change its configuration or its implementation, and by what process?
3. Is source verified on a block explorer at the exact address you are about to register, and does
   it match the repository you reviewed?

**Scope**

1. Which pools and currencies will it touch? Registration is per adapter, so it applies to every
   pool that adapter participates in.
2. Do you need it at all, or does an already-registered contract cover the use case?
3. What is the revocation plan — who calls `updateAllowedWrapper(wrapper, false)`, and how quickly
   can they?

**How to use the answers.** Each answer tells you something concrete: a contract that cannot
report the originating caller on some path means permission decisions on that path are made about
the wrong account; a contract that can change behind a proxy means what you reviewed is not
necessarily what stays registered; a contract with a generic settlement entry point widens what a
caller can drive through it. Describe those implications to whoever owns the decision. Do not
attach a verdict or a label to someone's contract — the decision belongs to the issuer and their
own reviewers.

---

## What is _not_ part of the trust model

**`PermissionsAdapterFactory`.** It has no owner and no setters at all
(`PermissionsAdapterFactory.sol`; see the inventory in
[Contract Architecture](./contract-architecture.md)). `createPermissionsAdapter` and
`verifyPermissionsAdapter` are callable by anyone, and verification is one-shot — a second call
reverts `PermissionsAdapterAlreadyVerified`, so it can never be revoked, by Uniswap or by the
issuer. The published architecture page agrees that the factory is not issuer-controlled. Nothing
about the factory needs to be trusted because nothing about it can change.

Verification's meaning follows from that: it attests that the adapter held a non-zero balance of
its permissioned token at some point, which requires the issuer to have allowlisted the adapter on
their own token. It is not a review, an endorsement, or a statement about the issuer.

**Hook approval.** `setAllowedHook` gates the LP path only — mints and increases on that position
manager. It never gates swaps, and it never gates decrease or burn, so revoking a hook cannot
prevent anyone from exiting. It is also per position manager: another deployment, or another chain,
needs its own approval.

**The `PermissionedHooks` contract itself.** It is not issuer-controlled and holds no
issuer-specific configuration; it reads the adapter, the checker, and the wrapper list at call
time. Its address is registered as a hook, never as a wrapper.

---

## Where to read this in source

| Fact                                       | Source                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Non-transferability                        | `v4-periphery/src/hooks/permissionedPools/PermissionedPositionManager.sol:130-140`      |
| Ungated exit                               | same file, `:168-172`                                                                   |
| `unwindPosition` authorization             | same file, `:82-92`, `:270-275`, `:279-289`                                             |
| Proceeds cascade                           | same file, `:307-337`                                                                   |
| `withdrawClaim`                            | same file, `:110-125`, `:300`                                                           |
| Allowlist and wrapper check                | `v4-hooks-public/src/permissioned-pools/PermissionedHooks.sol:131-136`, `:151-154`      |
| Wrapper registration and `InvalidTransfer` | `v4-periphery/src/hooks/permissionedPools/PermissionsAdapter.sol:46`, `:64`, `:113-116` |

Both repositories and their pinned commits are listed in
[Packaging and Sources](./packaging-and-sources.md). Related reading:
[Enforced Ordering and Reverts](./enforced-ordering-and-reverts.md) for what each revert means, and
[Issuer Journey](./issuer-journey.md) for where each of these calls falls in the setup sequence.
