# Parameter Reference

What each field in [`config-schema.md`](./config-schema.md) means, how an issuer should
choose it, and what breaks if it is wrong. Cross-references into `permissioned-pools-issuer`
carry the contract-level detail; this file stays focused on the configuration decision.

## `chainId`

The network the pool is being configured for. This skill does not maintain its own list
of "supported" chains — it takes whatever chain ID you give it. What determines whether
a permissioned pool can actually be deployed there is whether the deploy guide's
`#deployment-addresses` table has a row for that chain. If it does not, every wrapper and
hook field in this configuration will end up marked `"RESOLVE"` with nothing to resolve
to, and that is the signal to check the chain rather than a bug in the configuration.

**What breaks if it is wrong:** every address you later resolve against the deploy
guide's table or `deployments/json/<chainId>.json` is for the wrong chain, and nothing in
the JSON structure itself will catch that — the mistake surfaces only when a resolved
address does not exist on the chain you actually deploy to.

## `permissionedToken`

The address of the issuer's own transfer-restricted ERC-20 — the token wallets and LPs
actually hold. This is **not** the pool currency; the pool currency is the
`PermissionsAdapter`, which does not exist until it is created. See
[Two Addresses, Not One](../../permissioned-pools-issuer/SKILL.md#two-addresses-not-one)
for the full distinction, which is the single most common integration error in this
whole flow.

Before configuring this field, confirm the token exposes `name()`, `symbol()`, and
`decimals()` — the adapter's virtual-token identity is derived from all three, falling
back to generic values when any is missing.

If the token is not deployed yet, store the literal string `"RESOLVE"` rather than
guessing an address — see [Address Validation](./config-schema.md#address-validation).

**What breaks if it is wrong:** every downstream step operates on the wrong token. The
allowlist checker will be asked about the wrong `tokenAddress`, and the adapter created
from this token address cannot be swapped for a different one later — the factory's
token mapping is write-once.

## `allowlistChecker`

Whether the issuer already has a deployed contract satisfying `IAllowlistChecker`, or
still needs to write and deploy one.

- **`mode: "existing"`** — the issuer has a checker deployed and verified against the
  `IAllowlistChecker` interface via ERC-165. Record its address.
- **`mode: "to-be-deployed"`** — the checker does not exist yet. This configuration can
  still be produced; the deployer skill's preflight is where the checker's own ERC-165
  compliance actually gets checked, because `createPermissionsAdapter` reverts
  `InvalidAllowListChecker` on the very first Uniswap call otherwise.

**What breaks if it is wrong:** a checker address that does not answer the ERC-165 probe
correctly makes adapter creation revert immediately — the first Uniswap transaction in
the whole journey. A checker that answers ERC-165 correctly but has a wrong or empty
allowlist inside it produces a pool that exists but that nobody (or everybody) can use,
which is a much quieter failure to notice.

## `adapterOwner`

The address that becomes `initialOwner` on `createPermissionsAdapter`. From the moment
the adapter is created, this key can:

- replace the allowlist checker (`updateAllowListChecker`)
- add or remove any wrapper, including the position manager itself (`updateAllowedWrapper`)
- pause or resume all swapping on every pool using this adapter (`updateSwappingEnabled`)
- approve or revoke a hook on the LP path (`setAllowedHook`, via the position manager)
- force-exit **any** LP position in a pool where this adapter is a currency
  (`unwindPosition`, via the position manager)

Ownership transfer is two-step (`Ownable2Step`), so a mistyped new-owner address during a
later handover does not silently strand the adapter — but the _initial_ owner is set at
creation with no such protection, so get this one right the first time. The published
guide's own recommendation is a multisig.

If the owning key or multisig has not been decided yet, store the literal string
`"RESOLVE"` rather than picking an address just to complete the flow — the adapter is
not created until the deployer skill runs, so there is no urgency to fill this in early.

**What breaks if it is wrong:** every capability above lands with the wrong party (or an
address nobody controls, if it is mistyped and unrecoverable). There is no way to
"re-create" an adapter for the same token cheaply once one is verified — the factory
does not enforce a single adapter per token, but everything downstream (allowlisting,
verification, wrapper registration) has to be redone for a second one.

## `verificationDepositAmount`

The amount of the underlying permissioned token deposited into the not-yet-verified
adapter via `depositForVerification`, to satisfy the balance check that
`verifyPermissionsAdapter` reads.

**Three facts that should drive this choice, not intuition:**

1. **It is the mintable headroom, not a fee.** `wrapToPoolManager`'s available balance is
   `balanceOf(adapter) - totalSupply()` — whatever you deposit here becomes exactly the
   amount an allowed wrapper can convert into virtual tokens for the PoolManager. It is
   not consumed, burned, or spent by verification itself.
2. **There is no withdraw function.** `PermissionsAdapter` has no withdraw, rescue, or
   sweep path, and `Ownable2Step` gives the owner no token-moving power. Whatever is
   deposited here is committed to the adapter permanently — it stays economically live as
   mintable headroom, but it cannot be pulled back out directly.
3. **1 wei is enough.** The published documentation says so in multiple places, and
   Uniswap's own test fixture deposits exactly 1 wei. Verification only reads whether the
   balance is non-zero.

**What breaks if it is wrong:** depositing a large amount "to be safe" does not make
verification more secure — the check is a bare non-zero balance read — and it commits
real value to a contract with no exit path for it. Depositing zero (or forgetting this
step) makes `verifyPermissionsAdapter` revert `PermissionsAdapterNotVerified`, which
blocks three of the five contract-enforced ordering edges in the whole journey.

## `allowedWrappers`

The set of contracts registered on the adapter's `allowedWrappers` list via
`updateAllowedWrapper`. This is the real enforcement boundary of the whole system: the
hook and the adapter both check this list before letting anything reach the PoolManager
through a given caller.

### The four wrappers, and why only these four

1. `PermissionedPositionManager` — required before the first mint.
2. The Universal Router, specifically the `#v2.2` (or higher) deployment — required
   before the first swap routed through it.
3. `V4Quoter` — required before the first quote simulation; without it, quote requests
   revert even though the pool is live and mintable.
4. `MixedRouteQuoterV2` — same requirement, for mixed-route quoting.

**The rule behind the four, which generalizes past them:** register every contract that
will call the PoolManager on this pool. Each of the four qualifies because it correctly
reports the true originating caller through `msgSender()`, which is exactly what the
allowlist check consumes. If the issuer deploys a custom router or quoter of their own
that reaches the PoolManager on this pool, it needs the same property and the same
registration — add it to the configuration under its own key, alongside the four (see
[the schema's note on this](./config-schema.md#the-four-allowedwrappers-keys)).

**Never register the factory. Never register the hook.** The published guide's own
Step 5 table has six rows, and two of them — `PermissionsAdapterFactory` and
`PermissionedHooks` — are not wrappers. Registering either is not caught by any contract
check; it is simply wrong, and it does not do what a reader skimming the guide's table
might assume.

**What breaks if it is wrong:** an unregistered position manager blocks every mint with a
bare `Unauthorized()`. An unregistered router blocks every swap through it the same way.
An unregistered quoter makes the pool look broken to any interface pricing it, even
though it is live and mintable — this is, per the reference skill, the failure mode most
often mistaken for "the pool is broken" when it is a missing registration. Resolving the
plain `UniversalRouter` deployment instead of the `#v2.2` one registers a contract that
looks right and produces a router that cannot do permissioned routing at all.

## `hook`

The `PermissionedHooks` address, registered with `setAllowedHook` on the position
manager — not on the adapter, and not through `updateAllowedWrapper`. This is a separate
call from wrapper registration, gates the LP path only (mints and increases, not swaps,
not decreases, not burns), and is enforced against verification: calling it before the
adapter is verified reverts `NotPermissionsAdapterAdmin`, even for the genuine owner,
because the position manager cannot resolve an owner for an unverified adapter.

**What breaks if it is wrong:** an unapproved hook blocks every mint and increase with
`InvalidHook`, on that specific position manager. Approval is per position manager, so a
second deployment (or the same one on another chain) needs its own call — a value that
worked on one chain does not carry over.

## `pool.pairedCurrency`

The non-permissioned side of the pool. Use the literal `"native"` for the chain's native
asset (ETH, or the chain's equivalent), or a real ERC-20 address for anything else. The
permissioned side of the `PoolKey` is always the adapter — this field is never that side.

**What breaks if it is wrong:** using the underlying permissioned token's own address
here (instead of `"native"` or a genuinely separate paired asset) builds a `PoolKey`
where the currency ordering and the intended pair no longer make sense, and initializing
it either fails at the PoolManager level (equal currencies) or produces a pool nobody
intended to create.

## `pool.feeTier`

The pool's fee, in hundredths of a basis point (v4's standard convention — `3000` means
0.30%). This is an ordinary v4 pool parameter and carries no permissioned-pools-specific
behavior; choose it the way you would for any v4 pool.

**What breaks if it is wrong:** a fee tier mismatched to the pair's expected volatility
and volume profile produces a pool with wrong economics, but nothing in the permissioned-
pools contracts validates or corrects for that — it is a normal v4 liquidity decision the
issuer owns.

## `pool.tickSpacing`

The pool's tick spacing, paired with the fee tier in the same `PoolKey`. Also an
ordinary v4 parameter with no permissioned-pools-specific behavior.

**What breaks if it is wrong:** too fine a tick spacing for the intended fee tier is a gas
and liquidity-management inefficiency, not a permissioned-pools failure; get the pairing
right by the same conventions used for any v4 pool.

## `pool.startingPriceRatio`

Expressed here as a human-readable ratio — paired-currency units per one unit of the
permissioned token — rather than as `sqrtPriceX96`. That conversion is deliberately
deferred to the deployer skill, because it depends on the decimals of **both**
currencies, and this configurator does not resolve the paired currency's decimals (it
only validates the address shape or accepts the literal string `"native"`, the
native-currency sentinel). Recording a
ratio here keeps this configuration correct regardless of which decimals value ends up
resolved later.

**What breaks if it is wrong:** an incorrect starting price does not, by itself, violate
any permissioned-pools invariant — the pool initializes and it is a plain price-discovery
problem from there, same as it would be for an unrestricted v4 pool. The
permissioned-pools-specific failure mode to watch for instead is initializing with the
**wrong currency** in the adapter's slot (see `pool.pairedCurrency` above and
`permissioned-pools-issuer`'s enforced-ordering reference), which is a different mistake
that happens to be made at the same step.

## `seeding`

Whether, and from where, the issuer intends to seed the pool's first liquidity in this
same setup pass. This configurator's own question only ever produces `"seed-now"` (with
a `wallet`) or `"none"` (with `wallet: null`) — `config-schema.md`'s third enum value,
`"seed-later"`, is available for a configuration edited or extended outside this flow,
not something this skill's question set emits itself.

**The check this configuration cannot verify for you:** the wallet that sends the first
mint and the wallet that will own the resulting position both need `LIQUIDITY_ALLOWED`
on the issuer's own allowlist checker — and being the adapter owner grants nothing on
this path. This is, per the reference skill, the step that most often breaks an
otherwise-correct setup. If `seeding.intent` is anything other than `"none"`, treat
allowlisting the named wallet (and the recipient, if different) for `LIQUIDITY_ALLOWED`
as a precondition this configuration assumes has already been handled, not something it
performs.

**What breaks if it is wrong:** a seeding wallet without `LIQUIDITY_ALLOWED` produces a
bare `Unauthorized()` on the first mint attempt — indistinguishable, by selector alone,
from three other unrelated checks failing at the same call site (see
[Enforced Ordering and Reverts](../../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md)
for how to disambiguate).

## Related Reading

- [Config Schema](./config-schema.md) — the exact JSON shape, types, and validation
  rules for every field above.
- `permissioned-pools-issuer`'s
  [Issuer Journey](../../permissioned-pools-issuer/references/issuer-journey.md) — where
  each of these values gets used, in the order the setup sequence recommends.
- `permissioned-pools-issuer`'s
  [Trust Model](../../permissioned-pools-issuer/references/trust-model.md) — what the
  `adapterOwner` key and the `allowedWrappers` list actually control, in full.
