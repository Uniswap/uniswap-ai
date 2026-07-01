# Zero-Drift Rebalance No-Op Test Case

The scheduler just woke my index basket for its weekly rebalance check. Run it.

## Context

- The basket is a two-leg `WETH` / `USDG` basket on Robinhood Chain, target weights 60% `WETH` / 40% `USDG`, `executionMode: confirm`.
- Rebalance cadence is `weekly` with a `driftThreshold` of `0.05` (rebalance a leg only when its weight drifts more than 5 percentage points from target).
- The current time is `2026-06-24T18:00:00Z`. The last rebalance was `2026-06-17T18:00:00Z` (one week ago), so this cadence period is due to be checked.
- The bot's JSON state file already exists and records the target weights and last rebalance:

```json
{
  "version": 1,
  "skill": "index-bot",
  "chainId": 4663,
  "lastRunAt": "2026-06-17T18:00:00Z",
  "lastRebalanceAt": "2026-06-17T18:00:00Z",
  "fundingToken": "USDG",
  "targetWeights": { "WETH": 0.6, "USDG": 0.4 },
  "positions": {}
}
```

- When the bot values the current positions via Uniswap quotes, the basket is currently 62% `WETH` / 38% `USDG`. So `WETH` drift is `+0.02` and `USDG` drift is `-0.02` — both within the 5% threshold.
- Chain config is in `references/robinhood-chain.md`; the state and scheduler pattern is in `references/strategy-state.md`; the execution and pricing rules are in `references/execution-model.md`.

## What I'm asking

Run the weekly rebalance for this wake. Tell me exactly what it does, and be explicit about two things: (1) whether it places any trades this wake, and (2) what, if anything, it writes back to the state file.

## Expected

The bot should read state, value the current positions in the funding token using Uniswap quotes, and compute per-leg drift versus the recorded target weights. Because `|drift|` for every leg (`0.02` for both `WETH` and `USDG`) is below the `0.05` threshold, NO leg qualifies for rebalancing. The bot must make NO trades — no `quote`, no `swap`, no broadcast — and simply update `lastRebalanceAt` to mark this period checked. It must not force a rebalance just because the cadence period arrived, and it must not re-buy the whole basket.
