---
name: liquidity-planner
description: This skill should be used when the user asks to "provide liquidity", "create LP position", "add liquidity to pool", "become a liquidity provider", "create v3 position", "create v4 position", "concentrated liquidity", "set price range", or mentions providing liquidity, LP positions, or liquidity pools on Uniswap. Generates deep links to create positions in the Uniswap interface.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), Bash(xdg-open:*), Bash(open:*), WebFetch, WebSearch, Task(subagent_type:Explore), AskUserQuestion
model: sonnet
license: MIT
metadata:
  author: uniswap
  version: '0.2.0'
---

# Liquidity Position Planning

Plan and generate deep links for creating liquidity positions on Uniswap v2, v3, and v4.

> **Runtime Compatibility:** This skill uses `AskUserQuestion` for interactive prompts. If `AskUserQuestion` is not available in your runtime, collect the same parameters through natural language conversation instead.

## Overview

Plan liquidity positions by:

1. Gathering LP intent (token pair, amount, version)
2. Checking current pool price and liquidity
3. Suggesting price ranges based on current price
4. Generating a deep link that opens in the Uniswap interface with parameters pre-filled

The generated link opens Uniswap with all parameters ready for position creation.

> **Note:** Browser opening (`xdg-open`/`open`) may fail in SSH, containerized, or headless environments. Always display the URL prominently so users can copy and access it manually if needed.

## Workflow

### Step 1: Gather LP Intent

Extract from the user's request:

| Parameter   | Required | Default  | Example                 |
| ----------- | -------- | -------- | ----------------------- |
| Token A     | Yes      | -        | ETH, USDC, address      |
| Token B     | Yes      | -        | USDC, WBTC, address     |
| Amount      | Yes      | -        | 1 ETH, $1000            |
| Chain       | No       | Ethereum | Base, Arbitrum          |
| Version     | No       | V3       | v2, v3, v4              |
| Fee Tier    | No       | Auto     | 0.05%, 0.3%, 1%         |
| Price Range | No       | Suggest  | Full range, ±5%, custom |

**If any required parameter is missing, use AskUserQuestion with structured options:**

For missing chain:

```json
{
  "questions": [
    {
      "question": "Which chain do you want to provide liquidity on?",
      "header": "Chain",
      "options": [
        { "label": "Base (Recommended)", "description": "Low gas, growing DeFi ecosystem" },
        { "label": "Ethereum", "description": "Deepest liquidity, higher gas" },
        { "label": "Arbitrum", "description": "Low fees, high volume" },
        { "label": "Optimism", "description": "Low fees, Ethereum L2" }
      ],
      "multiSelect": false
    }
  ]
}
```

For missing token pair:

```json
{
  "questions": [
    {
      "question": "Which token pair do you want to provide liquidity for?",
      "header": "Pair",
      "options": [
        { "label": "ETH / USDC", "description": "Most popular pair, high volume" },
        { "label": "ETH / USDT", "description": "High volume stablecoin pair" },
        { "label": "WBTC / ETH", "description": "Blue chip crypto pair" },
        { "label": "Custom pair", "description": "Specify your own tokens" }
      ],
      "multiSelect": false
    }
  ]
}
```

Always use forms instead of plain text questions for better UX.

### Step 2: Resolve Token Addresses

Resolve token symbols to addresses. See `../../references/chains.md` for common tokens by chain.

For unknown tokens, use web search and verify on-chain.

### Input Validation (Required Before Any Shell Command)

Before interpolating user-provided values into any shell command, validate all inputs:

