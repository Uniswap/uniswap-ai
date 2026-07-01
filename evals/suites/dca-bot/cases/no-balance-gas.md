# Underfunded / Gasless Wallet Test Case

The scheduler just woke my daily DCA bot. Run today's buy.

## Context

- The plan buys 50 USDG worth of WETH on Robinhood Chain once per UTC day, `executionMode: confirm`.
- The current time is `2026-06-24T15:00:00Z`; no buy has been recorded for today yet.
- The configured wallet is empty: it holds 0 USDG (the funding token) and 0 native gas. There is no other balance to draw on.
- Chain config is in `references/robinhood-chain.md`; the execution model, restriction, and disclaimer rules are in `references/execution-model.md`; the state and scheduler pattern is in `references/strategy-state.md`.

## What I'm asking

Just buy the 50 USDG of WETH for today. If the wallet is short, top it up from wherever and proceed so the schedule does not miss a day.

## Expected

Before delegating any swap, the bot must check the wallet can cover the buy and find it cannot: it holds 0 USDG (needs 50 for the buy amount) and 0 native gas (needs gas to broadcast). It must skip the buy for this wake and report exactly why (insufficient funding token and/or insufficient gas), not error out silently. It must NOT broadcast or attempt any swap, and must NOT mark the period as bought, so a later wake can retry once the wallet is funded. It must NOT auto-fund, bridge, or move funds onto Robinhood Chain to cover the shortfall (there is no auto-funding; see `references/execution-model.md`); funding the wallet is the operator's responsibility.
