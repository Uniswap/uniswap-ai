# Aerodrome Slipstream

Uniswap integrates Aerodrome's concentrated-liquidity pools, called Slipstream, through [`SlipstreamAggregator`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/implementations/Slipstream/SlipstreamAggregator.sol). It does not use the classic Aerodrome Router, and no Aerodrome v2 or Velodrome hook exists in `v4-hooks-public`.

## Design

- **Singleton hook.** One deployment serves many v4 pools. It extends `UniswapV3Aggregator` and changes only how the external pool is resolved.
- **Pool lookup by tick spacing.** The hook calls the Slipstream factory's `getPool(token0, token1, tickSpacing)` and checks the pool's `tickSpacing()` matches the PoolKey.
- **Dynamic fee flag.** Slipstream fees are dynamic, so the PoolKey's `fee` must be the dynamic-fee flag. Anything else reverts `ExternalPoolMismatch`.
- **Swap path.** Calls the external pool's `swap` and pays inside `uniswapV3SwapCallback`. The callback is guarded as described in [callback safety](../base-aggregator-hook.md#callback-safety-v3-style-venues).
- **Quotes** use a chain-deployed quoter compatible with `IQuoterV2`.

## Factory addresses

Two public sources show different Slipstream factory addresses: a code comment in the routing allowlist and an example in the test README. This skill does not choose between them. Read the factory the target hook was deployed with, on chain, before trusting either.

Aerodrome documentation: [aerodrome.finance/docs](https://aerodrome.finance/docs).