- **Token addresses** MUST match: `^0x[a-fA-F0-9]{40}$`
- **Chain/network names** MUST be from the allowed list in `../../references/chains.md`
- **Amounts** MUST be valid decimal numbers (match: `^[0-9]+\.?[0-9]*$`)
- **Reject** any input containing shell metacharacters (`;`, `|`, `$`, `` ` ``, `&`, `(`, `)`, `>`, `<`, `\`)

### Step 3: Discover Available Pools

Before fetching metrics, verify the pool exists and discover available fee tiers.

**Find pools for a token using DexScreener:**

```bash
# Get all Uniswap pools for a token (replace {network} and {address})
# IMPORTANT: Validate address matches ^0x[a-fA-F0-9]{40}$ and network is from allowed list
curl -s "https://api.dexscreener.com/token-pairs/v1/{network}/{address}" | \
  jq '[.[] | select(.dexId == "uniswap")] | map({
    pairAddress,
    pair: "\(.baseToken.symbol)/\(.quoteToken.symbol)",
    version: .labels[0],
    liquidity: .liquidity.usd,
    volume24h: .volume.h24
  })'
```

**Network IDs:** `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `unichain`

**From the results, identify:**

- Available pools and their addresses (multiple = different fee tiers)
- Pool TVL (`liquidity.usd`) to assess liquidity depth
- Version (v3 or v4) from `labels[0]`

**If no Uniswap pools found:** The pair may not have an existing pool. Inform the user they would be creating a new pool and setting the initial price.

### Step 4: Assess Pool Liquidity

Evaluate if the pool has sufficient liquidity:

| TVL Range    | Assessment     | Recommendation                                               |
| ------------ | -------------- | ------------------------------------------------------------ |
| > $1M        | Deep liquidity | Safe for most position sizes                                 |
| $100K - $1M  | Moderate       | Suitable for positions up to ~$10K                           |
| $10K - $100K | Thin           | Warn user about slippage risk, suggest smaller positions     |
| < $10K       | Very thin      | **Warn strongly** - high IL risk, price impact on entry/exit |

**For thin liquidity pools, present a warning:**

```markdown
⚠️ **Low Liquidity Warning**

This pool has only ${tvl} TVL. Consider:

- Your position will be a significant % of the pool
- Entry/exit may move the price against you
- Impermanent loss risk is amplified in thin pools
- You may want to use a wider price range for safety
```

### Step 5: Fetch Pool Metrics

Before suggesting ranges, fetch pool data for informed decisions. See `references/data-providers.md` for full API details.

**Get pool APY and volume with DefiLlama:**

```bash
# Find Uniswap V3 pools for a token pair
curl -s "https://yields.llama.fi/pools" | jq '[.data[] | select(.project == "uniswap-v3" and .chain == "Ethereum" and (.symbol | test("WETH.*USDC|USDC.*WETH")))]'
```

**Response fields to use:**

| Field         | Use For                  |
| ------------- | ------------------------ |
| `apy`         | Show expected yield      |
| `tvlUsd`      | Assess pool depth        |
| `volumeUsd1d` | Estimate fee earnings    |
| `volumeUsd7d` | Check volume consistency |

**Get current prices with DexScreener:**

```bash
# Get token prices from the pool data (already fetched in Step 3)
curl -s "https://api.dexscreener.com/token-pairs/v1/{network}/{address}" | \
  jq '[.[] | select(.dexId == "uniswap")][0] | {
    baseTokenPrice: .baseToken.priceUsd,
    quoteTokenPrice: .quoteToken.priceUsd
  }'
```

**Compare fee tiers (if APY data available):**

```bash
# Find all fee tier variants and compare APY
curl -s "https://yields.llama.fi/pools" | jq '[.data[] | select(.project == "uniswap-v3" and (.symbol | test("WETH.*USDC")))] | map({symbol, tvlUsd, apy, volumeUsd1d})'
```

If APIs are unavailable, fall back to web search for price estimates.

### Step 6: Suggest Price Ranges

Based on current price and pair type, present range options using AskUserQuestion.

**For major pairs (ETH/USDC, ETH/WBTC):**

```json
{
  "questions": [
    {
      "question": "What price range do you want for your position? (Current: ~3,200 USDC/ETH)",
      "header": "Range",
      "options": [
        {
          "label": "±10% (Recommended)",
          "description": "2,880 - 3,520 USDC. Higher fees, monitor weekly"
        },
        { "label": "±20%", "description": "2,560 - 3,840 USDC. Balanced risk/reward" },
        { "label": "±50%", "description": "1,600 - 4,800 USDC. Rarely out of range" },
        { "label": "Full Range", "description": "Never out of range, lower fee efficiency" }
      ],
      "multiSelect": false
    }
  ]
}
```

