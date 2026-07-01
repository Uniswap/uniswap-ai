---
name: dca-bot
description: This skill should be used when the user wants to "dca into" a token, "buy X every day", set up a "recurring buy", "dollar cost average" into an asset, "schedule a buy", or "auto-buy on a dip". Buys a fixed amount into a token on a schedule, optionally only when a condition holds (for example only when ETH is below a price threshold). The host agent's scheduler wakes the skill on a cadence; each wake is one self-contained run.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(curl:*), WebFetch, AskUserQuestion
model: sonnet
license: MIT
metadata:
  author: uniswap
  version: '0.2.0'
prerequisites:
  - swap-integration
  - viem-integration
---

# DCA Bot

Dollar-cost-average a fixed amount into a token on a schedule on the operator's target chain, optionally gated on a price condition such as "only buy when ETH is below a threshold".

> **Runtime Compatibility:** This skill uses `AskUserQuestion` for interactive prompts (mode selection, per-transaction confirmation). If `AskUserQuestion` is not available in your runtime, collect the same parameters and confirmations through natural language conversation instead.

## Overview

This is a thin strategy layer. It owns cadence, idempotency, the optional condition check, and guardrails. It does NOT own execution. Every quote, approval, swap, and signature is delegated to `swap-integration` and `viem-integration`. The skill never builds quote, approval, swap, or signing logic itself.

The skill does not run a scheduler. The host agent's scheduler (a cron entry or the runtime's wake mechanism) invokes the skill on a cadence. Each invocation is a single, self-contained run that reads state, decides whether to act, optionally acts, and writes state.

## Prerequisites

- **swap-integration** (uniswap-trading): the only execution path. All swaps go through its Trading API flow (`check_approval` then `quote` then `swap`, then sign and broadcast). Do not reimplement any of it.
- **viem-integration** (uniswap-viem): accounts, clients, signing, transaction broadcast, and receipt waiting.

Read these plugin references before acting and treat them as ground truth:

- selected target-chain template: chainId, chain name, contract addresses, tradable token source, funding constraints, market-data availability, and template-specific caveats. For the reference Robinhood Chain template, see `../../references/robinhood-chain.md`.
- `../../references/execution-model.md`: the Trading API requirement, execution modes, restrictions, and disclaimer rules.
- `../../references/strategy-state.md`: the shared state file and scheduler pattern.

## Template inputs

The selected target-chain template must provide:

- chain id, chain name, native gas token, and RPC / read path.
- deployed Uniswap router, Permit2, and quoter / state-reader addresses needed by delegated execution.
- tradable token resolution rules, including any token list or allowlist source.
- funding constraints and market-data availability.
- transfer-restriction caveats and market-hours guidance.

## Workflow

### Step 1: Read state

Read the bot's JSON state file (see [State](#state)). If it does not exist, treat this as the first run.

### Step 2: Check cadence and idempotency

Compute the current period from the configured cadence (for example the UTC day for a daily DCA). If the state file shows a successful buy already recorded for the current period, skip and exit. This makes repeated wakes within one period safe (no double buys).

### Step 3: Resolve token and amount

