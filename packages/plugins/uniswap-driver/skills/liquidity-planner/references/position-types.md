# Position Types Reference

Comprehensive reference for Uniswap v2, v3, and v4 liquidity positions.

## Version Comparison

| Feature                 | v2              | v3                     | v4                   |
| ----------------------- | --------------- | ---------------------- | -------------------- |
| Liquidity Type          | Full Range      | Concentrated           | Concentrated         |
| Price Ranges            | No              | Yes                    | Yes                  |
| Position Representation | ERC-20 LP Token | NFT                    | NFT                  |
| Fee Tiers               | 0.3% fixed      | 0.01%, 0.05%, 0.3%, 1% | Dynamic (with hooks) |
| Hooks Support           | No              | No                     | Yes                  |
| Capital Efficiency      | 1x              | Up to 4000x            | Up to 4000x+         |
| Gas Costs               | Low             | Medium                 | Medium               |

## V2 Positions

### V2 Basics

V2 uses the constant product formula (x \* y = k) across the entire price range.

**Pros:**

- Simple to understand and manage
- No rebalancing needed
- Lower gas costs
- Fungible LP tokens

**Cons:**

- Capital inefficient (liquidity spread across infinite range)
- Lower fee earnings per dollar deposited

### URL Parameters for V2

V2 positions use a different URL structure:

```text
https://app.uniswap.org/add/v2/{tokenA}/{tokenB}
```

Or with the unified interface:

```text
https://app.uniswap.org/positions/create?version=v2&currencyA={}&currencyB={}
```

### When to Use V2

- Very long-term, passive positions
- Pairs with extreme volatility where any range would be exceeded
- When gas costs for V3 management exceed benefits

## V3 Positions

### V3 Basics

V3 allows LPs to concentrate liquidity within custom price ranges, dramatically improving capital efficiency.

### Fee Tiers

| Fee           | Tick Spacing | Best For          | Typical Pairs          |
| ------------- | ------------ | ----------------- | ---------------------- |
| 0.01% (100)   | 1            | Stablecoins       | USDC/USDT, DAI/USDC    |
| 0.05% (500)   | 10           | Correlated assets | ETH/stETH, WBTC/renBTC |
| 0.30% (3000)  | 60           | Most pairs        | ETH/USDC, WBTC/ETH     |
| 1.00% (10000) | 200          | Exotic pairs      | Long-tail tokens       |

### Tick Math

V3 uses discrete ticks to represent prices. Key concepts:

- **Tick**: Integer representing a price point
- **Tick Spacing**: Minimum distance between usable ticks (varies by fee tier)
- **Price to Tick**: `tick = log(price) / log(1.0001)`

**Tick ranges by fee tier:**

| Fee   | Tick Spacing | Min Tick | Max Tick |
| ----- | ------------ | -------- | -------- |
| 100   | 1            | -887272  | 887272   |
| 500   | 10           | -887270  | 887270   |
| 3000  | 60           | -887220  | 887220   |
| 10000 | 200          | -887200  | 887200   |

### Price Range Strategies

**Full Range:**

```json
{
  "fullRange": true
}
```

Characteristics:

- Behaves like V2
- Never goes out of range
- Lower capital efficiency

**Tight Range (±5%):**

```json
{
  "fullRange": false,
  "minPrice": "3040",
  "maxPrice": "3360"
}
```

Characteristics:

- High capital efficiency
- High fee APR
- Requires frequent monitoring

**Medium Range (±20%):**

```json
{
  "fullRange": false,
  "minPrice": "2560",
  "maxPrice": "3840"
}
```

Characteristics:

- Balanced approach
- Moderate monitoring
- Good for most users

**Wide Range (±50%):**

```json
{
  "fullRange": false,
  "minPrice": "1600",
  "maxPrice": "4800"
}
```

Characteristics:

- More passive
- Lower concentration benefits
- Less monitoring needed

### Position NFT

V3 positions are represented as NFTs (ERC-721):

- Each position has a unique token ID
- NFT contains position metadata (pool, range, liquidity)
- Can be transferred, sold, or used as collateral

## v4 Positions

### v4 Basics

v4 introduces hooks - custom smart contracts that can execute logic at various points in the pool lifecycle.

### Key Differences from v3

1. **Hooks**: Custom logic for swaps, liquidity changes, etc.
2. **Dynamic Fees**: Fees can change based on conditions
3. **Singleton Contract**: All pools in one contract (gas savings)
4. **Flash Accounting**: More efficient multi-hop swaps

### Hook Address Parameter

When creating v4 positions with hooks:

```json
{
  "hook": "0x..."
}
```

The hook address determines which v4 pool to use.

### v4 Availability

v4 is newer and has limited pool availability. Check if a v4 pool exists before suggesting it.

**Chains with v4 support:**

- Ethereum Mainnet (limited pools)
- Base (growing)
- Other L2s (expanding)