**For stablecoin pairs (USDC/USDT, DAI/USDC):**

```json
{
  "questions": [
    {
      "question": "What price range for your stablecoin position?",
      "header": "Range",
      "options": [
        { "label": "±0.5% (Recommended)", "description": "0.995 - 1.005. Tight range, high fees" },
        { "label": "±1%", "description": "0.99 - 1.01. Standard for stables" },
        { "label": "±2%", "description": "0.98 - 1.02. Safer, lower fees" },
        { "label": "Full Range", "description": "Maximum safety, lowest fees" }
      ],
      "multiSelect": false
    }
  ]
}
```

**Recommendation logic:**

- Stablecoin pairs (USDC/USDT): Default to ±0.5-1%
- Correlated pairs (ETH/stETH): Default to ±2-5%
- Major pairs (ETH/USDC): Default to ±10-20%
- Volatile pairs: Default to ±30-50% or full range

### Step 7: Determine Fee Tier

If multiple fee tiers exist for the pair, let the user choose using pool data from Step 3.

**Present fee tier options with APY data:**

```json
{
  "questions": [
    {
      "question": "Which fee tier? (Based on current pool data)",
      "header": "Fee Tier",
      "options": [
        { "label": "0.30% (Recommended)", "description": "TVL: $15M, APY: 12.5%, highest volume" },
        { "label": "0.05%", "description": "TVL: $8M, APY: 8.2%, lower fees per trade" },
        { "label": "1.00%", "description": "TVL: $2M, APY: 18.1%, less competition" }
      ],
      "multiSelect": false
    }
  ]
}
```

**Fee tier guidelines:**

| Fee           | Tick Spacing | Best For                     |
| ------------- | ------------ | ---------------------------- |
| 0.01% (100)   | 1            | Stablecoin pairs             |
| 0.05% (500)   | 10           | Correlated pairs (ETH/stETH) |
| 0.30% (3000)  | 60           | Most pairs (default)         |
| 1.00% (10000) | 200          | Exotic/volatile pairs        |

**v4 Fee Tiers:** Dynamic fees possible with hooks. Default to similar V3 tiers.

If pool data shows one tier with significantly higher APY or volume, recommend that tier.

### Step 8: Generate Deep Link

Construct the Uniswap position creation URL:

**Base URL:** `https://app.uniswap.org/positions/create`

**URL Parameters:**

| Parameter         | Description                | Format                    |
| ----------------- | -------------------------- | ------------------------- |
| `chain`           | Network name               | `ethereum`, `base`, etc.  |
| `currencyA`       | First token                | Address or `NATIVE`       |
| `currencyB`       | Second token               | Address or `NATIVE`       |
| `priceRangeState` | Range configuration        | JSON (encode quotes only) |
| `depositState`    | Deposit amounts            | JSON (encode quotes only) |
| `fee`             | Fee tier configuration     | JSON (encode quotes only) |
| `hook`            | v4 hook address (optional) | Address or `undefined`    |
| `step`            | Flow step                  | `1` (for create)          |

**IMPORTANT: URL Encoding**

Only encode the double quotes (`"` → `%22`) in JSON values. Do NOT encode braces `{}` or colons `:`.

**priceRangeState JSON structure:**

For full range:

```json
{
  "priceInverted": false,
  "fullRange": true,
  "minPrice": "",
  "maxPrice": "",
  "initialPrice": "",
  "inputMode": "price"
}
```

For custom range:

```json
{
  "priceInverted": false,
  "fullRange": false,
  "minPrice": "2800",
  "maxPrice": "3600",
  "initialPrice": "",
  "inputMode": "price"
}
```

**depositState JSON structure:**

```json
{ "exactField": "TOKEN0", "exactAmounts": { "TOKEN0": "1.0" } }
```