Resolve the target token to an address by reading the selected target-chain template and its token source. Resolve the fixed buy amount from config. Validate both before use (see [Input validation](#input-validation)). Do not maintain a local token registry; reuse the template-provided token list or resolver.

### Step 4: Collect guardrails

Read the configured guardrails. If the per-run spend cap or per-period spend cap is missing, ask the operator for those caps using `AskUserQuestion` (or natural language if unavailable); include the funding token or denomination used for comparison. If either cap remains unset, do not enter `autonomous` mode. In `confirm` mode, proceed only with the per-transaction confirmation gate and report that autonomous mode remains unavailable.

### Step 5: Optional condition check

If a condition is configured (for example "only when the last daily candle is red"), evaluate it before buying:

- Fetch the price needed for the condition from Uniswap: the Trading API `/quote` (via `swap-integration`). Do not use venue-specific APIs or non-Uniswap price feeds for execution data; see `../../references/execution-model.md` (Data and pricing). If the condition needs market data Uniswap does not expose, treat that data source as unavailable rather than adding an external dependency.
- Evaluate the predicate (for example `price < 3000 USDC`).
- If the condition is not met, record the evaluation, skip the buy, and exit. Skipping for an unmet condition is a normal outcome, not an error.

Be honest about what is satisfiable today. A price-threshold condition (for example "only buy when ETH is below X") works out of the box, because the current price comes from the Trading API `/quote`.

### Step 6: Guardrails

Before any spend, enforce the guardrails for the active execution mode (see [Execution mode](#execution-mode)): spend cap per run and per period, token allowlist, and the kill switch. If any guardrail blocks the buy, stop and report why.

Also check the wallet can cover the buy: it must hold enough of the funding token (`tokenIn`) for the buy amount and enough native gas to broadcast. If either is short, skip the buy and report it. Follow the selected template's funding constraints; the skill does not auto-fund, bridge, or top up unless that behavior is explicitly provided outside the skill.

### Step 7: Delegate the swap

Hand execution to the `swap-integration` Trading API flow. Pass the target chain id and that chain's router / token addresses from the selected template. The skill MUST NOT build quote, approval, swap, or signing logic of its own; it only supplies parameters (swapper, tokenIn, tokenOut, amount, chain id) and reads back the result.

If the selected template has RPC or raw-transaction constraints, treat them as template caveats. Skills always execute through the Trading API / router path regardless of chain, so router-compatible constraints should not block them.

### Step 8: Update state

On a successful broadcast, write the current period, timestamp, and the resulting transaction hash to the state file so the next wake is idempotent. On failure, record the error and leave the period unmarked so a later wake can retry.

## Execution mode

The operator who runs the agent chooses an execution mode. See `../../references/execution-model.md` for the full model.

| Mode                | Behavior                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirm` (default) | Ask the user to approve the transaction before broadcast via `AskUserQuestion`, showing token, amount, chain, and estimated gas. Reuses the `swap-integration` spend gate. |
| `autonomous`        | Execute without per-transaction prompts, only within guardrails.                                                                                                           |

Default to `confirm`. `autonomous` mode requires all of: a spend cap (per run and per period), a token allowlist, a dry-run first, and a kill switch. Without all four, fall back to `confirm`.

## State

Follow the shared pattern in `../../references/strategy-state.md`. The dca-bot keeps a small JSON state file so a run knows what previous runs did. Suggested shape:

- `lastBuyPeriod` is the idempotency key: a run buys at most once per period. Compare the current period against `lastBuyPeriod` before acting, and update it only after a confirmed broadcast.
- `lastAction` is the last action taken: a swap, or a skip due to a guardrail or condition. Record the action type, transaction hash, and amount.

## Restrictions and Disclaimers

RWA gating is template-specific and may be enforced at the token level (transfer-restricted ERC-20s), so a swap can revert at transfer time even when the router accepts it. See `../../references/execution-model.md`. The skill must:

1. Handle transfer-restriction reverts gracefully, record them, and report them rather than retrying blindly.
2. Respect the selected template's equity market-hours guidance; some RWAs may have off-hours liquidity limits, so a buy may be skipped or deferred outside hours.
3. Surface the financial disclaimers in the repo root `DISCLAIMER.md` to the operator.

## Input validation

Before interpolating ANY user-provided or config value into a command, API call, or generated code:

- **Token / wallet addresses**: MUST match `^0x[a-fA-F0-9]{40}$`; reject otherwise.
- **Amounts**: MUST be non-negative numeric values matching `^[0-9]+\.?[0-9]*$`.
- **Chain id**: MUST be the operator-configured target chain id, read from the selected template rather than hardcoded.
- **API keys**: MUST come from environment variables, never hardcoded.
- **REJECT** any input containing shell metacharacters: `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, or newlines.
