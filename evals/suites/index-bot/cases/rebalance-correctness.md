# Rebalance Correctness Test Case (overweight + underweight)

The scheduler just woke my index basket for its weekly rebalance check. The basket has drifted. Run it.

## Context

- The basket is a three-leg basket on Robinhood Chain over the currently tradable set, target weights 50% `WETH` / 30% `USDG` / 20% `ETH`, `executionMode: confirm`.
- Rebalance cadence is `weekly` with a `driftThreshold` of `0.05` (rebalance a leg only when its weight drifts more than 5 percentage points from target).
- The current time is `2026-06-24T18:00:00Z`. The last rebalance was `2026-06-17T18:00:00Z` (one week ago), so this cadence period is due.
- The bot's JSON state file already records the target weights and last rebalance:

```json
{
  "version": 1,
  "skill": "index-bot",
  "chainId": 4663,
  "lastRunAt": "2026-06-17T18:00:00Z",
  "lastRebalanceAt": "2026-06-17T18:00:00Z",
  "fundingToken": "USDG",
  "targetWeights": { "WETH": 0.5, "USDG": 0.3, "ETH": 0.2 },
  "positions": {}
}
```

- When the bot reads current on-chain balances via viem and values each leg in the funding token using Uniswap quotes, the basket is currently **60% `WETH` / 18% `USDG` / 22% `ETH`**. So the per-leg drift is:
  - `WETH`: current `0.60` − target `0.50` = `+0.10` (overweight, `|drift| = 0.10 > 0.05`)
  - `USDG`: current `0.18` − target `0.30` = `−0.12` (underweight, `|drift| = 0.12 > 0.05`)
  - `ETH`: current `0.22` − target `0.20` = `+0.02` (`|drift| = 0.02 < 0.05`, within threshold)
- Chain config is in `references/robinhood-chain.md`; the state and scheduler pattern is in `references/strategy-state.md`; pricing and execution rules are in `references/execution-model.md`.

## What I'm asking

Run the weekly rebalance for this wake. Tell me exactly which legs you trade and in which direction.

## Expected

The bot must compute drift per leg as `currentWeight − targetWeight` and compare the **absolute** drift `|drift|` against the `0.05` threshold so it catches BOTH overweight and underweight legs.

- `WETH` is **overweight** (`+0.10`, past threshold): the bot must **sell** `WETH` to bring it back toward `0.50`.
- `USDG` is **underweight** (`−0.12`, past threshold): the bot must **buy** `USDG` to bring it back toward `0.30`. (Here `USDG` is also the funding token, so selling the overweight `WETH` into `USDG` naturally reduces the `USDG` shortfall — the bot should reason about this rather than over-trading.)
- `ETH` drift is `+0.02`, **within** the threshold: the bot must NOT trade the `ETH` leg.

So the rebalance touches the two drifted legs and leaves `ETH` alone. Every adjusting trade is delegated to the swap-integration Trading API flow (`check_approval`, `quote`, `swap`). The bot must NOT re-buy the entire basket from scratch, and must NOT skip the underweight leg by only looking at positive drift. After successful broadcasts it updates `lastRebalanceAt` and the recorded positions.
