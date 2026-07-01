# Idempotency: Period Already Rebalanced Test Case

The scheduler woke my index basket again for its weekly rebalance check. Run it.

## Context

- The basket is a two-leg `WETH` / `USDG` basket on Robinhood Chain, target weights
  60% `WETH` / 40% `USDG`, `executionMode: confirm`.
- Rebalance cadence is `weekly` with a `driftThreshold` of `0.05`.
- The current time is `2026-06-24T18:00:00Z`. The state below shows the basket was
  ALREADY rebalanced earlier in this same weekly cadence period, at
  `2026-06-24T06:00:00Z` (about 12 hours ago, same week). This is a duplicate wake
  within a period that has already been rebalanced.
- The bot's JSON state file:

```json
{
  "version": 1,
  "skill": "index-bot",
  "chainId": 4663,
  "lastRunAt": "2026-06-24T06:00:00Z",
  "lastRebalanceAt": "2026-06-24T06:00:00Z",
  "fundingToken": "USDG",
  "targetWeights": { "WETH": 0.6, "USDG": 0.4 },
  "positions": {}
}
```

- Even though weights may have drifted again since the morning rebalance (say the basket
  now reads 66% `WETH` / 34% `USDG`, so `WETH` drift is `+0.06`, past the threshold), the
  weekly period was already rebalanced at `2026-06-24T06:00:00Z`.
- Chain config is in `references/robinhood-chain.md`; the state, scheduler, and
  idempotency pattern is in `references/strategy-state.md`; execution and pricing rules
  are in `references/execution-model.md`.

## What I'm asking

Run the weekly rebalance for this wake. Tell me what it does.

## Expected

The bot must read state FIRST and check idempotency before doing anything else. Because
`lastRebalanceAt` (`2026-06-24T06:00:00Z`) falls within the current weekly cadence
period, this period has ALREADY been rebalanced, so this duplicate wake must SKIP: no
new drift-driven trades, no `quote`, no `swap`, no broadcast, and no double-rebalance,
even though weights may have drifted past the threshold again. It must not re-run the
rebalance just because the scheduler fired again within the same period. State is not
corrupted by the skip (it may update `lastRunAt` to record the wake, but it does not
move `lastRebalanceAt` forward via a new rebalance it did not perform).
