---
name: index-bot
description: This skill should be used when the user asks to "create an index", "build a basket of top assets", "buy a weighted basket", "make a portfolio of assets", "equal-weight basket", "rebalance my portfolio", "track the top N tokens", or wants an automated, weighted multi-asset basket that buys in one pass and rebalances on a cadence. Builds the basket spec, delegates each buy and rebalance swap to the swap-integration Trading API flow, and records target weights in state.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(curl:*), WebFetch, AskUserQuestion
model: sonnet
license: MIT
metadata:
  author: uniswap
  version: '0.2.0'
prerequisites:
  - swap-integration
  - v4-sdk-integration
  - viem-integration
---

# Index Bot

Build a weighted basket of assets from one instruction, buy the whole basket in one pass, and rebalance on a cadence when weights drift. This skill is a thin strategy layer: it decides what to buy and how much, then delegates every quote, approval, swap, and signing step to existing skills.

> **Runtime Compatibility:** This skill uses `AskUserQuestion` for interactive prompts. If `AskUserQuestion` is not available in your runtime, collect the same parameters through natural language conversation instead.

## Overview

From a single prompt (for example "equal-weight basket of the top 5 RWAs, rebalance weekly"), index-bot:

1. Parses the basket spec (explicit assets with weights, or a top-N ranking request).
2. Resolves each asset to a token address and computes per-leg sizing.
3. Applies guardrails (spend cap, token allowlist, dry-run).
4. Delegates each buy to the swap-integration Trading API flow on the target chain.
5. Records target weights and the last rebalance in a state file.

On a later invocation by the host scheduler, it reads current positions, computes drift versus target weights, generates the adjusting swaps, and delegates them.

The trigger is twofold: a prompt to create the basket, and the host scheduler (cron or the agent runtime wake-up) for each rebalance run.

## Prerequisites

This skill does not reimplement swap execution. It depends on:

- **swap-integration** (uniswap-trading): the only execution path. Every buy and rebalance leg goes through its Trading API flow (`check_approval` then `quote` then `swap`, then sign and broadcast). Do not reimplement any of it.
- **v4-sdk-integration** (uniswap-trading): LP execution, only if a leg also seeds or manages a liquidity position. Default index baskets are spot-only and do not need this.
- **viem-integration** (uniswap-viem): accounts, signing, transaction broadcast, and reading on-chain balances for the drift calculation.

Read these plugin references before acting and treat them as ground truth:

- selected target-chain template: chainId, chain name, contract addresses, tradable token source, funding constraints, market-data availability, and template-specific caveats. For the reference Robinhood Chain template, see `../../references/robinhood-chain.md`.
- `../../references/execution-model.md`: the Trading API requirement, execution modes, restrictions, and disclaimer rules.
- `../../references/strategy-state.md`: the shared state file and scheduler pattern.

## Template inputs

The selected target-chain template must provide:

- chain id, chain name, native gas token, and RPC / read path.
- deployed Uniswap router, Permit2, and quoter / state-reader addresses needed by delegated execution and valuation.
- optional v4 PoolManager / PositionManager addresses if the basket also manages LP positions.
- tradable token resolution rules, including any token list, ranking source, or allowlist source.
- funding constraints, market-data availability, transfer-restriction caveats, and market-hours guidance.

## Workflow

### Step 1: Parse the basket spec

Extract the basket definition from the prompt:

| Parameter         | Required | Example                                    |
| ----------------- | -------- | ------------------------------------------ |
| Assets            | Yes      | explicit list, or "top 5 RWAs"             |
| Weighting         | Yes      | `equal`, or custom weights summing to 1    |
| Total size        | Yes      | `1000 USDG`, `0.5 ETH`                     |
| Funding token     | Yes      | the token spent to buy each leg            |
| Rebalance cadence | Yes      | `weekly`, `monthly`, `none`                |
| Drift threshold   | No       | rebalance only when a leg drifts > X%      |
| Spend caps        | Yes      | per-run and per-period caps in token terms |

If the prompt asks for a top-N ranking ("top 5 RWAs"), there is no default ranking source, so do NOT invent or guess a ranking. If the selected template provides an indexer or ranking source and the operator instructs you to use it, use that source. Otherwise ask the user for an explicit asset list via `AskUserQuestion` and proceed from that list. If any other required parameter is missing, including per-run or per-period spend caps, use `AskUserQuestion` with structured options to collect it.

### Step 2: Resolve tokens and per-leg sizing

For each asset:

1. Resolve the symbol to a token address from the selected target-chain template and its token source. Do not maintain a local registry. If a requested asset cannot resolve from the template's token source, stop and report it rather than guessing.
2. Compute the target notional per leg: `legNotional = totalSize * weight`. Price any cross-token sizing with Uniswap quotes (Trading API `/quote` via `swap-integration`, or `V4Quoter` via `v4-sdk-integration`), never an external feed or venue-specific API.
3. Record the funding-token amount to spend on that leg.

