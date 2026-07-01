---
title: Copy Trade
order: 15
---

# Copy Trade

Watch a target ("leader") wallet on the target chain and mirror its swaps into the follower's wallet, bounded by guardrails.

## Invocation

```text
/copy-trade
```

Or describe your requirements naturally:

```text
Mirror swaps from 0xabc... into my wallet, cap each mirror at 100 USDG
```

## What It Does

This skill helps you:

- **Watch a leader wallet**: Read the leader's new on-chain swaps since the last processed cursor
- **Mirror net intent**: For a multi-hop leader trade, mirror the net intent (first-leg token in, last-leg token out), not each individual hop
- **Apply guardrails**: Filter by chain, asset match (ETH and WETH count as the same asset), position size, and the follower's own portfolio state
- **Mirror passing trades**: Delegate each approved mirror swap to the swap-integration Trading API path
- **Stay deterministic**: Advance a cursor and record which leader actions were mirrored, so no action is mirrored twice
- **Respect execution mode**: Confirm each mirror, or run autonomously within guardrails

## Workflow

1. **Read the cursor** -- Load the stored last processed block or log position from state. On the first run the cursor starts at the current head block, so no prior history is replayed unless you explicitly opt in
2. **Read leader actions** -- Scan the leader's transactions since the cursor and decode their swaps, collapsing a multi-hop route into one net intent (first-leg in, last-leg out)
3. **Apply guardrails** -- Chain filter, asset match (ETH and WETH treated as equivalent), position size, and the follower's portfolio state
4. **Delegate passing mirrors** -- Hand each mirror to the swap-integration Trading API flow (`check_approval`, `quote`, `swap`), which handles routing, approvals, signing, and broadcast
5. **Advance the cursor** -- Record the new cursor and which leader actions were mirrored

## Chain reads and indexing

Copy Trade reads leader activity according to the selected target-chain template. If the template provides no public hosted indexer, the skill polls RPC and scans logs to read the leader's recent actions, anchored on the stored cursor. The host scheduler invokes the skill on a cadence (about every five minutes); each invocation is a single, self-contained, deterministic run.

## Execution Mode

The skill exposes two execution modes. In `confirm` (the default), each mirror is approved before broadcast, reusing the swap-integration spend gate. In `autonomous`, mirrors execute without per-transaction prompts but only within guardrails: a spend cap (per run and per period), a per-mirror notional cap, a token allowlist, a dry-run first, and a kill switch.

During setup, the skill asks for missing per-mirror, per-run, and per-period spend caps. Autonomous mode stays unavailable until all three caps are configured.

## Restrictions and Disclaimers

Real-world-asset gating is enforced at the token level, so a mirror swap can revert at transfer time even when the router accepts it. The skill handles transfer-restriction reverts gracefully, respects equity market hours, and surfaces the repo root `DISCLAIMER.md`.

## Known limitations

- **No history backfill on the first run.** The first run sets the cursor to the current head block and mirrors nothing on that pass, so a leader's past trades are not replayed. Replaying history is only done if you explicitly opt in.
- **Multi-hop trades mirror as net intent.** A leader route like `USDG -> WETH -> AAAx` is collapsed to one intent (`USDG -> AAAx`) and mirrored once, not as each hop. Mirroring every hop would wrongly buy and then re-spend the intermediate token. Independent swaps batched in one transaction stay separate and are each mirrored separately.
- **ETH and WETH are the same asset for matching.** Pool logs always reference WETH (the ERC-20), so a leader's ETH leg is matched and mirrored as WETH. An allowlist entry for either ETH or WETH satisfies the match; the Trading API path owns whether the mirror settles in native ETH or WETH.
- **Limited to Uniswap swaps.** This skill supports the decoding of swaps by the leader only when they were executed through Uniswap protocols. Swaps executed through other protocols are not supported.

## Related Resources

- [Uniswap Trading Tools](/plugins/uniswap-trading-tools) - Parent plugin
- [DCA Bot](/skills/dca-bot) - Recurring buy sibling skill
- [Index Bot](/skills/index-bot) - Weighted basket sibling skill
