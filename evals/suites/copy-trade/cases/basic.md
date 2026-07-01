# Basic copy-trade Test Case

Mirror a leader wallet's swaps on Robinhood Chain within guardrails, using a cursor and RPC polling.

## Context

- The operator wants to mirror swaps from leader wallet `0x1111111111111111111111111111111111111111` into the follower's wallet.
- Guardrails: only chainId 4663, only assets on the follower's allowlist (`WETH`, `USDG`, `ETH`), and cap each mirror at 100 USDG of notional.
- The host agent's scheduler wakes the skill about every five minutes. There is no in-skill scheduler.
- The skill polls the RPC and scans logs anchored on a stored cursor, per the selected template.
- The plugin ships `references/robinhood-chain.md` (chain config and contract addresses) and `references/execution-model.md`. A JSON state file may already record the cursor and which leader actions were mirrored.

## Requirements

1. Delegate every mirror swap to the swap-integration (uniswap-trading) Trading API flow (`check_approval`, then `quote`, then `swap`, then sign and broadcast via viem-integration). Do NOT reimplement quoting, approvals, swap calldata, routing, or signing.
2. Read the Robinhood Chain configuration (chainId 4663 and contract addresses) from the references rather than hardcoding values.
3. Support an `executionMode` of `confirm` (default, approve each mirror) or `autonomous` (no per-transaction prompt, only within guardrails: spend cap, token allowlist, dry-run first, kill switch).
4. Use the JSON state file pattern: read the stored cursor (last processed block or log position) and the set of already-mirrored leader actions, and write state immediately after each action resolves (broadcast confirmed or skip recorded) rather than batching to run-exit, so no action is mirrored twice even across a mid-run crash.
5. Poll the RPC and scan logs since the cursor to read the leader's new actions. Detect leader swaps by scanning transactions where `tx.from` is the leader (not by topic-filtering pool events on the leader address), decode the `Swap` logs in each receipt, resolve pools to token pairs, and read direction from the amount signs. Advance the cursor at the end of the run.
6. Apply the guardrails (chain filter, asset allowlist match, per-mirror position size cap) and the follower's portfolio state before delegating, and skip actions that fail any guardrail. Validate inputs (leader address, allowlist tokens resolve on 4663) before any execution.

## Constraints

- One wake equals one self-contained, deterministic run: read cursor, read new leader actions, filter, optionally mirror, advance cursor.
- RWA gating is enforced at the token level, so a mirror can revert at transfer time even when the router accepts it. Handle transfer-restriction reverts gracefully and respect equity market hours.
- Surface the repo root `DISCLAIMER.md`.

## Expected Output

A clear plan that reads the stored cursor and mirrored-action set from JSON state, polls the RPC and scans logs for the leader's new swaps since the cursor (by scanning the leader's own transactions, decoding `Swap` logs, resolving pools to token pairs, and reading direction from amount signs), applies the chain, asset, and position-size guardrails plus the follower's portfolio state, delegates each passing mirror to the swap-integration Trading API flow, and advances the cursor. It should explicitly note that v1 reads leader activity via RPC polling and log scanning, restriction handling (transfer-restriction reverts, market hours, disclaimer), and the token source (resolve token addresses from the chain's token list at <https://robinhoodchain.blockscout.com/tokens>; verify a Uniswap pool before trading and never invent addresses). It must not contain hand-rolled swap, quote, approval, or signing logic.
