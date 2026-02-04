---
name: liquidity-planner
description: This skill should be used when the user asks to "provide liquidity", "create LP position", "add liquidity to pool", "become a liquidity provider", "create V3 position", "create V4 position", "concentrated liquidity", "set price range", or mentions providing liquidity, LP positions, or liquidity pools on Uniswap. Generates deep links to create positions in the Uniswap interface.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), Bash(xdg-open:*), Bash(open:*), WebFetch, WebSearch, Task(subagent_type:Explore)
model: sonnet
---

# Liquidity Position Planning

Plan and generate deep links for creating liquidity positions on Uniswap V2, V3, and V4.

## Overview

Plan liquidity positions by:

1. Gathering LP intent (token pair, amount, version)
2. Checking current pool price and liquidity
3. Suggesting price ranges based on current price
4. Generating a deep link that opens in the Uniswap interface with parameters pre-filled

The generated link opens Uniswap with all parameters ready for position creation.

## Workflow

### Step 1: Gather LP Intent

Extract from the user's request:

| Parameter | Required | Default | Example |
|-----------|----------|---------|---------|
| Token A | Yes | - | ETH, USDC, address |
| Token B | Yes | - | USDC, WBTC, address |
| Amount | Yes | - | 1 ETH, $1000 |
| Chain | No | Ethereum | Base, Arbitrum |
| Version | No | V3 | V2, V3, V4 |
| Fee Tier | No | Auto | 0.05%, 0.3%, 1% |
| Price Range | No | Suggest | Full range, ±5%, custom |

If token pair is missing, ask the user to specify.

### Step 2: Resolve Token Addresses

Resolve token symbols to addresses. See `references/chains.md` for common tokens by chain.

For unknown tokens, use web search and verify on-chain.

### Step 3: Check Current Pool State

For V3/V4 positions, check the current pool price to suggest ranges:

```bash
# Get current price from pool (simplified)
# In practice, query the pool contract or use web search for current price
```

Alternatively, use web search: `"{tokenA} {tokenB} price"` to get approximate current price.

### Step 4: Suggest Price Ranges

Based on current price, suggest range options:

| Range Type | Description | Risk/Reward |
|------------|-------------|-------------|
| Full Range | Entire price spectrum | Lower fees, no rebalancing needed |
| ±50% | Wide range around current price | Moderate fees, rarely out of range |
| ±20% | Medium range | Higher fees, occasional rebalancing |
| ±10% | Tight range | Highest fees, frequent rebalancing |
| ±5% | Very tight | Maximum fees, constant monitoring |

**Recommendation logic:**

- Stablecoin pairs (USDC/USDT): Suggest tight range (±1-2%)
- Correlated pairs (ETH/stETH): Suggest tight range (±2-5%)
- Major pairs (ETH/USDC): Suggest medium range (±10-20%)
- Volatile pairs: Suggest wide range (±30-50%) or full range
- New/uncertain: Suggest full range

Present options to user and let them choose.

### Step 5: Determine Fee Tier

**V3 Fee Tiers:**

| Fee | Best For |
|-----|----------|
| 0.01% (100) | Stablecoin pairs |
| 0.05% (500) | Correlated pairs |
| 0.30% (3000) | Most pairs (default) |
| 1.00% (10000) | Exotic/volatile pairs |

**V4 Fee Tiers:** Dynamic fees possible with hooks. Default to similar V3 tiers.

### Step 6: Generate Deep Link

Construct the Uniswap position creation URL:

**Base URL:** `https://app.uniswap.org/positions/create`

**URL Parameters:**

| Parameter | Description | Format |
|-----------|-------------|--------|
| `chain` | Network name | `ethereum`, `base`, etc. |
| `currencyA` | First token | Address or `NATIVE` |
| `currencyB` | Second token | Address or `NATIVE` |
| `priceRangeState` | Range configuration | JSON (encode quotes only) |
| `depositState` | Deposit amounts | JSON (encode quotes only) |
| `fee` | Fee tier configuration | JSON (encode quotes only) |
| `hook` | V4 hook address (optional) | Address or `undefined` |
| `step` | Flow step | `1` (for create) |

**IMPORTANT: URL Encoding**

Only encode the double quotes (`"` → `%22`) in JSON values. Do NOT encode braces `{}` or colons `:`.

