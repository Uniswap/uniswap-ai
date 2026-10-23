# Aggregator Hooks Uniswap Has Implemented

Source: [`src/aggregator-hooks/implementations`](https://github.com/Uniswap/v4-hooks-public/tree/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/implementations). Deployment models come from the [aggregator hooks README](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/README.md).

| Venue                       | Implementation                                                                                                                                                                              | Deployment model                                | Exact-output                         | Native ETH                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| Curve StableSwap            | [`StableSwapAggregator`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/implementations/StableSwap/StableSwapAggregator.sol) | One hook per Curve pool, all pairs of that pool | No (`ExactOutputNotSupported`)       | Yes, mapped to Curve's sentinel          |
| Curve StableSwap-NG         | `StableSwapNGAggregator`                                                                                                                                                                    | One hook per Curve pool                         | Yes (NatSpec)                        | `NativeCurrencyNotSupported` is declared |
| Fluid DEX T1                | `FluidDexT1Aggregator`                                                                                                                                                                      | One hook per Fluid pool                         | Yes (native-input exact-out reverts) | Limited                                  |
| Fluid DEX Lite              | `FluidDexLiteAggregator`                                                                                                                                                                    | One hook per Fluid pool                         | Yes (native-input exact-out reverts) | Limited                                  |
| Tempo stablecoin DEX        | `TempoExchangeAggregator`                                                                                                                                                                   | Singleton, many pairs                           | Yes (NatSpec)                        | Not applicable (stablecoins)             |
| Uniswap V2-compatible       | `UniswapV2Aggregator`                                                                                                                                                                       | Singleton per factory                           | Yes (no fee-on-transfer input)       | No                                       |
| Uniswap V3-compatible       | `UniswapV3Aggregator`                                                                                                                                                                       | Singleton per factory                           | Yes                                  | No                                       |
| Slipstream (Aerodrome CL)   | [`SlipstreamAggregator`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/implementations/Slipstream/SlipstreamAggregator.sol) | Singleton, extends the V3 hook                  | Yes (inherited)                      | No                                       |
| PancakeSwap V3              | `PancakeSwapV3Aggregator`                                                                                                                                                                   | Singleton, extends the V3 hook                  | Yes (inherited)                      | No                                       |
| MakerDAO LitePSM            | `LitePSMAggregator`                                                                                                                                                                         | Singleton, one canonical pool per gem/USDS pair | Yes                                  | No                                       |
| UniswapX order as liquidity | `UniswapXAggregator` (via `BaseHookDataAggregator`)                                                                                                                                         | One per Reactor                                 | Both directions, all-or-nothing      | Bridged to WETH on the order side        |

Some cells come from NatSpec and targeted reading, not full line-by-line review. Verify the contract before relying on an exact-output or native-ETH claim.

Notes:

- The README names a `FluidDexV2Aggregator` as "Mainnet launch TBD". No such contract exists at the pinned commit.
- Balancer has no aggregator hook in `v4-hooks-public`.
- Curve and Fluid interfaces are redefined in the repo: Curve is written in Vyper, and Fluid's library pins exact Solidity versions that conflict with v4's pragma.
- UniswapX is solver-driven: `quote` reverts `QuoteNotSupported` and `pseudoTotalValueLocked` reverts `TVLNotSupported`. `quoteWithHookData` takes the order as `hookData` and quotes it ([`BaseHookDataAggregator`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/BaseHookDataAggregator.sol)). The pool opts out of protocol-fee classification.
- Tempo is a separate chain with a precompiled exchange. Its README documents a testnet deployment and gas measurements.
- Which venues the launch blog post counts is unpublished. This skill does not give a count.

## First-byte protocol IDs

Uniswap's aggregator-hook addresses carry a protocol ID in the first byte, mined with the `AggregatorHookMiner`. The table is in the [README](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/README.md) and the mining logic in [`MineAggregatorHook.s.sol`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/script/MineAggregatorHook.s.sol). Routers use the ID to notice when a route touches the same venue twice. A random address matches any given ID with probability 1/256, so do not treat it as proof of origin.

The README's UniswapX row is stale: the mining script defines the UniswapX ID as `0xDC`, which is newer than the README row. Read the script, not the README, for the current value.

## Where the hooks are deployed

Do not copy addresses from this skill. Read the router's per-chain configuration, linked with its caveats in [integrator-guide.md](integrator-guide.md#finding-the-hooks).
