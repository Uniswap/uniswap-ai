# Step Walkthrough: Steps 2 Through 7

Ordered command sequences for the on-chain setup journey, continuing from
[Preflight and Validation](./preflight-and-validation.md)'s Step 1 (the allowlist checker). Every
step below states its precondition and, where the contracts enforce one, the exact revert
selector raised if that precondition is missing — matching `permissioned-pools-issuer`'s
[Enforced Ordering and Reverts](../../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md)
selector-for-selector. Where a step is not enforced against ordering, this file says so rather
than inventing a revert for it.

**Do not run any command in this file before the acknowledgment gate in
[the skill's main file](../SKILL.md#the-acknowledgment-gate) has been explicitly satisfied**, and
before every address this step needs has passed
[Input Validation Rules](../SKILL.md#input-validation-rules) and, if it started as `"RESOLVE"`,
[address resolution](./preflight-and-validation.md#address-resolution).

Every command below assumes validated values are already in shell variables
(`$FACTORY_ADDRESS`, `$PERMISSIONED_TOKEN`, `$ADAPTER_OWNER`, `$ALLOWLIST_CHECKER`, `$RPC_URL`,
`$DEPLOYER_ADDRESS`, and so on) — never re-read a raw config value directly into a command.
Signing uses `--account <name> --sender $DEPLOYER_ADDRESS` (encrypted keystore) or `--ledger`
(hardware wallet) throughout; see
[Key Handling](./preflight-and-validation.md#key-handling) for both.

---

## Step 2: `createPermissionsAdapter`

**Precondition:** the allowlist checker from Step 1 passes its ERC-165 probe. This is not one of
the five ordering edges — it is a standalone precondition that fires on the very first Uniswap
call in the journey.

**Revert if missing:** `InvalidAllowListChecker(checker)`.

```bash
cast send "$FACTORY_ADDRESS" \
  "createPermissionsAdapter(address,address,address)" \
  "$PERMISSIONED_TOKEN" "$ADAPTER_OWNER" "$ALLOWLIST_CHECKER" \
  --rpc-url "$RPC_URL" \
  --account deployer --sender "$DEPLOYER_ADDRESS"
```

`createPermissionsAdapter` is callable by anyone — the resulting adapter's owner is whichever
address you pass as `$ADAPTER_OWNER`, not whoever sends this transaction. There is no existence
check on the factory either, so read the `PermissionsAdapterCreated` event from this
transaction's receipt to get the new adapter's address, and keep your own record of it — nothing
else marks this adapter as "the canonical one" for your token:

```bash
cast receipt "$TX_HASH" --rpc-url "$RPC_URL"
# Read the adapter address out of the PermissionsAdapterCreated log.
```

**Check afterwards:**

```bash
cast call "$FACTORY_ADDRESS" "permissionsAdapterOf(address)(address)" "$ADAPTER_ADDRESS" --rpc-url "$RPC_URL"
# expect: $PERMISSIONED_TOKEN

cast call "$ADAPTER_ADDRESS" "owner()(address)" --rpc-url "$RPC_URL"
# expect: $ADAPTER_OWNER
```

---

## Step 3: Allowlist and Fund the Adapter

Three sub-steps, none of them a Uniswap call. This is the only step in the whole journey where
you — not "anyone" — must be the one to act, and everything downstream waits on it.

### Step 3a: Allowlist the adapter on your token

Add `$ADAPTER_ADDRESS` to your permissioned token's own allowlist, through whatever admin path
your token exposes. No `forge`/`cast` command is prescribed here because this call is on your
token's own contract, not on any permissioned-pools contract.

**Precondition:** none of its own. **Downstream effect:** this is half of the first enforced
edge — without it, the adapter can never hold a balance, so Step 4 will revert regardless of
Step 3c.

**Check afterwards:** this step has no check of its own that confirms anything. `balanceOf(adapter)`
is necessarily still `0` at this point — the adapter has not been funded yet, that is Step 3c —
so reading it here would only ever show `0` regardless of whether the allowlisting worked.
Confirmation that 3a actually landed comes from Step 3c instead: if your token enforces the
allowlist on incoming transfers, a successful `depositForVerification` (or the `approve` before
it, depending on how your token's allowlist gate is wired) is the first evidence the adapter was
really added. If your token exposes its own allowlist-membership getter, check that directly here
instead — this skill does not know your token's interface and cannot give a generic command for
it.

### Step 3b: Approve the adapter to pull the deposit

`depositForVerification` pulls the tokens with `safeTransferFrom`, so the depositor must approve
first:

```bash
cast send "$PERMISSIONED_TOKEN" \
  "approve(address,uint256)" \
  "$ADAPTER_ADDRESS" "$VERIFICATION_DEPOSIT_AMOUNT" \
  --rpc-url "$RPC_URL" \
  --account deployer --sender "$DEPLOYER_ADDRESS"
```

**Precondition:** must precede Step 3c. **Revert if skipped:** the deposit call reverts inside
your token's own allowance check, not with a permissioned-pools selector — decode it as an
ERC-20 allowance failure, not a bug in this walkthrough.

### Step 3c: `depositForVerification`

Use `depositForVerification`, not a raw ERC-20 transfer, even though the verification gate itself
is a bare `balanceOf` read that a plain transfer would also satisfy. The reason is the event:
`depositForVerification` emits `VerificationDeposit(address indexed depositor, uint256 amount)`,
which is filterable, while a plain `transfer` emits only a generic `Transfer` with no
permissioned-pools-specific signal.

```bash
cast send "$ADAPTER_ADDRESS" \
  "depositForVerification(uint256)" \
  "$VERIFICATION_DEPOSIT_AMOUNT" \
  --rpc-url "$RPC_URL" \
  --account deployer --sender "$DEPLOYER_ADDRESS"
```

`$VERIFICATION_DEPOSIT_AMOUNT` comes from the config's `verificationDepositAmount` field — 1 wei
is sufficient and is not consumed; the deposited balance becomes the adapter's mintable headroom
and there is no way to withdraw it later, so do not deposit more than the config specifies "to be
safe."

**Precondition:** must precede Step 4. **Callable by:** anyone — the security property comes from
the balance itself, arranged in Step 3a, not from who sends this transaction.

**Check afterwards:**

```bash
cast call "$PERMISSIONED_TOKEN" "balanceOf(address)(uint256)" "$ADAPTER_ADDRESS" --rpc-url "$RPC_URL"
# expect: non-zero
```

---

## Step 4: `verifyPermissionsAdapter`

**Precondition (the first enforced edge):** the adapter is allowlisted on your token **and**
holds a non-zero balance of it.

**Revert if missing:** `PermissionsAdapterNotVerified(adapter)`.

```bash
cast send "$FACTORY_ADDRESS" \
  "verifyPermissionsAdapter(address)" \
  "$ADAPTER_ADDRESS" \
  --rpc-url "$RPC_URL" \
  --account deployer --sender "$DEPLOYER_ADDRESS"
```

Callable by anyone, and **irreversible** — a second call on an already-verified adapter reverts
`PermissionsAdapterAlreadyVerified(adapter)`, and an address the factory never created reverts
`PermissionsAdapterNotFound(adapter)`. There is no undo: the factory has no owner and no setters
at all.

**Check afterwards:**

```bash
cast call "$FACTORY_ADDRESS" "verifiedPermissionsAdapterOf(address)(address)" "$ADAPTER_ADDRESS" --rpc-url "$RPC_URL"
# expect: $PERMISSIONED_TOKEN
```

This is the hinge of the whole journey — three of the five enforced edges (Steps 5b, 6a, and 6c
below) depend directly on this call having landed.

---

## Step 5: Register Wrappers and the Hook

Two independent operations, neither enforced against the other. Register wrappers before or
after pool creation — nothing depends on the position — but each one must be registered before
anything is routed through it.

### Step 5a: The four `updateAllowedWrapper` registrations

**Precondition (the fifth enforced edge):** not enforced against setup ordering — this is an
`onlyOwner` call on the adapter with no dependency on verification or on the pool existing. It
**is** enforced against use: nothing can be routed through a contract that is not registered.

**Revert if a contract is used unregistered:** a bare `Unauthorized()` from the hook, then
`UnauthorizedWrapper(wrapper)` on settlement.

Register exactly these four, and only these four (plus any issuer-added custom wrapper from the
config's `allowedWrappers` object) — **never the factory, and never the hook**. Both are in the
deploy guide's six-row Step 5 table and neither is a wrapper; registering either is a
configuration error. [Preflight and Validation](./preflight-and-validation.md#loading-the-configuration)
already stops on a config _key_ literally named `factory` or `hook` sitting inside the
`allowedWrappers` object — but that is a key-name check, not a value check: it cannot catch the
factory's or the hook's address being written as the _value_ of one of the four legitimate
`allowedWrappers` keys instead, nor the same mistake made here, by hand, when generating this
step's commands directly. So check the address you are about to register against the resolved
factory and hook addresses before sending, regardless of which key it came from.

```bash
# 1. PermissionedPositionManager — required before the first mint
cast send "$ADAPTER_ADDRESS" "updateAllowedWrapper(address,bool)" "$PERMISSIONED_POSITION_MANAGER" true \
  --rpc-url "$RPC_URL" --account deployer --sender "$DEPLOYER_ADDRESS"

# 2. Universal Router, the "UniversalRouter#v2.2" deployment (2.2.0 or higher) — required before the first swap through it
cast send "$ADAPTER_ADDRESS" "updateAllowedWrapper(address,bool)" "$UNIVERSAL_ROUTER_V2_2" true \
  --rpc-url "$RPC_URL" --account deployer --sender "$DEPLOYER_ADDRESS"

# 3. V4Quoter — required before the first quote simulation
cast send "$ADAPTER_ADDRESS" "updateAllowedWrapper(address,bool)" "$V4_QUOTER" true \
  --rpc-url "$RPC_URL" --account deployer --sender "$DEPLOYER_ADDRESS"

# 4. MixedRouteQuoterV2 — same requirement, for mixed-route quoting
cast send "$ADAPTER_ADDRESS" "updateAllowedWrapper(address,bool)" "$MIXED_ROUTE_QUOTER_V2" true \
  --rpc-url "$RPC_URL" --account deployer --sender "$DEPLOYER_ADDRESS"
```

The plain `UniversalRouter` deployments key is a **different, non-permissioned router** on the
same chain — only the `#v2.2` deployment (2.2.0 or higher) takes the permissions-adapter factory
in its constructor. Resolving the wrong key registers a contract that looks right and produces a
swap path that cannot work.

**Check afterwards, for each of the four:**

```bash
cast call "$ADAPTER_ADDRESS" "allowedWrappers(address)(bool)" "$PERMISSIONED_POSITION_MANAGER" --rpc-url "$RPC_URL"
# repeat for the router, both quoters, and any custom wrapper — expect true

cast call "$ADAPTER_ADDRESS" "allowedWrappers(address)(bool)" "$FACTORY_ADDRESS" --rpc-url "$RPC_URL"
cast call "$ADAPTER_ADDRESS" "allowedWrappers(address)(bool)" "$PERMISSIONED_HOOKS" --rpc-url "$RPC_URL"
# both expect false
```

### Step 5b: `setAllowedHook` on the position manager

**Precondition (the second enforced edge):** the adapter must already be verified (Step 4).
`_getOwner` resolves to `address(0)` for an unverified adapter's currency, so even the genuine
owner is rejected before verification.

**Revert if early:** `NotPermissionsAdapterAdmin()`.

```bash
cast send "$PERMISSIONED_POSITION_MANAGER" \
  "setAllowedHook(address,address,bool)" \
  "$ADAPTER_ADDRESS" "$PERMISSIONED_HOOKS" true \
  --rpc-url "$RPC_URL" \
  --account deployer --sender "$DEPLOYER_ADDRESS"
```

This call is `setAllowedHook` (singular), on the position manager — not on the adapter, and not
through `updateAllowedWrapper`. It gates the LP path only (mints and increases; never swaps,
decreases, or burns), and it is per position manager — approve it again for another deployment or
another chain.

**Check afterwards:**

```bash
cast call "$PERMISSIONED_POSITION_MANAGER" \
  "isAllowedHooks(address,address)(bool)" "$ADAPTER_ADDRESS" "$PERMISSIONED_HOOKS" \
  --rpc-url "$RPC_URL"
# expect: true
```

---

## Step 6: Create the Pool, Enable Swapping, Seed Liquidity

### Step 6a: Initialize the pool

**Precondition (the third enforced edge):** the currency must have been created by the factory
**and** verified.

**Revert if missing:** `NoVerifiedAdapter()` if neither currency was created by the factory at
all (a wrong-address mistake, not a verification problem despite the name), or
`UnverifiedAdapter()` if a factory-created currency exists but Step 4 has not landed yet.

The `PoolKey`'s permissioned side is always `$ADAPTER_ADDRESS` — never the underlying
`$PERMISSIONED_TOKEN`. The paired side is `$PAIRED_CURRENCY`, resolved from the config's
`pool.pairedCurrency`: the literal `"native"` resolves to `address(0)` here and only here; any
other value is already a validated ERC-20 address. Because struct arguments and the
ratio-to-`sqrtPriceX96` conversion below are awkward to build with `cast` alone, use a `forge
script`:

```solidity
// script/InitializePool.s.sol
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface IPoolManager {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24);
}

contract InitializePool is Script {
    function run() external {
        address adapter = vm.envAddress("ADAPTER_ADDRESS");
        address pairedCurrency = vm.envAddress("PAIRED_CURRENCY");
        address poolManager = vm.envAddress("POOL_MANAGER_ADDRESS");
        address hooks = vm.envAddress("PERMISSIONED_HOOKS");
        uint24 fee = uint24(vm.envUint("POOL_FEE_TIER"));
        int24 tickSpacing = int24(vm.envInt("POOL_TICK_SPACING"));
        uint160 sqrtPriceX96 = uint160(vm.envUint("POOL_SQRT_PRICE_X96"));

        // currency0 must sort strictly below currency1 as an address — the PoolManager
        // rejects an out-of-order or equal pair before the hook ever runs.
        (address currency0, address currency1) =
            adapter < pairedCurrency ? (adapter, pairedCurrency) : (pairedCurrency, adapter);

        vm.startBroadcast();
        IPoolManager(poolManager).initialize(
            IPoolManager.PoolKey({
                currency0: currency0,
                currency1: currency1,
                fee: fee,
                tickSpacing: tickSpacing,
                hooks: hooks
            }),
            sqrtPriceX96
        );
        vm.stopBroadcast();
    }
}
```

```bash
forge script script/InitializePool.s.sol:InitializePool \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --account deployer --sender "$DEPLOYER_ADDRESS"
```

`$POOL_SQRT_PRICE_X96` is derived, not configured directly: the configurator stores
`pool.startingPriceRatio` as a human-readable paired-currency-per-permissioned-token ratio,
because the `sqrtPriceX96` conversion depends on both currencies' decimals, which the configurator
does not resolve. Read both decimals first —

```bash
cast call "$PERMISSIONED_TOKEN" "decimals()(uint8)" --rpc-url "$RPC_URL"
cast call "$PAIRED_CURRENCY" "decimals()(uint8)" --rpc-url "$RPC_URL"   # skip for native — 18 decimals
```

— then compute `sqrtPriceX96 = sqrt(ratio * 10^(decimals1 - decimals0)) * 2^96`, adjusted for
which currency ended up as `currency0` versus `currency1` above (the ratio is
paired-per-permissioned; invert it if the permissioned adapter is `currency1`).

**Check afterwards:** the pool's `slot0` reads back the intended starting price, and the
`PoolKey`'s currency is the adapter — never the underlying token.

### Step 6b: `updateSwappingEnabled`

**Precondition:** none — not one of the five enforced edges. This is an `onlyOwner` call on the
adapter with no dependency on the pool existing; the guide places it after pool creation as a
convention, not a requirement.

```bash
cast send "$ADAPTER_ADDRESS" "updateSwappingEnabled(bool)" true \
  --rpc-url "$RPC_URL" --account deployer --sender "$DEPLOYER_ADDRESS"
```

`swappingEnabled` defaults to `false`, so every swap reverts `SwappingDisabled()` — checked by the
hook before the wrapper check, and again by the router on settlement — until this call lands.
There is no equivalent flag for liquidity; LPs can act while swapping is paused.

**Check afterwards:**

```bash
cast call "$ADAPTER_ADDRESS" "swappingEnabled()(bool)" --rpc-url "$RPC_URL"
# expect: true
```

### Step 6c: Allowlist the seeding wallet, approve Permit2, then seed liquidity

**Precondition (the fourth enforced edge):** a verified adapter on at least one side, the hook
approved on this position manager, and `LIQUIDITY_ALLOWED` on **both** the caller and the
recipient of the mint.

**Revert if missing:** `NoVerifiedAdapter()` (position manager's own declaration — a different
raise site than Step 6a's), `InvalidHook()`, or a bare `Unauthorized()`. The bare `Unauthorized()`
can come from four independent checks that share the same selector — see
[Enforced Ordering and Reverts](../../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md#scenario-5-the-first-seeding-mint-from-a-wallet-that-is-not-on-your-own-allowlist)
for how to disambiguate by call site rather than by name.

**The caller-and-recipient `LIQUIDITY_ALLOWED` requirement, stated plainly:** being the adapter
owner grants nothing on this path. Before the first mint, both the wallet that sends it and the
wallet that will own the resulting position must hold `LIQUIDITY_ALLOWED` on your own checker's
allowlist. If `seeding.intent` is `"seed-now"` in the config, the issuer must allowlist
`seeding.wallet` on their own token's allowlist for `LIQUIDITY_ALLOWED` **before** attempting this
mint — this skill does not do that allowlisting for you, because it is a call on your token's own
contract, not a permissioned-pools contract.

Its signature per `permissioned-pools-issuer`'s
[Contract Architecture](../../permissioned-pools-issuer/references/contract-architecture.md) is
`isAllowed(address,PermissionFlag)`. `PermissionFlag` is a user-defined value type, and the
reference does not state its underlying integer width — `uint16` below is inferred from the flag
constants spanning `0x0000`-`0xFFFF`, not a value read from source. Confirm `PermissionFlag`'s
declaration in `PermissionFlags.sol` at the pinned commit before relying on the exact ABI type; the
flag value `2` for `LIQUIDITY_ALLOWED` is confirmed correct regardless of that width:

```bash
cast call "$ADAPTER_ADDRESS" \
  "isAllowed(address,uint16)(bool)" "$SEEDING_WALLET" 2 \
  --rpc-url "$RPC_URL"
# 2 = LIQUIDITY_ALLOWED. Confirm true for both the sending wallet and the position recipient
# before sending the mint below — this is a read, not part of the mint transaction. If this
# reverts on ABI-decoding rather than returning false, re-check PermissionFlag's underlying
# type before concluding the wallet lacks the permission.
```

**The two Permit2 approvals, both required before the first mint, and both on the underlying
token, never on the adapter:**

```bash
# 1. Approve Permit2 to move the underlying permissioned token.
cast send "$PERMISSIONED_TOKEN" "approve(address,uint256)" "$PERMIT2_ADDRESS" \
  115792089237316195423570985008687907853269984665640564039457584007913129639935 \
  --rpc-url "$RPC_URL" --account deployer --sender "$DEPLOYER_ADDRESS"

# 2. Approve the PermissionedPositionManager as a Permit2 spender.
cast send "$PERMIT2_ADDRESS" \
  "approve(address,address,uint160,uint48)" \
  "$PERMISSIONED_TOKEN" "$PERMISSIONED_POSITION_MANAGER" \
  1461501637330902918203684832716283019655932542975 281474976710655 \
  --rpc-url "$RPC_URL" --account deployer --sender "$DEPLOYER_ADDRESS"
```

Both approvals above grant the maximum allowance with no expiry, matching the published issuer
skill's own example exactly — if your operational risk tolerance calls for it, both can instead
be scoped to the seeding amount with a short expiry, and revoked (`approve(spender, 0)` on the
token, `Permit2.approve(..., 0, 0)` on the position-manager spend) once seeding is complete.

**Permit2 itself is never registered as an allowed wrapper.** It never holds the token and never
calls the PoolManager on this pool's behalf — the position manager pulls through it with
`permit2.transferFrom(payer, adapter, amount, permissionedToken)`, which is a different
relationship than the `allowedWrappers` check. Missing either approval above fails inside Permit2
with an allowance error, not a permissioned-pools selector.

Mint through `$PERMISSIONED_POSITION_MANAGER` — never the standard `PositionManager` — using
whatever minting interface your Foundry scripting setup wraps it with; the position manager also
needs to be a registered allowed wrapper on the adapter (Step 5a) or the hook rejects the mint
with the same bare `Unauthorized()` regardless of the allowlist and Permit2 state being correct.

**Check afterwards:** the position NFT exists, and the pool shows liquidity at the intended
range.

---

## Step 7: Request Routing Allowlisting

The on-chain pool is complete after Step 6. This step has no `forge`/`cast` command — it is a
form submission to Uniswap Labs, not a transaction.

Once the adapter is verified, submit the routing-allowlist request through the published
dev-portal form, once per network (including Sepolia — testnet routing is not self-serve). The
form needs, at minimum, the permissioned token address, the verified adapter address, and a KYC
URL; see `permissioned-pools-issuer`'s
[Coordination Boundary](../../permissioned-pools-issuer/references/coordination-boundary.md#what-the-form-asks-for)
for the complete field list, including two fields the published guide never mentions.

Timelines, eligibility, and outcomes are not defined by the contracts and are not something this
skill can commit to on Uniswap Labs' behalf.

---

## Related Reading

- [Preflight and Validation](./preflight-and-validation.md) — Step 1, config validation, address
  resolution, input validation in full, key handling, and testnet-first sequencing.
- `permissioned-pools-issuer`'s
  [Issuer Journey](../../permissioned-pools-issuer/references/issuer-journey.md) — the same
  sequence presented as contract mechanics rather than command sequences.
- `permissioned-pools-issuer`'s
  [Enforced Ordering and Reverts](../../permissioned-pools-issuer/references/enforced-ordering-and-reverts.md) —
  the full revert catalogue and worked out-of-order scenarios this file's precondition callouts
  are drawn from.
