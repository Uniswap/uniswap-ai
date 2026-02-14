# Data Providers Reference

APIs for fetching real-time token prices and pool liquidity for swap planning.

**Primary:** DexScreener (pool discovery, prices, liquidity)
**Fallback:** DefiLlama (prices, pool TVL)

## DexScreener API (Primary)

No authentication required. 300 requests/minute.

**Network IDs:** `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, `unichain` (full list with DefiLlama equivalents in `../../references/chains.md`)

**Coverage note:** Ethereum, Base, and Arbitrum have deep Uniswap pool data. Celo, Blast, Zora, and World Chain have limited coverage — expect fewer results and potentially missing pairs.

### Get Token Price

```bash
# Get token info including price
curl -s "https://api.dexscreener.com/tokens/v1/{network}/{address}" | \
  jq '.[0] | {symbol: .baseToken.symbol, priceUsd: .priceUsd, liquidity: .liquidity.usd}'
```

**Example - Get WETH price on Base:**

```bash
curl -s "https://api.dexscreener.com/tokens/v1/base/0x4200000000000000000000000000000000000006" | \
  jq '.[0] | {symbol: .baseToken.symbol, priceUsd: .priceUsd}'
```

### Token Discovery

**Note:** DexScreener's public API doesn't have a dedicated "trending" or "top gainers" endpoint. Use these approaches:

**Search by keyword** (best for specific categories):

```bash
# Search for tokens by name/theme (e.g., degen, pepe, ai, meme)
curl -s "https://api.dexscreener.com/latest/dex/search?q=degen" | \
  jq '[.pairs[] | select(.chainId == "base")] | sort_by(-.volume.h24) | .[0:5] | map({
    token: .baseToken.symbol,
    address: .baseToken.address,
    price: .priceUsd,
    volume24h: .volume.h24,
    liquidity: .liquidity.usd
  })'
```

**Promoted tokens** (limited selection):

```bash
curl -s "https://api.dexscreener.com/token-boosts/top/v1" | \
  jq '[.[] | select(.chainId == "base")] | map({tokenAddress, url})'
```

### Find Pools for Token Pair

```bash
# Find all pools containing a token
curl -s "https://api.dexscreener.com/token-pairs/v1/{network}/{address}" | \
  jq '[.[] | select(.dexId == "uniswap")] | map({
    pairAddress,
    baseToken: .baseToken.symbol,
    quoteToken: .quoteToken.symbol,
    priceUsd,
    liquidity: .liquidity.usd,
    volume24h: .volume.h24
  })'
```

### Response Fields

| Field       | Path                | Description          |
| ----------- | ------------------- | -------------------- |
| Price USD   | `priceUsd`          | Current token price  |
| Liquidity   | `liquidity.usd`     | Pool TVL in USD      |
| 24h Volume  | `volume.h24`        | Trading volume       |
| Base token  | `baseToken.symbol`  | First token in pair  |
| Quote token | `quoteToken.symbol` | Second token in pair |

### Important Notes

- **Filter by DEX**: Results include all DEXes. Filter with `select(.dexId == "uniswap")` for Uniswap-only.
- **Multiple pools**: Same pair may have multiple pools (different fee tiers). Highest liquidity is usually best for swaps.

## DefiLlama API (Fallback)

No authentication required. Use when DexScreener is unavailable or for cross-chain price checks.

### Get Price by Contract

```bash
curl -s "https://coins.llama.fi/prices/current/{chain}:{address}"
```

**Chain IDs:** `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avax`, `unichain` (full list in `../../references/chains.md`)

**Important:** DefiLlama uses `avax` (not `avalanche`), and Zora/World Chain are not indexed by DefiLlama.

**Example - Get prices for multiple tokens:**

```bash
curl -s "https://coins.llama.fi/prices/current/base:0x4200000000000000000000000000000000000006,base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" | \
  jq '.coins | to_entries | map({address: .key, price: .value.price, symbol: .value.symbol})'
```

## Usage Patterns

### Pattern 1: Known Token Swap

For "swap 1 ETH to USDC" requests:

```bash
# 1. Get both token prices from DexScreener
curl -s "https://api.dexscreener.com/token-pairs/v1/base/0x4200000000000000000000000000000000000006" | \
  jq '[.[] | select(.dexId == "uniswap" and .quoteToken.symbol == "USDC")] | .[0] | {
    ethPrice: .baseToken.priceUsd,
    usdcPrice: .quoteToken.priceUsd,
    poolLiquidity: .liquidity.usd
  }'

# 2. Calculate estimated output
python3 -c "
eth_price = 2288.62
usdc_price = 1.0
input_amount = 1.0
estimated_output = (input_amount * eth_price) / usdc_price
print(f'~{estimated_output:,.2f} USDC')
"
```

### Pattern 2: Token Discovery

For "find trending tokens to swap" requests:

```bash
# Get pools with high volume on the chain
curl -s "https://api.dexscreener.com/latest/dex/search?q=base" | \
  jq '[.pairs[] | select(.chainId == "base" and .dexId == "uniswap")] |
    sort_by(-.volume.h24) | .[0:10] | map({
      token: .baseToken.symbol,
      price: .priceUsd,
      volume24h: .volume.h24,
      liquidity: .liquidity.usd
    })'
```

### Pattern 3: Check Liquidity Before Swap

```bash
# Find pools for the token pair and check liquidity
curl -s "https://api.dexscreener.com/token-pairs/v1/base/{token_address}" | \
  jq '[.[] | select(.dexId == "uniswap")] | max_by(.liquidity.usd) | {
    pool: .pairAddress,
    liquidity: .liquidity.usd,
    volume24h: .volume.h24
  }'
```

## Liquidity Risk Assessment

| Pool TVL     | Risk Level | Recommendation                          |
| ------------ | ---------- | --------------------------------------- |
| > $1M        | Low        | Proceed normally                        |
| $100k - $1M  | Medium     | Note potential slippage                 |
| $10k - $100k | High       | Warn user, suggest smaller trade        |
| < $10k       | Very High  | Advise against, extreme slippage likely |

## Error Handling

| Scenario                  | Action                                          |
| ------------------------- | ----------------------------------------------- |
| DexScreener returns empty | Try DefiLlama for price                         |
| Token not found           | Use web search to verify token exists           |
| No Uniswap pools          | Inform user the pair isn't available on Uniswap |
| Very low liquidity        | Warn user about slippage risk                   |
