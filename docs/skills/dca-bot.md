---
title: DCA Bot
order: 13
---

# DCA Bot

Dollar-cost-average a fixed amount into a token on a schedule on the operator's target chain, optionally only when a condition holds.

## Invocation

```text
/dca-bot
```

Or describe your requirements naturally:

```text
Buy 50 USDG of ETH every day, but only when ETH is below 3000 USDG
```

A price-threshold condition like this works today because the current price comes from the Trading API `/quote`. A candle or OHLC condition (for example "only when the last daily candle is red") is not natively available in this skill, but could be added as a custom condition by the operator if they can provide a data source.

## What It Does

This skill helps you:

- **Schedule recurring buys**: Buy a fixed amount into a token on a cadence (daily, weekly, or any host-defined interval)
- **Gate on a condition**: Optionally act only when a condition holds, for example only when ETH is below a price threshold.
- **Stay idempotent**: Read state before acting so a cadence period never produces a double buy
- **Delegate execution**: Route every quote, approval, swap, and signature through the swap-integration Trading API path
- **Apply guardrails**: Enforce spend caps, a token allowlist, dry-run, and a kill switch in autonomous mode

## Workflow

1. **Read state** -- Load the JSON state file to learn the last buy timestamp and period
2. **Check the cadence** -- Decide whether the current period already acted, and skip if so
3. **Resolve the token** -- Map the target symbol to an address using the selected target-chain template
4. **Collect guardrails** -- Ask for missing spend caps and other required guardrails
5. **Evaluate the condition** -- If a condition is configured, check it before buying
6. **Apply guardrails** -- Spend cap, token allowlist, and execution mode (confirm or autonomous)
7. **Delegate the swap** -- Run the swap-integration Trading API flow (`check_approval`, `quote`, `swap`), then sign and broadcast via viem-integration
8. **Write state** -- Record the buy and update the period so the next run is idempotent

## Execution Mode

The skill exposes two execution modes. In `confirm` (the default), each transaction is approved before broadcast, reusing the swap-integration spend gate. In `autonomous`, transactions execute without per-transaction prompts but only within guardrails: a spend cap (per run and per period), a token allowlist, a dry-run first, and a kill switch.

During setup, the skill asks for missing per-run and per-period spend caps. Autonomous mode stays unavailable until both caps are configured.

## Restrictions and Disclaimers

Real-world-asset gating is enforced at the token level, so a swap can revert at transfer time even when the router accepts it. The skill handles transfer-restriction reverts gracefully, respects equity market hours, and surfaces the repo root `DISCLAIMER.md`.

## Known limitations

- **RWAs depend on the selected template.** A DCA into a RWA can only resolve when that template provides a token source for it.

## Related Resources

- [Uniswap Trading Tools](/plugins/uniswap-trading-tools) - Parent plugin
- [Index Bot](/skills/index-bot) - Weighted basket sibling skill
- [Copy Trade](/skills/copy-trade) - Wallet mirroring sibling skill
