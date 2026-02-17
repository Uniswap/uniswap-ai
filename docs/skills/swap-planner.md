---
title: Swap Planner
order: 8
---

# Swap Planner

Plan token swaps and generate deep links that open directly in the Uniswap interface with parameters pre-filled.

## Invocation

```text
/swap-planner
```

Or describe your requirements naturally:

```text
Swap 1 ETH for USDC on Base
```

## What It Does

This skill helps you:

- **Plan swaps**: Gather intent, resolve token addresses, and verify contracts on-chain
- **Discover tokens**: Search by keyword, check promoted tokens, or research trending tokens via web search
- **Fetch price data**: Current prices and pool liquidity from DexScreener
- **Generate deep links**: URLs that open Uniswap with all swap parameters pre-filled
- **Assess risk**: Liquidity warnings and risk evaluation for trending or unfamiliar tokens

## Workflow

1. **Gather swap intent** -- Input token, output token, amount, and chain
2. **Resolve token addresses** -- Map symbols to on-chain addresses per chain
3. **Verify contracts** -- Confirm token contracts exist via RPC
4. **Research if needed** -- Web search for unfamiliar tokens
5. **Fetch price data** -- Current rates and pool liquidity
6. **Generate deep link** -- Uniswap URL with pre-filled parameters
7. **Open browser** -- Automatically opens the link (with fallback for headless environments)

## Token Discovery

For exploratory requests like "find me a memecoin on Base", the skill supports:

- **Keyword search** via DexScreener API
- **Promoted token lookup** for boosted tokens
- **Web search and verification** for broader discovery
- **Risk assessment** based on market cap, pool TVL, volume, and contract age

## Output Format

The skill presents a swap summary table with estimated output, pool liquidity, and risk notes, followed by a clickable deep link to the Uniswap interface.

## Supported Chains

Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche, Celo, Blast, Zora, World Chain, and Unichain.

## Related Resources

- [Uniswap Driver Plugin](/plugins/uniswap-driver) - Parent plugin
- [Liquidity Planner](/skills/liquidity-planner) - Plan LP positions instead of swaps
- [Uniswap Interface](https://app.uniswap.org) - Where deep links open
