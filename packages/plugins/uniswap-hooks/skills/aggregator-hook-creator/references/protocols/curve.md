# Curve

Uniswap's Curve aggregator hooks are [`StableSwapAggregator`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/implementations/StableSwap/StableSwapAggregator.sol) and `StableSwapNGAggregator`, with factories for deployment.

## Design

- **One hook per Curve pool.** A Curve pool with n tokens yields n(n-1)/2 v4 pools, and all of them share the hook. Swaps in one direction affect the others, and routers detect the overlap by seeing the same hook address.
- **Token indices are discovered at initialization.** `_beforeInitialize` scans `coins(i)` (up to 8), maps each v4 currency to an index, and stores it per PoolId.
- **Pool validation.** The hook checks the Curve MetaRegistry: the pool must be registered, and meta pools are rejected.
- **Native ETH.** v4 uses the zero address and Curve uses a sentinel address; the hook translates between them.
- **Interfaces are defined in the repo** because Curve is Vyper and ships no Solidity interfaces.

## Swap flow

1. `poolManager.take` the input to the hook.
2. Call `exchange` with `min_dy = 0`. The source comment says slippage is checked in the router.
3. Measure the output by balance difference. A low-level call is used because some pools, such as 3pool, return nothing.
4. The base settles the output and applies the protocol fee.

`min_dy = 0` is acceptable only because the router enforces the user's minimum. A path that reaches the hook without a router limit would expose users to unbounded slippage.

## Limits

- StableSwap is exact-input only (`ExactOutputNotSupported`); StableSwap-NG documents exact-output support.
- `exchange_underlying` is not used, because meta pools are rejected.

Curve documentation: [curve.readthedocs.io](https://curve.readthedocs.io/).
