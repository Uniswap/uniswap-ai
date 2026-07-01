# Basic index-bot Test Case

Build a weighted basket on Robinhood Chain, buy it in one pass, and rebalance on a cadence when weights drift.

## Context

- The operator wants an RWA basket weighted 50% `AAAx`, 30% `BBBx`, 20% `ZZZx`, funded with 1000 USDG.
- The basket should rebalance weekly when any leg drifts more than 5% from its target weight.
- The host agent's scheduler wakes the skill: once to build the basket, then weekly to check drift.
- The plugin ships `references/robinhood-chain.md` (chain config, v4 PoolManager / PositionManager, and contract addresses) and `references/execution-model.md`. A JSON state file may already record target weights and the last rebalance.

## Requirements

1. Delegate every buy and rebalance trade to the swap-integration (uniswap-trading) Trading API flow (`check_approval`, then `quote`, then `swap`, then sign and broadcast via viem-integration). Do NOT reimplement quoting, approvals, swap calldata, routing, or signing. If LP is used, go through the v4 SDK integration rather than hand-rolling LP transactions.
2. Read the Robinhood Chain configuration (chainId 4663 and contract addresses) from the references rather than hardcoding values.
3. Support an `executionMode` of `confirm` (default, approve each leg) or `autonomous` (no per-transaction prompt, only within guardrails: spend cap, token allowlist, dry-run first, kill switch).
4. Use the JSON state file pattern: record target weights and the last rebalance, read them to compute drift, and write state only after successful broadcasts.
5. Parse the basket spec and compute per-leg sizing from the target weights and the 1000 USDG funding, then buy all legs in one pass.
6. On a weekly wake, compute drift versus recorded target weights and trade only the legs that exceed the 5% drift threshold. Validate inputs (each ticker resolves on 4663, weights sum to 100%) before any execution.

## Constraints

- One wake equals one self-contained run: read state, decide, optionally act, write state.
- RWA gating is enforced at the token level, so a leg can revert at transfer time even when the router accepts it. Handle transfer-restriction reverts gracefully and respect equity market hours.
- Surface the repo root `DISCLAIMER.md`.
- Do not assume a hosted indexer; sizing and pricing use the configured market-data and quote sources.

## Expected Output

A clear plan that parses the basket spec, resolves each ticker and computes per-leg sizing from target weights and funding, applies the chosen execution mode and guardrails, delegates each leg buy to the swap-integration Trading API flow, and records target weights plus the last rebalance in JSON state. On a rebalance wake it should compute drift from state and trade only the drifted legs. It should note restriction handling (transfer-restriction reverts, market hours, disclaimer) and the token source (resolve from the chain's token list at <https://robinhoodchain.blockscout.com/tokens>; verify a pool, never invent). It must not contain hand-rolled swap, quote, approval, signing, or LP transaction logic.
