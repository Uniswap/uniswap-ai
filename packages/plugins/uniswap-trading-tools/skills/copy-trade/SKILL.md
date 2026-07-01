---
name: copy-trade
description: This skill should be used when the user asks to "copy trades from" a wallet, "mirror a wallet", "follow this address", set up "copy trading", "track and replicate a trader", or mirror another account's swaps bounded by guardrails. Watches a target wallet and mirrors its trades, filtered by chain, asset match, position size, and the follower's own portfolio state.
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

# Copy Trade

Watch a target ("leader") wallet on the target chain and mirror its swaps into the follower's wallet, bounded by guardrails. This is a thin strategy layer: it decides what to mirror and whether to mirror it, then delegates the actual swap to `swap-integration` and `viem-integration`. The skill never builds quote, approval, swap, or signing logic itself.

> **Runtime Compatibility:** This skill uses `AskUserQuestion` for execution-mode and confirmation prompts. If `AskUserQuestion` is not available in your runtime, collect the same parameters and confirmations through natural language conversation instead.

## Overview

The host scheduler invokes this skill on a cadence (about every 5 minutes). Each invocation is a single, self-contained, deterministic run:

1. Read the stored cursor (last processed block).
2. Read the leader wallet's new on-chain actions since the cursor.
3. For each new action, apply guardrails.
4. For actions that pass, delegate the mirror swap to `swap-integration`.
5. Advance the cursor and record which leader actions were mirrored.

Treat this as a state machine, not free-form reasoning. Read state, diff against the chain, decide per action, act, advance the cursor. Do not infer intent beyond what the on-chain events say, and never re-derive a decision a prior run already recorded.

## Prerequisites

This skill delegates all infrastructure. It never reimplements quoting, approval, signing, or swap construction.

- **swap-integration** (uniswap-trading): the only execution path. Every mirror swap goes through its Trading API flow (`check_approval` then `quote` then `swap`, then sign and broadcast). Do not reimplement any of it.
- **viem-integration** (uniswap-viem): accounts, clients, signing, transaction broadcast, and reading the leader wallet's activity. Read the leader's transactions and receipts since the cursor block to detect swaps (see Step 2).

Read these plugin references before acting and treat them as ground truth:

- selected target-chain template: chainId, chain name, contract addresses, tradable token source, RPC / read path, indexing availability, funding constraints, and template-specific caveats. For the reference Robinhood Chain template, see `../../references/robinhood-chain.md`.
- `../../references/execution-model.md`: the Trading API requirement, execution modes, restrictions, and disclaimer rules.
- `../../references/strategy-state.md`: the shared state file and scheduler pattern.

## Template inputs

The selected target-chain template must provide:

- chain id, chain name, native gas token, and RPC / read path.
- deployed Uniswap router, Permit2, PoolManager, and v2/v3/v4 pool factory / reader addresses needed to decode leader activity.
- whether a public indexer exists; if not, the skill polls RPC and scans bounded block ranges.
- tradable token resolution rules, including any token list or allowlist source.
- funding constraints, transfer-restriction caveats, and market-hours guidance.

## Workflow (deterministic state machine)

### Step 1: Read state cursor

