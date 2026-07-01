# Basic dca-bot Test Case

Set up a conditional dollar-cost-averaging plan on Robinhood Chain that one scheduler wake can run idempotently.

## Context

- The operator wants to buy 50 USDG worth of WETH into their wallet every day.
- The buy should only happen when a condition holds: the last completed daily candle for the asset is red (close below open).
- The host agent's scheduler wakes the skill once per day. There is no in-skill scheduler.
- The plugin ships `references/robinhood-chain.md` (chain config and contract addresses) and `references/execution-model.md` (execution, restriction, and disclaimer rules). A JSON state file from a prior run may already exist.

## Requirements

1. Delegate all execution to the swap-integration (uniswap-trading) Trading API flow (`check_approval`, then `quote`, then `swap`, then sign and broadcast via viem-integration). Do NOT reimplement quoting, approvals, swap calldata, routing, or signing.
2. Read the Robinhood Chain configuration (chainId 4663 and contract addresses) from the references rather than hardcoding values.
3. Support an `executionMode` of `confirm` (default, approve each transaction) or `autonomous` (no per-transaction prompt, only within guardrails: spend cap, token allowlist, dry-run first, kill switch).
4. Use the JSON state file pattern: read state at the start, check whether the current daily period already bought (idempotency, no double buy), and write state only after a successful broadcast.
5. Evaluate the cadence and the red-candle condition before acting, and skip the run cleanly when the period already acted or the condition does not hold.
6. Validate inputs (token resolves on 4663, amount and cadence are well formed) before any execution.

## Constraints

- One wake equals one self-contained run: read state, decide, optionally act, write state.
- RWA gating is enforced at the token level, so a swap can revert at transfer time even when the router accepts it. Handle transfer-restriction reverts gracefully and respect equity market hours.
- Surface the repo root `DISCLAIMER.md`.
- Do not assume a hosted indexer; price and candle data come from the configured market-data source. If Uniswap does not expose historical daily candles, treat that data source as unavailable rather than adding an external dependency.

## Expected Output

A clear run plan that reads state, checks the daily cadence and the red-candle condition, resolves WETH and the USDG spend token via the references, applies the chosen execution mode and guardrails, delegates the buy to the swap-integration Trading API flow, then updates the JSON state. It should note restriction handling (transfer-restriction reverts, market hours, disclaimer) the token source (resolve token addresses from the chain's token list at <https://robinhoodchain.blockscout.com/tokens>; verify a pool, never invent), and the historical-candle data source (Uniswap does not expose OHLC candles). It must not contain hand-rolled swap, quote, approval, or signing logic, and must not invent token or contract addresses.
