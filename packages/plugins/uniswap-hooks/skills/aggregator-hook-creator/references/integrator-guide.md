# Integrating with Uniswap's Aggregator Hooks

For routers, solvers, and apps that consume aggregator-hook pools. No Solidity needed.

## Quote and TVL

Every aggregator hook implements [`IAggregatorHook`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/interfaces/IAggregatorHook.sol):

| Function                                                | Notes                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `quote(bool zeroToOne, int256 amountSpecified, PoolId)` | Negative `amountSpecified` is exact-input, positive is exact-output. Returns a positive unspecified amount, with the protocol fee applied. |
| `pseudoTotalValueLocked(PoolId)`                        | Returns `(amount0, amount1)`, the venue's balances for the pool's tokens.                                                                  |

`quote` is declared non-view, so call it with `eth_call` or `cast call`, not as a transaction. Not every hook supports every direction: StableSwap is exact-input only, and the UniswapX hook reverts `QuoteNotSupported` because its order is known only at swap time. See [implementations.md](implementations.md).

```bash
# static call; the arguments are your hook address and a PoolId
cast call <HOOK> "quote(bool,int256,bytes32)(uint256)" true -1000000 <POOL_ID> --rpc-url <RPC>
```

Guidance from the Tempo README: poll `pseudoTotalValueLocked` periodically and do not rely on event-driven indexing, because these pools emit no v4 liquidity events. Shared venue liquidity is not exclusive to one v4 pool, and swaps in one direction can change quotes in others.

The swap itself goes through a router such as the Universal Router. The hook does no slippage checking, so your transaction must set a minimum output.

## Finding the hooks

Guidestar publishes the live routing configuration, including each chain's `aggregator_hook_sources`. Read it instead of copying addresses into your code:

- [`config/1.json`](https://github.com/Uniswap/guidestar-public/blob/ab00e840fef9e22c595657b372f714361053368b/config/1.json) (Ethereum)
- [`config/8453.json`](https://github.com/Uniswap/guidestar-public/blob/ab00e840fef9e22c595657b372f714361053368b/config/8453.json) (Base)
- [`config/4663.json`](https://github.com/Uniswap/guidestar-public/blob/ab00e840fef9e22c595657b372f714361053368b/config/4663.json) (Robinhood Chain)
- [Guidestar README](https://github.com/Uniswap/guidestar-public/blob/ab00e840fef9e22c595657b372f714361053368b/README.md), "How the Route is Chosen"

The README describes each `hook` entry as the Uniswap-deployed aggregator-hook wrapper and each `factory` entry as the protocol's own pool registry. Whether a specific `factory` entry is the venue's registry or a Uniswap factory is not stated, so verify on chain before assuming. The router discovers new venue pools on an interval, and RPC-priced pools must return successful quotes at multiple trade sizes.

The published [routing allowlist](https://github.com/Uniswap/uniroute-public/blob/d36ec748635b525bf936637283061d1a90007420/src/lib/poolCaching/util/hooksAddressesAllowlist.ts) also lists some aggregator hooks. It is a routing list, not a deployments page.

## Routing through the Uniswap API

Aggregator-hook routes come from the routing engine, so most integrators need no hook-specific code. Per the [Guidestar Routing Beta notice](https://developers.uniswap.org/docs/changelog/active-notifications/guidestar-routing-beta):

- Opt in on `/quote` with headers `x-api-experimental: true` and `x-universal-router-swapsteps: true`.
- During the beta: same-chain `EXACT_INPUT` only, on chains 1, 8453, and 4663.
- Read `quote.swapSteps` (the Universal Router sequence), not `route` or `routeString`.
- No fallback: unsupported requests return HTTP 400, unroutable ones HTTP 404. Retry without the headers for a standard quote.

Details: [Guidestar routing in the API docs](https://developers.uniswap.org/docs/trading/swapping-api/amm-vs-uniswapx-routing). For general swap integration use the `swap-integration` skill.

## If a venue is not routed

Routing picks up many hooks automatically, and some need review. For the hook allowlist form and the contact point for adding a venue to Uniswap's own set, see "Pick your path" in [SKILL.md](../SKILL.md#pick-your-path).