Load the JSON state file (shape in `strategy-state.md`). For copy-trade the relevant fields are the last processed cursor (block or log position) and the set of leader intents already mirrored (keyed at the transaction level by `leaderTxHash`, plus a sub-index when one tx yields more than one independent intent; see Step 2). If no state file exists, this is the first run: initialize the cursor to the current head block and mirror nothing on this pass (avoid replaying the leader's full history unless the operator explicitly opts in).

This first-run-at-head behavior is skill-specific, not template-specific. It prevents accidental history replay on any target chain.

### Step 2: Read leader actions since the cursor

Detect the leader's swaps by scanning the leader's own transactions, not by topic-filtering pool events on the leader address. The pool `Swap` events do not carry the leader EOA: v2 indexes `sender`/`to` and v3 indexes `recipient` (all of which are the router when the trade routes through UniversalRouter / SwapRouter02, not the leader), and v4 `Swap` indexes only `PoolId` and `sender` (the PoolManager's caller, again the router). A `getLogs` filter keyed on the leader address therefore returns nothing for router-routed trades. Instead:

1. Iterate blocks in the range `(cursor, head]` and select transactions where `tx.from` equals the leader. (Use viem's block/transaction reads via `viem-integration`; scan in bounded ranges to respect RPC limits.)
2. For each such transaction, fetch its receipt and decode the `Swap` logs it contains. A single leader transaction may emit one or more `Swap` logs (a multi-hop route emits one log per leg; a batch/multicall emits one log per independent swap). The protocol version is identified by the emitting contract: a v4 `Swap` is emitted by the `PoolManager`; v2/v3 `Swap` logs are emitted by individual pool contracts.
3. Resolve each pool to its token pair before deciding direction. v2/v3 `Swap` logs do not name the tokens -- read `token0()` / `token1()` on the emitting pool (or decode the v4 `PoolKey` from the `PoolId`) to learn the pair. The token addresses come from these reads plus the selected target-chain template; never invent them. Pool `Swap` logs always reference `WETH` (the ERC-20), never native `ETH`: a native-ETH leg is a router wrap/unwrap and emits no ERC-20 `Swap` event. Canonicalize any leg token that resolves to `WETH` as `WETH` here, and apply the ETH/WETH normalization rule in `execution-model.md` when matching against the allowlist (Step 3).
4. Determine in vs out from the amount signs, and mind that v3 and v4 use opposite sign conventions. v2 reports unsigned `amount0In/amount1In/amount0Out/amount1Out`; the non-zero `*In` token is `tokenIn`. v3 (`int256`) reports the pool's balance delta, so a positive amount is the token flowing into the pool (`tokenIn`) and a negative amount is the token flowing out (`tokenOut`). v4 (`int128`) reports the swapper's delta instead, which is inverted: a negative amount is the token the swapper paid in (`tokenIn`) and a positive amount is the token the swapper received (`tokenOut`). (v4's `Swap` NatSpec reuses v3's pool-balance wording, but the contract emits the swapper's signed `BalanceDelta`, verified against live v4 swaps; follow the swapper-delta convention.) After assigning direction, take `amountIn`/`amountOut` as the absolute values.

Now decode each leg into `{ tokenIn, tokenOut, amountIn, amountOut, leaderTxHash, logIndex, blockNumber }`. Within a single leader transaction, collapse legs that form one route before producing the actions to mirror:

- **Chain legs by matching `tokenOut` -> `tokenIn`.** A leg whose `tokenOut` equals the next leg's `tokenIn` (within the same tx, in `logIndex` order) is part of the same route. A maximal such chain collapses to a single net intent: `tokenIn` = first leg's `tokenIn`, `tokenOut` = last leg's `tokenOut`, `amountIn` = first leg's `amountIn`, `amountOut` = last leg's `amountOut`. Drop the intermediate legs. (Example: `USDG -> WETH -> AAAx` is two `Swap` logs that collapse to one intent `USDG -> AAAx`; mirroring both legs would wrongly buy the intermediate `WETH` and then spend it again.) If a collapsed chain returns to its starting token so the net `tokenIn` equals `tokenOut` (for example an arbitrage round-trip `USDG -> WETH -> USDG`), it is a net no-op: drop it and mirror nothing for that chain.
- **Independent swaps stay separate.** A transaction may instead be a batch / multicall whose legs do not chain (no leg's `tokenOut` feeds another leg's `tokenIn`). Those are independent swaps, not a route: each is its own net intent and is mirrored separately.

The result is one mirror intent per maximal chain (and one per independent leg). Key each resulting intent at the transaction level by `leaderTxHash`. When a single tx yields more than one independent intent, append a sub-index equal to the `logIndex` of that intent's first leg; `logIndex` is immutable per transaction, so the key is reproducible across re-scans and crash recovery, and a multi-hop route mirrors at most once. A tx that yields a single intent uses `leaderTxHash` alone. Sort the resulting intents by `(blockNumber, first-leg logIndex)` so processing is deterministic.

> **IMPORTANT: read activity according to the selected template.** If the template does not provide a public indexer, poll the RPC and scan logs directly against the deployed contracts. Scan in bounded block ranges to respect RPC `getLogs` limits, and persist the cursor every run so successive ranges normally do not overlap; the Step 3 idempotency guardrail (skip any `leaderTxHash` intent already mirrored) is what keeps an overlapping range safe when the cursor did not advance (e.g. after a crash).

### Step 3: Apply guardrails per action

Process each new action in order. Skip (do not mirror) any action that fails a guardrail, and record the skip reason. Guardrails:

Before processing actions, read configured guardrails. If the per-mirror, per-run, or per-period spend cap is missing, ask the operator for those caps using `AskUserQuestion` (or natural language if unavailable); include the funding token or denomination used for comparison. If any cap remains unset, do not enter `autonomous` mode. In `confirm` mode, proceed only with per-mirror confirmation and report that autonomous mode remains unavailable.

| Guardrail         | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chain filter      | Action must be on the selected target chain. Ignore anything else.                                                                                                                                                                                                                                                                                                                                                                                                |
| Asset match       | Both `tokenIn` and `tokenOut` must be in the operator's allowed token set (default: tradable tokens from the selected template). `ETH` and `WETH` are equivalent for this match: a leg decoded as `WETH` (pool logs always reference the ERC-20, per Step 2) satisfies an `ETH` or a `WETH` allowlist entry, so a WETH-decoded leg is never falsely skipped against an ETH entry. Apply the ETH/WETH normalization rule in `execution-model.md` before comparing. |
| Position-size cap | Mirror amount must not exceed the per-trade cap and the per-period spend cap. Scale or skip if over.                                                                                                                                                                                                                                                                                                                                                              |
| Follower balance  | The follower wallet must hold enough `tokenIn` (and gas) to execute. If not, skip and report.                                                                                                                                                                                                                                                                                                                                                                     |
| Idempotency       | If this intent's `leaderTxHash` (with its sub-index, if any) is already in the mirrored set, skip; never double-mirror. Keying at the transaction level means a multi-hop route mirrors at most once.                                                                                                                                                                                                                                                             |

Position sizing is operator-chosen: either a fixed notional per mirrored trade, or a proportion of the leader's amount, always clamped to the caps above. Never mirror more than the caps allow.

### Step 4: Delegate the mirror swap

For each intent that passes all guardrails, hand off to `swap-integration`. Pass the target chain id and token addresses from the selected template. The Trading API flow (`check_approval` then `quote` then `swap`) handles routing, approvals, Permit2, signing, and broadcast. This skill supplies only: `tokenIn`, `tokenOut`, the sized `amount`, the target chain id, and the follower's wallet. Do not reimplement quote, approval, swap, or signing logic. The execution form for an ETH/WETH leg (native `ETH` vs wrapped `WETH`, and any wrap/unwrap) is owned by the `swap-integration` Trading API path: do not assume the follower mirror must use the same form the leader used, and do not hand-roll a wrap/unwrap. Pass the canonicalized token and let the Trading API choose the form.

### Step 5: Advance cursor and record

Write state to disk immediately after each leader intent resolves -- do not batch the writes to the end of the run. As each intent resolves (broadcast confirmed, or recorded skip), append its `leaderTxHash` key (with sub-index, if any) to the mirrored (or skipped) set with the result and the follower tx hash, then persist. Advance the durable `cursor` only past intents whose records are already committed, so a partially processed range is never marked done. This per-intent write is the idempotency guarantee: if the run crashes mid-batch after a broadcast confirms, the record for that intent is already on disk, and the idempotency check in Step 3 skips it on the next wake. Batching the writes to run-exit would leave already-broadcast mirrors unrecorded on a mid-run crash and re-mirror them with real funds.

## Execution mode

Expose the execution mode from `execution-model.md`, chosen by the operator:

| Mode                | Behavior                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirm` (default) | Use `AskUserQuestion` to confirm each mirror swap before broadcast, showing tokens, sized amount, chain, and the leader action being mirrored. Reuses the swap-integration spend gate.       |
| `autonomous`        | Mirror without per-trade prompts, strictly within guardrails. Requires a per-run and per-period spend cap, a per-mirror notional cap, a token allowlist, a dry-run first, and a kill switch. |

Default to `confirm`. See `../../references/execution-model.md` for the full contract.

## State

State follows `../../references/strategy-state.md`. Copy-trade specifically stores:

- `cursor`: the last processed block / log position on the selected target chain.
- the set of mirrored leader intent keys (`leaderTxHash`, plus a sub-index when one tx yields more than one independent intent) with their outcomes.

This makes runs idempotent: a leader intent is mirrored at most once, even across restarts or overlapping scheduler wake-ups, and a multi-hop route (collapsed to one intent in Step 2) mirrors at most once rather than once per leg.

## Restrictions and Disclaimers

RWA gating is chain- and token-specific and may be enforced at the token level (transfer-restricted ERC-20s). Therefore:

1. A mirror swap can revert at transfer time even when the leader's identical trade succeeded (the follower may not be eligible to hold the asset). Handle transfer-restriction reverts gracefully, record the failure, and do not retry blindly.
2. Respect the selected template's equity market-hours guidance; some RWAs may have off-hours liquidity limits, so a buy may be skipped or deferred outside hours.
3. Surface the disclaimers in the repo root `DISCLAIMER.md`. Uniswap Labs does not provide investment advice or recommendations. Copy-trading replicates another wallet's transactions at the operator's sole direction; the operator is solely responsible for the strategy and for compliance with applicable law.

## Input validation

Before interpolating ANY operator-provided value into code, API calls, or shell commands:

- **Leader and follower wallet addresses, token addresses**: MUST match `^0x[a-fA-F0-9]{40}$`; reject otherwise.
- **Position caps and amounts**: MUST be non-negative numeric values matching `^[0-9]+\.?[0-9]*$`.
- **Chain id**: MUST be the operator-configured target chain id, read from the selected template rather than hardcoded.
- **API keys and private keys**: MUST come from environment variables, never hardcoded.
- **REJECT** any input containing shell metacharacters: `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, or newlines.
