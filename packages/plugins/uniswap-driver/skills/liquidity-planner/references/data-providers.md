# Data Providers Reference

APIs for fetching pool data to inform LP position decisions. Uses two providers:

1. **DexScreener** - Pool discovery, prices, TVL, volume (primary)
2. **DefiLlama** - APY/yield data (when available)

## DexScreener API (Primary)

No authentication required. 300 requests/minute. Best for pool discovery and real-time metrics.

**Network IDs:** `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, `unichain`

### Discover Pools for a Token

Use this to find what pools exist for a token pair:

```bash
# Find all pools containing a token (e.g., UNI on Base)
curl -s "https://api.dexscreener.com/token-pairs/v1/base/0xc3de830ea07524a0761646a6a4e4be0e114a3c83" | \
  jq '[.[] | select(.dexId == "uniswap")] | map({
    pairAddress,
    baseToken: .baseToken.symbol,
    quoteToken: .quoteToken.symbol,
    version: .labels[0],
    liquidity: .liquidity.usd,
    volume24h: .volume.h24,
    priceUsd
  })'
```

### Get Pool Details

```bash
# Get specific pool by address
curl -s "https://api.dexscreener.com/latest/dex/pairs/base/0xab365f161dd501473a1ff0d2ef0dce94e7398839" | \
  jq '.pairs[0] | {
    name: "\(.baseToken.symbol)/\(.quoteToken.symbol)",
    version: .labels[0],
    liquidity: .liquidity.usd,
    volume24h: .volume.h24,
    baseTokenPrice: .baseToken.priceUsd,
    quoteTokenPrice: .quoteToken.priceUsd,
    priceChange24h: .priceChange.h24
  }'
```

### Search for Token Pair

```bash
# Search by token names (filter results by dexId)
curl -s "https://api.dexscreener.com/latest/dex/search?q=ETH%20USDC%20base" | \
  jq '[.pairs[] | select(.dexId == "uniswap")] | .[0:5] | map({
    pairAddress,
    name: "\(.baseToken.symbol)/\(.quoteToken.symbol)",
    liquidity: .liquidity.usd,
    volume24h: .volume.h24
  })'
```

### DexScreener Response Fields

| Field             | Path                  | Description            |
| ----------------- | --------------------- | ---------------------- |
| Pool address      | `pairAddress`         | Use for deep links     |
| Version           | `labels[0]`           | "v3" or "v4"           |
| TVL               | `liquidity.usd`       | Pool liquidity in USD  |
| 24h Volume        | `volume.h24`          | Trading volume         |
| Price             | `priceUsd`            | Current price          |
| Base token price  | `baseToken.priceUsd`  | For ratio calculations |
| Quote token price | `quoteToken.priceUsd` | For ratio calculations |

### Important Notes

- **Filter by DEX**: Results include ALL DEXes. Always filter with `select(.dexId == "uniswap")`.
- **Fee tier not explicit**: DexScreener shows version (v3/v4) but not fee tier (0.3%, 1%). Each fee tier has a different pool address - multiple pools for same pair = different fee tiers.
- **No 7d volume**: Only real-time data up to 24 hours.

## DefiLlama Yields API (APY Data)

No authentication required. Best source for Uniswap pool yields, but coverage is limited for less popular pairs.

### Find Pool APY

```bash
# Find Uniswap V3 pools for a token pair on a specific chain
curl -s "https://yields.llama.fi/pools" | jq '[.data[] | select(
  .project == "uniswap-v3" and
  .chain == "Base" and
  (.symbol | test("WETH.*UNI|UNI.*WETH"; "i"))
)] | map({symbol, apy, apyBase, tvlUsd, volumeUsd1d, volumeUsd7d})'
```

### DefiLlama Response Fields

| Field         | Description                |
| ------------- | -------------------------- |
| `apy`         | Total APY (base + rewards) |
| `apyBase`     | APY from trading fees only |
| `tvlUsd`      | Total value locked         |
| `volumeUsd1d` | 24-hour volume             |
| `volumeUsd7d` | 7-day volume               |

### Chain Names

DefiLlama uses capitalized names: `Ethereum`, `Base`, `Arbitrum`, `Optimism`, `Polygon`

### Coverage Limitations

DefiLlama often returns **empty results** for:

- Less popular token pairs
- Newer pools
- Low-TVL pools

When empty, note "APY data unavailable" and rely on DexScreener for other metrics.

## Recommended Workflow

### Step 1: Discover Pools (DexScreener)

```bash
# Find all Uniswap pools for the token
curl -s "https://api.dexscreener.com/token-pairs/v1/{network}/{token_address}" | \
  jq '[.[] | select(.dexId == "uniswap")]'