### When to Use v4

- When specific hook functionality is needed
- For advanced use cases (TWAMM, limit orders, etc.)
- When v4 pool has better liquidity than v3

## Chain Availability

### Version Support by Chain

| Chain       | V2  | V3  | V4  |
| ----------- | --- | --- | --- |
| Ethereum    | ✅  | ✅  | ✅  |
| Base        | ❌  | ✅  | ✅  |
| Arbitrum    | ✅  | ✅  | ✅  |
| Optimism    | ❌  | ✅  | ✅  |
| Polygon     | ✅  | ✅  | 🔜  |
| BNB Chain   | ✅  | ✅  | 🔜  |
| Avalanche   | ❌  | ✅  | 🔜  |
| Celo        | ✅  | ✅  | ❌  |
| Blast       | ❌  | ✅  | ✅  |
| Zora        | ❌  | ✅  | ✅  |
| World Chain | ❌  | ✅  | ✅  |
| Unichain    | ❌  | ✅  | ✅  |

### Recommendation by Chain

**For most users on most chains:** v3 with 0.3% fee tier

**For stablecoin LPs:** v3 with 0.01% or 0.05% fee tier

**For advanced users:** v4 if appropriate hook/pool exists

## Impermanent Loss by Range

IL increases with range tightness and price movement:

| Price Move | Full Range IL | ±50% Range IL | ±20% Range IL | ±10% Range IL |
| ---------- | ------------- | ------------- | ------------- | ------------- |
| ±10%       | 0.11%         | 0.22%         | 0.55%         | 1.10%         |
| ±25%       | 0.64%         | 1.28%         | 3.20%         | 100%\*        |
| ±50%       | 2.02%         | 4.04%         | 100%\*        | 100%\*        |

\*100% means position is entirely in one asset (out of range)

## Deep Link Parameter Reference

**IMPORTANT: URL Encoding Rules**

Only encode double quotes (`"` → `%22`). Do NOT encode braces `{}`, colons `:`, or commas `,`.

### priceRangeState Object

```typescript
interface PriceRangeState {
  priceInverted: boolean; // false for normal price direction
  fullRange: boolean; // true for full range, false for custom
  minPrice: string; // Min price as string (empty for full range)
  maxPrice: string; // Max price as string (empty for full range)
  initialPrice: string; // Empty string for existing pools
  inputMode: string; // Always "price"
}
```

### depositState Object

```typescript
interface DepositState {
  exactField: 'TOKEN0' | 'TOKEN1'; // TOKEN0 = currencyA, TOKEN1 = currencyB
  exactAmounts: {
    TOKEN0?: string;
    TOKEN1?: string;
  };
}
```

### fee Object

```typescript
interface FeeData {
  feeAmount: number; // Fee in hundredths of a bip (3000 = 0.3%)
  tickSpacing: number; // Tick spacing for the fee tier
  isDynamic: boolean; // false for V3, can be true for V4
}
```

## URL Encoding Examples

### Full Range v3 Position (ETH/USDC, 0.3% fee)

```text
https://app.uniswap.org/positions/create
  ?currencyA=NATIVE
  &currencyB=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  &chain=ethereum
  &fee={%22feeAmount%22:3000,%22tickSpacing%22:60,%22isDynamic%22:false}
  &priceRangeState={%22priceInverted%22:false,%22fullRange%22:true,%22minPrice%22:%22%22,%22maxPrice%22:%22%22,%22initialPrice%22:%22%22,%22inputMode%22:%22price%22}
  &step=1
```

### Custom Range V3 Position (ETH/USDC on Base, ±10% range)

```text
https://app.uniswap.org/positions/create
  ?currencyA=NATIVE
  &currencyB=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  &chain=base
  &fee={%22feeAmount%22:3000,%22tickSpacing%22:60,%22isDynamic%22:false}
  &priceRangeState={%22priceInverted%22:false,%22fullRange%22:false,%22minPrice%22:%222800%22,%22maxPrice%22:%223600%22,%22initialPrice%22:%22%22,%22inputMode%22:%22price%22}
  &depositState={%22exactField%22:%22TOKEN0%22,%22exactAmounts%22:{%22TOKEN0%22:%221%22}}
  &step=1
```

### Stablecoin Position (USDC/USDT, 0.01% fee, tight range)

```text
https://app.uniswap.org/positions/create
  ?currencyA=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  &currencyB=0xdAC17F958D2ee523a2206206994597C13D831ec7
  &chain=ethereum
  &fee={%22feeAmount%22:100,%22tickSpacing%22:1,%22isDynamic%22:false}
  &priceRangeState={%22priceInverted%22:false,%22fullRange%22:false,%22minPrice%22:%220.99%22,%22maxPrice%22:%221.01%22,%22initialPrice%22:%22%22,%22inputMode%22:%22price%22}
  &step=1
```
