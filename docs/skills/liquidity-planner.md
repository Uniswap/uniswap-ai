---
title: Liquidity Planner
order: 9
---

# Liquidity Planner

Plan liquidity positions and generate deep links that open directly in the Uniswap interface with parameters pre-filled. Supports V2, V3, and V4 positions.

## Invocation

```text
/liquidity-planner
```

Or describe your requirements naturally:

```text
Create a concentrated liquidity position for ETH/USDC on Base
```

## What It Does

This skill helps you:

- **Plan LP positions**: Gather intent, discover available pools, and assess liquidity depth
- **Suggest price ranges**: Context-aware recommendations based on pair type (stablecoin, major, volatile)
- **Compare fee tiers**: APY and volume data across different fee tiers for the same pair
- **Generate deep links**: URLs that open Uniswap's position creation page with all parameters pre-filled
- **Warn about risks**: Impermanent loss, thin liquidity, and active management requirements

## Workflow

1. **Gather LP intent** -- Token pair, amount, chain, version, fee tier, and price range
2. **Resolve token addresses** -- Map symbols to on-chain addresses per chain
3. **Discover pools** -- Find available Uniswap pools and fee tiers via DexScreener
4. **Assess liquidity** -- Evaluate pool TVL and warn about thin liquidity
5. **Fetch pool metrics** -- APY, volume, and price data from DefiLlama and DexScreener
6. **Suggest price ranges** -- Recommendations based on pair type and current price
7. **Determine fee tier** -- Compare tiers using APY and volume data
8. **Generate deep link** -- Uniswap position creation URL with pre-filled parameters
9. **Open browser** -- Automatically opens the link (with fallback for headless environments)

## Supported Position Types

| Version | Liquidity Type         | Key Feature                       |
| ------- | ---------------------- | --------------------------------- |
| V2      | Full range only        | Simplest, lowest gas              |
| V3      | Concentrated liquidity | Most common, customizable ranges  |
| V4      | Concentrated + hooks   | Advanced features, limited chains |

## Fee Tier Guidelines

| Fee   | Best For                     |
| ----- | ---------------------------- |
| 0.01% | Stablecoin pairs             |
| 0.05% | Correlated pairs (ETH/stETH) |
| 0.30% | Most pairs (default)         |
| 1.00% | Exotic/volatile pairs        |

## Output Format

The skill presents a position summary with pool analytics (APY, volume, TVL), price range details, and considerations about impermanent loss and rebalancing, followed by a clickable deep link to the Uniswap interface.

## Related Resources

- [Uniswap Driver Plugin](/plugins/uniswap-driver) - Parent plugin
- [Swap Planner](/skills/swap-planner) - Plan token swaps instead of LP positions
- [Uniswap Interface](https://app.uniswap.org) - Where deep links open