**priceRangeState JSON structure:**

For full range:

```json
{"priceInverted":false,"fullRange":true,"minPrice":"","maxPrice":"","initialPrice":"","inputMode":"price"}
```

For custom range:

```json
{"priceInverted":false,"fullRange":false,"minPrice":"2800","maxPrice":"3600","initialPrice":"","inputMode":"price"}
```

**depositState JSON structure:**

```json
{"exactField":"TOKEN0","exactAmounts":{"TOKEN0":"1.0"}}
```

Note: Use `TOKEN0` for currencyA, `TOKEN1` for currencyB.

**fee JSON structure:**

```json
{"feeAmount":3000,"tickSpacing":60,"isDynamic":false}
```

**Tick spacing by fee:**

| Fee | Tick Spacing |
|-----|--------------|
| 100 (0.01%) | 1 |
| 500 (0.05%) | 10 |
| 3000 (0.30%) | 60 |
| 10000 (1.00%) | 200 |

### Step 7: Present Output and Open Browser

Format the response with:

1. **Summary** of the position parameters
2. **Price range** visualization (if not full range)
3. **Considerations** about IL and management
4. **Open the browser** automatically using system command

**Example output format:**

```markdown
## Liquidity Position Summary

| Parameter | Value |
|-----------|-------|
| Pair | ETH / USDC |
| Chain | Base |
| Version | V3 |
| Fee Tier | 0.30% |
| Deposit | 1 ETH + equivalent USDC |

### Price Range

| Metric | Value |
|--------|-------|
| Current Price | ~3,200 USDC per ETH |
| Min Price | 2,800 USDC per ETH |
| Max Price | 3,600 USDC per ETH |
| Range Width | ±12.5% |

### Considerations

- **Impermanent Loss**: If ETH moves outside your range, you'll hold 100% of one asset
- **Rebalancing**: Monitor position and adjust range if price moves significantly
- **Fee Earnings**: Tighter ranges earn more fees but require more active management
- **Gas Costs**: Creating and managing positions costs gas

Opening Uniswap in your browser...
```

**After displaying the summary, open the URL in the browser:**

```bash
# Linux - note: only quotes are encoded (%22), not braces or colons
xdg-open "https://app.uniswap.org/positions/create?currencyA=NATIVE&currencyB=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&chain=base&fee={%22feeAmount%22:3000,%22tickSpacing%22:60,%22isDynamic%22:false}&priceRangeState={%22priceInverted%22:false,%22fullRange%22:false,%22minPrice%22:%222800%22,%22maxPrice%22:%223600%22,%22initialPrice%22:%22%22,%22inputMode%22:%22price%22}&depositState={%22exactField%22:%22TOKEN0%22,%22exactAmounts%22:{%22TOKEN0%22:%221%22}}&step=1"

# macOS
open "https://app.uniswap.org/positions/create?..."
```

Always open the browser after presenting the summary so users can review and create the position.

## Version Selection

For detailed version comparison (V2/V3/V4 differences, fee tiers, tick spacing), see `references/position-types.md`.

**Quick Guide:**

- **V2**: Full range only, simplest, lowest gas
- **V3**: Concentrated liquidity, most common choice
- **V4**: Advanced features with hooks, limited availability

## Important Considerations

### Impermanent Loss (IL)

Warn users about IL risk:

- IL occurs when token prices diverge from entry price
- Tighter ranges amplify IL but also fee earnings
- Full range minimizes IL but reduces fee efficiency

### Position Management

Concentrated liquidity requires active management:

- Monitor if price stays in range
- Rebalance when price approaches range boundaries
- Consider gas costs for position adjustments

### Capital Requirements

For V3 positions with custom range:

- Depositing single-sided is possible if current price is outside range
- Within range: both tokens required in ratio determined by price and range

## Supported Chains

All Uniswap-supported chains - see `references/position-types.md` for version availability by chain.

## Additional Resources

### Reference Files

- **`references/chains.md`** - Chain configuration and token addresses (shared with swap-planner)
- **`references/position-types.md`** - V2/V3/V4 differences, fee tiers, tick spacing

### URL Encoding

JSON parameters must be URL-encoded. In the deep link:

```text
?priceRange=%7B%22fullRange%22%3Atrue%7D
```

Decodes to:

```json
{"fullRange":true}
```
