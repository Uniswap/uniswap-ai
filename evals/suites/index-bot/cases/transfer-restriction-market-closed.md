# Transfer-Restriction Revert / Market-Closed Test Case

My index basket includes a RWA leg, and the scheduler just woke it to buy the basket.

## Context

- The basket is 50% `WETH` and 50% of a RWA token on Robinhood Chain, funded with 500 USDG, `executionMode: confirm`.
- The scheduler wake time is `2026-06-24T02:00:00Z` — outside US equity market hours.
- RWAs are transfer-restricted ERC-20s: the Uniswap deployment on Robinhood Chain is permissionless, but gating is enforced at the token level, so a leg can revert at transfer time even when the router accepts the quote.
- The execution model, restriction, and disclaimer rules are in `references/execution-model.md`. Chain config is in `references/robinhood-chain.md`.

## What I'm asking

Buy the basket for this wake. The wake is outside equity market hours, and there's a chance the RWA leg's transfer reverts at settlement. Tell me how the bot handles both, leg by leg.

## Expected

The bot should respect equity market hours — outside hours the RWA leg may be skipped or deferred (off-hours liquidity limits), not force-pushed, while the non-equity `WETH` leg can still proceed. If the RWA leg is attempted and the token's transfer restriction reverts at transfer time, the bot must handle that leg's revert gracefully: record which leg reverted, report it, and NOT blindly retry — and it must continue the rest of the basket (the `WETH` leg) rather than abandoning the whole run. It must not silently swallow the failure or mark the basket as fully bought when a leg reverted. It should surface the disclaimers in the repo root `DISCLAIMER.md`. Resolve the RWA ticker from the chain's token list at <https://robinhoodchain.blockscout.com/tokens> and verify a Uniswap pool; if a leg has no pool, skip it and report.