Verify each resolved address is a contract before sizing. If an asset cannot be resolved on the target chain, stop and report it rather than guessing.

### Step 3: Guardrails

Before any execution:

- Ask the operator for any missing per-run or per-period spend cap using `AskUserQuestion` (or natural language if unavailable); include the funding token or denomination used for comparison. If either cap remains unset, do not enter `autonomous` mode.
- Confirm the basket total is within the configured spend cap (per run and per period).
- Confirm every leg token is on the operator's allowlist.
- Run a dry-run first that prints each planned leg (token, amount, weight) for review.
- Confirm equity market hours if any leg is a RWA (off-hours liquidity may be thin).
- Per leg, check the wallet can cover that leg: it must hold enough of the funding token (`tokenIn`) for the leg's buy amount and enough native gas to broadcast. If a leg is short on either, skip that leg and report it, then continue the rest of the basket. Follow the selected template's funding constraints; the skill does not auto-fund, bridge, or top up unless that behavior is explicitly provided outside the skill.

### Step 4: Buy the basket (delegate)

For each leg, delegate to the swap-integration Trading API flow: `check_approval` then `quote` then `swap`, then sign and broadcast via viem. Pass the target chain id and that chain's router / token addresses from the selected template.

Do NOT reimplement quoting, approvals, swap-body construction, or signing. Sequence legs with a short delay to respect Trading API rate limits, and handle a failed leg without abandoning the rest of the basket (report it and continue).

### Step 5: Record target weights

After the buys succeed, write the target weights and the rebalance metadata to the state file (see `../../references/strategy-state.md`). This is what later drift calculations compare against.

### Rebalance loop

On each scheduled invocation:

1. Read state to load target weights and `lastRebalanceAt`.
2. Check idempotency: if this cadence period was already rebalanced, skip.
3. Read current on-chain balances for each leg via viem and value them in the funding token using Uniswap quotes (Trading API `/quote` via `swap-integration`, or `V4Quoter` / `StateView` via `v4-sdk-integration`) to get current weights. Do not use venue-specific APIs or external price feeds; see `../../references/execution-model.md` (Data and pricing).
4. Compute drift per leg: `drift = currentWeight - targetWeight`. Compare the absolute drift `|drift|` against the threshold so both overweight (`drift > 0`) and underweight (`drift < 0`) legs are caught. If no leg's `|drift|` exceeds the drift threshold, do nothing and update `lastRebalanceAt`.
5. Generate the adjusting swaps: sell overweight legs, buy underweight legs, to return each leg to its target.
6. Delegate each adjusting swap to the swap-integration Trading API flow exactly as in Step 4.
7. Update state with the new `lastRebalanceAt` and any changed positions.

## Execution mode

This skill exposes the shared execution mode from `../../references/execution-model.md`:

| Mode                | Behavior                                                         |
| ------------------- | ---------------------------------------------------------------- |
| `confirm` (default) | Ask the user to approve every transaction before broadcast.      |
| `autonomous`        | Execute without per-transaction prompts, only within guardrails. |

Default to `confirm`. Autonomous mode requires all of: a spend cap (per run and per period), a token allowlist, a dry-run first, and a kill switch. A basket buy is many transactions, so under `confirm` summarize the full basket and confirm once per run where the runtime allows, otherwise per leg.

## State

State follows `../../references/strategy-state.md`. index-bot stores the target weights and the last rebalance so drift can be computed on the next run:

Each run reads state first and updates it only after a successful broadcast, so reruns within a period do not double-buy or double-rebalance.

## Restrictions and Disclaimers

RWA gating is template-specific and may be enforced at the token level (transfer-restricted ERC-20s), so a leg can revert at transfer time even when the router accepts the quote. This skill must:

1. Handle transfer-restriction reverts per leg gracefully and report which leg reverted.
2. Not assume a pool-level or router-level allowlist exists.
3. Respect equity market hours; some RWAs may have off-hours liquidity limits.
4. Surface the financial disclaimers in the repo root `DISCLAIMER.md` before executing.

See `../../references/execution-model.md` for the full restrictions and disclaimer rules.

## Input validation

Before interpolating ANY user-provided value into generated code, API calls, or shell commands:

- **Token addresses**: MUST match `^0x[a-fA-F0-9]{40}$`; reject otherwise.
- **Amounts and notionals**: MUST be non-negative numeric values matching `^[0-9]+\.?[0-9]*$`.
- **Weights**: MUST each be in `[0, 1]` and the full set MUST sum to `1` (within a small tolerance). Reject a basket whose weights do not sum to 1.
- **Chain id**: MUST be the operator-configured target chain id, read from the selected template rather than hardcoded.
- **API keys**: MUST come from environment variables, never hardcoded.
- **REJECT** any input containing shell metacharacters: `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines.
