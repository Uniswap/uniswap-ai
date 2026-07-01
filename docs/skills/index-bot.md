---
title: Index Bot
order: 14
---

# Index Bot

Build a weighted basket of assets from one instruction, buy the whole basket in one pass, and rebalance on a cadence when weights drift, on the operator's target chain.

## Invocation

```text
/index-bot
```

Or describe your requirements naturally:

```text
Equal-weight basket of ETH and USDG, rebalance weekly
```

Provide an explicit asset list. A "top N" ranking request (for example "top 5 RWAs") cannot be resolved automatically unless the operator provides a ranking source or indexer in the selected template and tells the skill to use it; otherwise the skill asks for an explicit list. See [Known limitations](#known-limitations).

## What It Does

This skill helps you:

- **Parse a basket spec**: Explicit assets with weights, or a top-N ranking request when the selected template provides a ranking source or indexer and the operator says to use it
- **Size each leg**: Resolve each asset to a token address and compute per-leg amounts from target weights
- **Buy in one pass**: Execute every leg of the basket through the swap-integration Trading API path
- **Rebalance on cadence**: Recompute drift from recorded target weights and trade only the legs that have drifted
- **Apply guardrails**: Enforce spend caps, a token allowlist, dry-run, and a kill switch in autonomous mode

## Workflow

The skill runs in two phases: building the basket on the first invocation, then a rebalance loop on each later scheduled wake.

### Build the basket

1. **Parse the basket spec** -- An explicit asset list with weights
2. **Resolve and size legs** -- Map each asset to an address and compute per-leg amounts
3. **Apply guardrails** -- Spend cap, token allowlist, and execution mode (confirm or autonomous)
4. **Delegate each buy** -- Run the swap-integration Trading API flow per leg, then sign and broadcast via viem-integration
5. **Write state** -- Record target weights and the last rebalance so future drift can be computed

### Rebalance loop (each scheduled wake)

1. **Read state** -- Load recorded target weights and the last rebalance
2. **Compute drift and trade the drifted legs** -- Value each leg, compare the absolute drift against the threshold, and delegate adjusting swaps only for the legs past it
3. **Write state** -- Update the last rebalance and any changed positions

## Liquidity Positions

Index Bot can optionally use the v4 SDK integration for LP positions, reading the target chain's v4 PoolManager / PositionManager addresses from the selected template. Execution still flows through the delegated path; the skill does not build its own LP transaction logic.

## Execution Mode

The skill exposes two execution modes. In `confirm` (the default), each transaction is approved before broadcast, reusing the swap-integration spend gate. In `autonomous`, transactions execute without per-transaction prompts but only within guardrails: a spend cap (per run and per period), a token allowlist, a dry-run first, and a kill switch.

During setup, the skill asks for missing per-run and per-period spend caps. Autonomous mode stays unavailable until both caps are configured.

## Restrictions and Disclaimers

Real-world-asset gating is enforced at the token level, so a swap can revert at transfer time even when the router accepts it. The skill handles transfer-restriction reverts gracefully, respects equity market hours, and surfaces the repo root `DISCLAIMER.md`.

## Known limitations

- **Top-N ranking needs a source.** The skill will not invent a ranking. Provide an explicit asset list with weights, or configure a ranking source or indexer in the selected template and tell the skill to use it.
- **RWAs depend on the selected template.** An asset that cannot resolve from the template's token source stops the basket with a report rather than a guess.

## Related Resources

- [Uniswap Trading Tools](/plugins/uniswap-trading-tools) - Parent plugin
- [DCA Bot](/skills/dca-bot) - Recurring buy sibling skill
- [Copy Trade](/skills/copy-trade) - Wallet mirroring sibling skill