```

From results, identify:

- Available pools and their addresses
- Which has highest liquidity (likely the main fee tier)
- Current prices for range calculations

### Step 2: Check APY (DefiLlama)

```bash
# Try to get yield data
curl -s "https://yields.llama.fi/pools" | jq '[.data[] | select(
  .project == "uniswap-v3" and
  .chain == "{Chain}" and
  (.symbol | test("{TOKEN_A}.*{TOKEN_B}|{TOKEN_B}.*{TOKEN_A}"; "i"))
)]'
```

If results empty, proceed without APY data.

### Step 3: Assess Liquidity

| TVL Range    | Assessment     | Action                          |
| ------------ | -------------- | ------------------------------- |
| > $1M        | Deep liquidity | Proceed normally                |
| $100K - $1M  | Moderate       | Suitable for most positions     |
| $10K - $100K | Thin           | Warn user, suggest wider ranges |
| < $10K       | Very thin      | Strong warning about risks      |

### Step 4: Calculate Price Range

Use DexScreener prices to calculate range bounds:

```bash
# Get current price ratio
BASE_PRICE=$(curl -s "..." | jq -r '.pairs[0].baseToken.priceUsd')
QUOTE_PRICE=$(curl -s "..." | jq -r '.pairs[0].quoteToken.priceUsd')

# Calculate ratio and ±20% bounds with python
python3 -c "
base, quote = $BASE_PRICE, $QUOTE_PRICE
ratio = quote / base
print(f'Current: {ratio:.2f}')
print(f'Min (−20%): {ratio * 0.8:.2f}')
print(f'Max (+20%): {ratio * 1.2:.2f}')
"
```

## Example: Complete Pool Research

```bash
# 1. Find ETH/UNI pools on Base
curl -s "https://api.dexscreener.com/token-pairs/v1/base/0xc3de830ea07524a0761646a6a4e4be0e114a3c83" | \
  jq '[.[] | select(.dexId == "uniswap" and (.quoteToken.symbol == "WETH" or .baseToken.symbol == "WETH"))] | map({
    pairAddress,
    pair: "\(.baseToken.symbol)/\(.quoteToken.symbol)",
    version: .labels[0],
    tvl: .liquidity.usd,
    volume24h: .volume.h24,
    ethPrice: (if .quoteToken.symbol == "WETH" then .quoteToken.priceUsd else .baseToken.priceUsd end),
    uniPrice: (if .baseToken.symbol == "UNI" then .baseToken.priceUsd else .quoteToken.priceUsd end)
  })'

# 2. Try DefiLlama for APY (may return empty)
curl -s "https://yields.llama.fi/pools" | jq '[.data[] | select(
  .project == "uniswap-v3" and
  .chain == "Base" and
  (.symbol | test("UNI.*WETH|WETH.*UNI|UNI.*ETH|ETH.*UNI"; "i"))
)] | map({symbol, apy, tvlUsd})'
```

## Error Handling

| Scenario                             | Action                                                            |
| ------------------------------------ | ----------------------------------------------------------------- |
| DexScreener returns no Uniswap pools | Pool may not exist; inform user they'd create a new pool          |
| DefiLlama returns empty              | Note "APY unavailable"; use DexScreener volume/TVL ratio as proxy |
| Multiple pools found                 | Present options; highest TVL is usually the primary fee tier      |
| API timeout                          | Retry once, then fall back to web search                          |
