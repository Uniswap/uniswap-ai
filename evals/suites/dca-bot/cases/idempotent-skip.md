# Idempotent Skip Test Case

The scheduler just woke my daily DCA bot for the second time today. Run it.

## Context

- The plan buys 50 USDG worth of WETH on Robinhood Chain once per UTC day, `executionMode: confirm`.
- The current time is `2026-06-24T18:00:00Z`.
- The bot's JSON state file already exists and contains:

```json
{
  "version": 1,
  "skill": "dca-bot",
  "chainId": 4663,
  "lastRunAt": "2026-06-24T13:30:00Z",
  "lastBuyPeriod": "2026-06-24",
  "lastAction": { "type": "swap", "txHash": "0xabc123", "amount": "50" }
}
```

- Chain config is in `references/robinhood-chain.md`; the state and scheduler pattern is in `references/strategy-state.md`.

## What I'm asking

Run the bot for this wake. Tell me what it does.

## Expected

The bot should read state, compute the current period (`2026-06-24`), see that `lastBuyPeriod` already equals the current period, and skip cleanly without buying again. It must NOT broadcast a second buy for today (no double spend) and must NOT overwrite the recorded buy. It should explain that the period was already acted on and exit.
