# uniswap-driver

AI-powered assistance for planning Uniswap swaps and liquidity positions, generating deep links to execute in the Uniswap interface.

## Overview

This plugin helps users research and plan Uniswap operations, then generates deep links that open directly in the Uniswap web interface with pre-filled parameters. This "plan then execute" approach is safer and more transparent than autonomous transaction execution.

## Skills

### swap-planner

Plan token swaps across any Uniswap-supported chain. The skill:

- Understands your swap intent (tokens, amounts, chain)
- Verifies token contracts on-chain
- Researches tokens via web search when needed
- Generates a deep link to execute the swap in the Uniswap interface

**Trigger phrases**: "swap ETH for USDC", "trade tokens", "exchange on Uniswap", "buy WBTC with USDC"

### liquidity-planner

Plan liquidity positions for Uniswap V2, V3, or V4 pools. The skill:

- Understands your LP intent (token pair, amount, version)
- Checks current pool price and liquidity
- Suggests price ranges based on current price
- Generates a deep link to create the position in the Uniswap interface

**Trigger phrases**: "provide liquidity", "create LP position", "add liquidity to pool", "become a liquidity provider"

## Supported Chains

All chains supported by the Uniswap interface:

- Ethereum Mainnet
- Base
- Arbitrum One
- Optimism
- Polygon
- BNB Chain
- Avalanche
- Celo
- Blast
- Zora
- World Chain

## How It Works

1. **You describe your intent** - "I want to swap 1 ETH for USDC on Base"
2. **AI researches and plans** - Verifies contracts, checks liquidity, identifies risks
3. **AI generates deep link** - Creates a URL with all parameters pre-filled
4. **You execute** - Click the link to open Uniswap with everything ready to go

## Installation

```bash
# From the uniswap-ai marketplace
/plugin marketplace add Uniswap/uniswap-ai
/plugin install uniswap-driver@uniswap-ai
```

## Data Sources

- **On-chain**: Token contract verification via RPC
- **Web search**: Market data, news, risk assessment

## Future Enhancements

- Token research skill for deeper analysis
- API integration (Uniswap GraphQL, CoinGecko)
- Cross-chain swap support
- Historical volatility analysis for range suggestions
