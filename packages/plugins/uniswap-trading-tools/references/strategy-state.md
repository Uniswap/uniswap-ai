# Strategy state and scheduling

Shared pattern for the three skills so they run repeatedly, deterministically, and idempotently. This is the only net-new infrastructure; it sits on top of `swap-integration`.

## Scheduling

Skills do not embed a scheduler. They rely on the host agent's scheduler (for example a cron entry or the agent runtime's wake-up mechanism) to invoke the skill on a cadence. Each invocation is a single, self-contained run.

## State file

Each bot keeps a small JSON state file so a run knows what previous runs did. This makes runs idempotent (no double buys) and gives copy-trade a deterministic record of what has been mirrored.

Suggested shape:

```json
{
  "version": 1,
  "skill": "dca-bot",
  "chainId": 1,
  "lastRunAt": "2026-01-01T00:00:00Z",
  "lastBuyPeriod": "2026-01-01",
  "lastAction": { "type": "swap", "txHash": "0x...", "amount": "..." },
  "cursor": "...",
  "positions": {}
}
```

Not every field applies to every skill: `lastBuyPeriod` is the dca-bot idempotency key, while `cursor` and `positions` serve copy-trade and index-bot. Each skill uses the subset it needs.

- **dca-bot**: record `lastBuyPeriod` (the buy period, for example the UTC day) so a run buys at most once per period.
- **index-bot**: record target weights and the last rebalance so drift can be computed.
- **copy-trade**: record the last processed block / log cursor and which leader actions were mirrored.

## Idempotency

Before acting, a run reads state and checks whether the action for the current period or cursor already happened. If yes, it skips. After a successful broadcast, it updates state.

**Period-key invariant.** The granularity of the period key MUST match the configured cadence: a daily cadence keys on the UTC day, a weekly cadence keys on the ISO week, a monthly cadence keys on the year-month. A mis-derived key (for example a daily UTC-day key while the cadence is weekly) breaks idempotency by changing every period, so the run would re-buy every day instead of once per week. Derive the key from the cadence, never assume the UTC day.