Note: Use `TOKEN0` for currencyA, `TOKEN1` for currencyB.

**fee JSON structure:**

```json
{ "feeAmount": 3000, "tickSpacing": 60, "isDynamic": false }
```

**Tick spacing by fee:**

| Fee           | Tick Spacing |
| ------------- | ------------ |
| 100 (0.01%)   | 1            |
| 500 (0.05%)   | 10           |
| 3000 (0.30%)  | 60           |
| 10000 (1.00%) | 200          |

### Step 9: Present Output and Open Browser

Format the response with:

1. **Summary** of the position parameters
2. **Price range** visualization (if not full range)
3. **Considerations** about IL and management
4. **Open the browser** automatically using system command

**Example output format:**

```markdown
## Liquidity Position Summary

| Parameter | Value                   |
| --------- | ----------------------- |
| Pair      | ETH / USDC              |
| Chain     | Base                    |
| Version   | V3                      |
| Fee Tier  | 0.30%                   |
| Deposit   | 1 ETH + equivalent USDC |

### Pool Analytics

| Metric      | Value  |
| ----------- | ------ |
| Current APY | 12.5%  |
| 24h Volume  | $2.1M  |
| 7d Volume   | $14.8M |
| Pool TVL    | $15.2M |

### Price Range

| Metric        | Value               |
| ------------- | ------------------- |
| Current Price | ~3,200 USDC per ETH |
| Min Price     | 2,800 USDC per ETH  |
| Max Price     | 3,600 USDC per ETH  |
| Range Width   | ±12.5%              |

### Considerations

- **Impermanent Loss**: If ETH moves outside your range, you'll hold 100% of one asset
- **Rebalancing**: Monitor position and adjust range if price moves significantly
- **Fee Earnings**: Tighter ranges earn more fees but require more active management
- **Gas Costs**: Creating and managing positions costs gas
- **APY Note**: Shown APY is historical and may vary with market conditions

Opening Uniswap in your browser...
```

**After displaying the summary, open the URL in the browser:**

```bash
# Linux - note: only quotes are encoded (%22), not braces or colons
xdg-open "https://app.uniswap.org/positions/create?currencyA=NATIVE&currencyB=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&chain=base&fee={%22feeAmount%22:3000,%22tickSpacing%22:60,%22isDynamic%22:false}&priceRangeState={%22priceInverted%22:false,%22fullRange%22:false,%22minPrice%22:%222800%22,%22maxPrice%22:%223600%22,%22initialPrice%22:%22%22,%22inputMode%22:%22price%22}&depositState={%22exactField%22:%22TOKEN0%22,%22exactAmounts%22:{%22TOKEN0%22:%221%22}}&step=1"

# macOS
open "https://app.uniswap.org/positions/create?..."
```

**Environment limitations:** Browser opening may fail in remote SSH, containerized, or headless environments. If `xdg-open`/`open` fails, display the full URL prominently so users can copy and paste it manually:

```markdown
**[Click here to open in Uniswap](https://app.uniswap.org/positions/create?...)**

Or copy this URL: `https://app.uniswap.org/positions/create?...`
```

Always present the summary and URL so users can review and create the position.

## Version Selection

For detailed version comparison (v2/v3/v4 differences, fee tiers, tick spacing), see `references/position-types.md`.

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

- **`../../references/chains.md`** - Chain configuration and token addresses (shared with swap-planner)
- **`references/position-types.md`** - v2/v3/v4 differences, fee tiers, tick spacing
- **`references/data-providers.md`** - DexScreener and DefiLlama APIs for pool discovery and yields

### URL Encoding

JSON parameters in deep links should have **only double quotes encoded** (`"` → `%22`). Do NOT encode braces `{}`, colons `:`, or commas `,`.

```text
?priceRangeState={%22fullRange%22:true}
```

Decodes to:

```json
{ "fullRange": true }
```

> **Why?** The Uniswap interface expects JSON-like parameter structure. Full URL encoding of braces and colons breaks parsing. Only quotes need encoding to avoid URL syntax conflicts.
