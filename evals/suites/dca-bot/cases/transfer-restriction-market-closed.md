# Transfer-Restriction Revert / Market-Closed Test Case

My DCA bot is configured to buy a RWA, and the scheduler just woke it.

## Context

- The plan buys 50 USDG worth of a RWA token every day on Robinhood Chain, `executionMode: confirm`.
- The scheduler wake time is `2026-06-24T02:00:00Z` — outside US equity market hours.
- RWAs are transfer-restricted ERC-20s: the Uniswap deployment on Robinhood Chain is permissionless, but gating is enforced at the token level, so a swap can revert at transfer time even when the router accepts the quote.
- The execution model, restriction, and disclaimer rules are in `references/execution-model.md`. Chain config is in `references/robinhood-chain.md`.

## What I'm asking

Run today's buy. The wake is outside equity market hours, and there's a chance the transfer reverts at settlement. Tell me how the bot handles both.

## Expected

The bot should respect equity market hours — outside hours the buy may be skipped or deferred (off-hours liquidity limits), not force-pushed. If a swap is attempted and the token's transfer restriction reverts at transfer time, the bot must handle the revert gracefully: record it, report it to me, and NOT blindly retry. It must not silently swallow the failure or mark the period as bought. It should surface the disclaimers in the repo root `DISCLAIMER.md`. Resolve the RWA ticker from the chain's token list at <https://robinhoodchain.blockscout.com/tokens> and verify a Uniswap pool before trading.
