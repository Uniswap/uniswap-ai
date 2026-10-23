# Building on BaseAggregatorHook

Reference design taken from [`BaseAggregatorHook`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/BaseAggregatorHook.sol) at commit `2264ac8b023011fdca8fd3422ada172dc10184e0`. It describes what Uniswap's own hooks do. No Uniswap source recommends that outside developers subclass it.

Read the three required disclosures in `SKILL.md` first: no published audit, `ProtocolFees.sol` is AGPL-3.0-only, and subclasses send the protocol fee to Uniswap's TokenJar.

## What you implement

| Function                                                     | Purpose                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `_conductSwap(settleCurrency, takeCurrency, params, poolId)` | Execute the swap on the venue. Returns `(amountSettle, amountTake, hasSettled)`. |
| `_rawQuote(zeroToOne, amountSpecified, poolId)`              | Venue quote before the protocol fee. `quote()` adds the fee on top.              |
| `pseudoTotalValueLocked(poolId)`                             | Venue balances for the pool's two tokens, for routers.                           |

`settleCurrency` is what the swapper receives (the hook must settle it to the `PoolManager`). `takeCurrency` is what the swapper pays (the hook takes it from the `PoolManager`).

Use `BaseHookDataAggregator` ([source](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/BaseHookDataAggregator.sol)) only when the fill depends on per-swap `hookData`. Most aggregator hooks ignore `hookData` because the venue is fixed at initialization. Only the UniswapX hook uses the variant.

## Settlement

Two supported patterns, per the NatSpec on `_conductSwap`:

1. Return the amounts with `hasSettled = false`. The base settles the output through v4-periphery's `DeltaResolver`.
2. Settle inside `_conductSwap` using the sync, send, settle sequence, and return `hasSettled = true`.

The Curve hook takes the input from the `PoolManager`, calls the pool, and measures the output by balance difference before the base settles. The Uniswap V3 family syncs the output currency, calls the external pool with the `PoolManager` as recipient, pays the input inside the swap callback, then settles. Measuring balances beats trusting a venue's return value: the Curve hook uses a low-level call because older Curve pools return nothing.

## Pool registration in `_beforeInitialize`

Validate everything about the external venue when the v4 pool is created, not per swap:

- Confirm the venue exists and is the expected type (the Curve hook checks the MetaRegistry and rejects meta pools; the V3 family looks up the pool in the factory, then checks fee or tick spacing and token order against the PoolKey).
- Record the PoolId to venue mapping (for Curve, token indices).
- `forceApprove` the venue once for the tokens it will pull.
- Reject duplicate canonical pools where the venue allows only one (`PairAlreadyHasCanonicalPool`).
- Call `pollTokenJar()` and emit `AggregatorPoolRegistered`.

## Callback safety (V3-style venues)

The V3 family accepts a swap callback from the external pool. It guards this with a transient-storage slot holding the expected pool, rejects callers that are not that pool (`UnauthorizedCallback`, `CallbackOutsideActiveSwap`), and uses a transient reentrancy guard. Quotes force a revert inside the callback to read amounts. Treat any callback surface the same way.

## Quoting and TVL for routers

- `quote` is not `view` but is meant to be static-called, and it applies the protocol fee.
- `pseudoTotalValueLocked` reports the venue's balances. Pools emit no v4 liquidity events, so routers should poll it, not index events. Shared venue liquidity is not exclusive per v4 pool.
- Create pools only for direct venue pairs so router-composed hops never fight over the same hidden liquidity (Tempo README guidance).

## Singleton or per-pool

From the [aggregator hooks README](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/README.md): if the venue has a strict one-to-one mapping to a v4 PoolKey, the implementation must be a singleton, with no factory. Curve and Fluid use one hook per venue pool, so a router can spot two v4 pools backed by one Curve pool by the duplicate hook address.

## Address mining

The hook address must encode the permission bits, and Uniswap's set also encodes a first-byte protocol ID, mined with [`AggregatorHookMiner`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/utils/AggregatorHookMiner.sol) and [`MineAggregatorHook.s.sol`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/script/MineAggregatorHook.s.sol). The README says a random address has a 1/256 chance of a false ID match, so routers should not treat the ID as proof. See [implementations.md](implementations.md).

## Testing and deployment

From the [test README](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/test/aggregator-hooks/README.md), a new protocol needs:

- Unit tests with 100% coverage.
- Fork tests against the real deployed protocol, run on a USDT pool at least once (USDT behaves differently).
- Fuzz tests.

Run with `FOUNDRY_PROFILE=aggregator_hooks forge test --match-path "test/aggregator-hooks/*"`. Fork RPC variables are chain-scoped (`FORK_RPC_URL_1`, `FORK_RPC_URL_8453`). Compiler settings in the repo: Solidity 0.8.29 for implementations, EVM version `cancun`.

Before going live: mine the address, initialize one pool per pair, watch the `HookSwap` and `AggregatorPoolRegistered` events, and, if you want Uniswap routing, use the [hook allowlist form](https://developers.uniswap.org/hook-allowlist).

## Security checks specific to this pattern

- The hook must measure real output, validate venue identity at initialization, and never trust unchecked venue return data.
- Slippage is checked by the router, so `min_dy = 0` style calls are acceptable only on paths that always carry a router limit. Confirm that for every entry point.
- A delta that fully consumes the input makes the swap a NoOp that bypasses the pool, so input and output math and internal accounting must be exact (see the [v4 security framework](https://developers.uniswap.org/docs/protocols/v4/security)).
- Assume venue state can change before callbacks finish. Keep external calls few and guarded.
- External liquidity increases risk: the security framework scores "External liquidity exposure" explicitly.
