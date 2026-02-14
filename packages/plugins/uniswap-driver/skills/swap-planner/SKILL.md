---
name: swap-planner
description: This skill should be used when the user asks to "swap tokens", "trade ETH for USDC", "exchange tokens on Uniswap", "buy tokens", "sell tokens", "convert ETH to stablecoins", "find memecoins", "discover tokens", "research tokens", "tokens to buy", "find tokens to swap", "what should I buy", or mentions swapping, trading, researching, discovering, buying, or exchanging tokens on any Uniswap-supported chain. Supports both known token swaps and token discovery workflows (discovery uses keyword search and web search — there is no live "trending" feed). Generates deep links to execute swaps in the Uniswap interface.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), Bash(xdg-open:*), Bash(open:*), WebFetch, WebSearch, Task(subagent_type:Explore), AskUserQuestion
model: sonnet
license: MIT
metadata:
  author: uniswap
  version: '0.2.1'
---

# Swap Planning

Plan and generate deep links for token swaps on Uniswap across all supported chains.

> **Runtime Compatibility:** This skill uses `AskUserQuestion` for interactive prompts. If `AskUserQuestion` is not available in your runtime, collect the same parameters through natural language conversation instead.

## Overview

Plan token swaps by:

1. Gathering swap intent (tokens, amounts, chain)
2. Verifying token contracts on-chain
3. Researching tokens via web search when needed
4. Generating a deep link that opens in the Uniswap interface with parameters pre-filled

The generated link opens Uniswap with all parameters ready for execution.

> **Note:** Browser opening (`xdg-open`/`open`) may fail in SSH, containerized, or headless environments. Always display the URL prominently so users can copy and access it manually if needed.

## Workflow

### Step 0: Token Discovery (When Needed)

If the user wants to **discover** tokens rather than swap a known token (e.g., "find me a memecoin", "what's trending on Base"), help them explore before proceeding to the swap.

#### Option A: Search by Keyword

DexScreener search works best with specific terms:

```bash
# Search for tokens by name/category (e.g., "degen", "pepe", "ai agent")
curl -s "https://api.dexscreener.com/latest/dex/search?q=degen" | \
  jq '[.pairs[] | select(.chainId == "base" and .dexId == "uniswap")] |
    sort_by(-.volume.h24) | .[0:5] | map({
      token: .baseToken.symbol,
      address: .baseToken.address,
      price: .priceUsd,
      volume24h: .volume.h24,
      liquidity: .liquidity.usd
    })'
```

**Good search terms:** `degen`, `pepe`, `ai`, `agent`, `meme`, `dog`, `cat`, or specific token names

#### Option B: Check Promoted Tokens

Get tokens with active promotions (limited selection):

```bash
# Get boosted/promoted tokens on a chain
curl -s "https://api.dexscreener.com/token-boosts/top/v1" | \
  jq '[.[] | select(.chainId == "base")] | .[0:5] | map({
    tokenAddress,
    url
  })'
```

#### Option C: Web Search + Verify

For broad discovery ("what's trending"), use web search to find tokens, then verify with DexScreener:

```bash
# After finding a token address from web search, verify it exists
curl -s "https://api.dexscreener.com/token-pairs/v1/{network}/{address}" | \
  jq '[.[] | select(.dexId == "uniswap")][0] | {
    name: .baseToken.name,
    symbol: .baseToken.symbol,
    price: .priceUsd,
    liquidity: .liquidity.usd,
    volume24h: .volume.h24
  }'
```

**Network IDs:** See `references/chains.md` for the full list with DexScreener and DefiLlama provider IDs. Common IDs: `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, `unichain`.

**DexScreener coverage varies by chain.** Ethereum, Base, and Arbitrum have deep Uniswap data. Celo, Blast, Zora, and World Chain have limited Uniswap pool coverage — fewer results and potentially missing pairs. Fall back to DefiLlama for price data when DexScreener returns empty results (see `references/data-providers.md`).

**Note:** DexScreener's public API doesn't have a "trending" or "top gainers" endpoint. Token discovery uses keyword search (`/latest/dex/search`) and web search as a fallback. For general discovery, ask the user what type of token they're looking for and search by keyword.

#### Category-Based Discovery

For specific categories (memecoins, DeFi, gaming tokens), use web search:

```text
"trending {category} {chain} {current_year}"
```

Example: `"trending memecoins Base 2026"`

#### Present Options to User

After gathering token data, present options using AskUserQuestion:

```json
{
  "questions": [
    {
      "question": "Which token would you like to swap to?",
      "header": "Token",
      "options": [
        { "label": "MOLT ($23M mcap)", "description": "$5.9M liquidity, $7.8M 24h volume" },
        { "label": "CLANKER ($31M mcap)", "description": "$3.1M liquidity, established token" },
        { "label": "CLAWSTR ($13M mcap)", "description": "$2.1M liquidity, high volume spike" }
      ],
      "multiSelect": false
    }
  ]
}
```

#### Risk Assessment for Trending Tokens

Evaluate tokens before recommending:

| Metric       | Low Risk   | Medium Risk       | High Risk |
| ------------ | ---------- | ----------------- | --------- |
| Market Cap   | >$50M      | $5M-$50M          | <$5M      |
| Pool TVL     | >$1M       | $100k-$1M         | <$100k    |
| 24h Volume   | Consistent | Spiking unusually | Very low  |
| Contract Age | >30 days   | 7-30 days         | <7 days   |

**Always disclose risk level** when presenting options. For high-risk tokens, explicitly warn about volatility and potential for loss.

---

### Step 1: Gather Swap Intent

Extract from the user's request:

| Parameter    | Required                | Example                   |
| ------------ | ----------------------- | ------------------------- |
| Input token  | Yes                     | ETH, USDC, token address  |
| Output token | Yes                     | USDC, WBTC, token address |
| Amount       | Yes                     | 1.5 ETH, $500 worth       |
| Chain        | Yes (default: Ethereum) | Base, Arbitrum, etc.      |

**If any required parameter is missing, use AskUserQuestion with structured options:**

For missing chain:

```json
{
  "questions": [
    {
      "question": "Which chain do you want to swap on?",
      "header": "Chain",
      "options": [
        { "label": "Base (Recommended)", "description": "Low gas fees, fast transactions" },
        { "label": "Ethereum", "description": "Main network, higher gas" },
        { "label": "Arbitrum", "description": "Low fees, Ethereum L2" },
        { "label": "Optimism", "description": "Low fees, Ethereum L2" }
      ],
      "multiSelect": false
    }
  ]
}
```

For missing output token (when input is ETH):

```json
{
  "questions": [
    {
      "question": "What token do you want to receive?",
      "header": "Output",
      "options": [
        { "label": "USDC", "description": "USD stablecoin" },
        { "label": "USDT", "description": "Tether stablecoin" },
        { "label": "DAI", "description": "Decentralized stablecoin" },
        { "label": "WBTC", "description": "Wrapped Bitcoin" }
      ],
      "multiSelect": false
    }
  ]
}
```

For missing amount:

```json
{
  "questions": [
    {
      "question": "How much do you want to swap?",
      "header": "Amount",
      "options": [
        { "label": "0.1 ETH", "description": "~$320" },
        { "label": "0.5 ETH", "description": "~$1,600" },
        { "label": "1 ETH", "description": "~$3,200" },
        { "label": "Custom amount", "description": "Enter specific amount" }
      ],
      "multiSelect": false
    }
  ]
}
```

Always use forms instead of plain text questions for better UX.

### Step 2: Resolve Token Addresses

For token symbols, resolve to addresses using known tokens or web search:

**Native tokens**: Use `NATIVE` as the address parameter.

**Common tokens by chain** - see `../../references/chains.md` for full list:

| Token | Ethereum                                     | Base                                         | Arbitrum                                     |
| ----- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| USDC  | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| WETH  | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `0x4200000000000000000000000000000000000006` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| WBTC  | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | N/A                                          | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` |

For unknown tokens, use web search to find the contract address, then verify on-chain.

### Step 3: Verify Token Contracts (Basic)

**Input Validation (Required Before Any Shell Command):**

Before interpolating user-provided values into any shell command, validate all inputs:

- **Token addresses** MUST match: `^0x[a-fA-F0-9]{40}$`
- **Chain/network names** MUST be from the allowed list in `../../references/chains.md`
- **Amounts** MUST be valid decimal numbers (match: `^[0-9]+\.?[0-9]*$`)
- **Reject** any input containing shell metacharacters (`;`, `|`, `$`, `` ` ``, `&`, `(`, `)`, `>`, `<`, `\`)

Verify token contracts exist on-chain using curl (RPC call):

```bash
# Check if address is a contract using eth_getCode
# IMPORTANT: Validate token_address matches ^0x[a-fA-F0-9]{40}$ before use
curl -s -X POST "$rpc_url" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg addr "$token_address" '{"jsonrpc":"2.0","method":"eth_getCode","params":[$addr,"latest"],"id":1}')" \
  | jq -r '.result'
```

If the result is `0x` or empty, the address is not a valid contract.

**Alternative with cast** (optional, requires [Foundry](https://book.getfoundry.sh/)):

```bash
# Validate token_address matches ^0x[a-fA-F0-9]{40}$ before use
cast code "$token_address" --rpc-url "$rpc_url"
```

**Note:** The curl/RPC method above is preferred for broader compatibility. Only use `cast` if already available in the environment.

**RPC URLs by chain** - see `../../references/chains.md` for full list.

### Step 4: Research (If Needed)

For unfamiliar tokens, use web search to research:

- Token legitimacy and project info
- Recent news or security concerns
- Liquidity availability on Uniswap

Include relevant findings in the summary.

### Step 5: Fetch Price Data

Before generating the deep link, fetch current prices to estimate swap output. See `references/data-providers.md` for full API details.

**Quick price lookup with DexScreener:**

```bash
# Get token price and pool liquidity
curl -s "https://api.dexscreener.com/token-pairs/v1/{network}/{address}" | \
  jq '[.[] | select(.dexId == "uniswap")][0] | {
    price: .priceUsd,
    liquidity: .liquidity.usd,
    volume24h: .volume.h24
  }'
```

**Network IDs:** `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, `unichain`

**Liquidity warnings:**

| Pool TVL    | Risk Level | Action                        |
| ----------- | ---------- | ----------------------------- |
| > $1M       | Low        | Proceed normally              |
| $100k - $1M | Medium     | Note potential slippage       |
| < $100k     | High       | Warn user about slippage risk |

If API is unavailable, fall back to DefiLlama or web search for price estimates.

### Step 6: Generate Deep Link

Construct the Uniswap swap URL:

```text
https://app.uniswap.org/swap?chain={chain}&inputCurrency={input}&outputCurrency={output}&value={amount}&field=INPUT
```

**URL Parameters:**

| Parameter        | Description                  | Values                                                                                                                       |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `chain`          | Network name                 | `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bnb`, `avalanche`, `celo`, `blast`, `zora`, `unichain`, `worldchain` |
| `inputCurrency`  | Input token                  | Address or `NATIVE`                                                                                                          |
| `outputCurrency` | Output token                 | Address or `NATIVE`                                                                                                          |
| `value`          | Amount                       | Decimal number (e.g., `1.5`)                                                                                                 |
| `field`          | Which field value applies to | `INPUT` or `OUTPUT`                                                                                                          |

### Step 7: Present Output and Open Browser

Format the response with:

1. **Summary** of the swap parameters
2. **Deep link** URL (displayed for reference)
3. **Notes** about risks or considerations
4. **Open the browser** automatically using system command

**Example output format:**

```markdown
## Swap Summary

| Parameter        | Value                      |
| ---------------- | -------------------------- |
| From             | 1 ETH                      |
| To               | USDC                       |
| Chain            | Base                       |
| Current Rate     | ~3,200 USDC per ETH        |
| Estimated Output | ~3,200 USDC                |
| Pool Liquidity   | $15.2M (Low slippage risk) |

### Notes

- Final amount depends on current market price
- Default slippage is 0.5% - adjust in Uniswap if needed
- Review all details in Uniswap before confirming

Opening Uniswap in your browser...
```

**After displaying the summary, open the URL in the browser:**

```bash
# Linux
xdg-open "https://app.uniswap.org/swap?chain=base&inputCurrency=NATIVE&outputCurrency=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&value=1&field=INPUT"

# macOS
open "https://app.uniswap.org/swap?..."
```

**Environment limitations:** Browser opening may fail in remote SSH, containerized, or headless environments. If `xdg-open`/`open` fails, display the full URL prominently so users can copy and paste it manually:

```markdown
**[Click here to open in Uniswap](https://app.uniswap.org/swap?...)**

Or copy this URL: `https://app.uniswap.org/swap?...`
```

Always present the summary and URL so users can review and execute.

## Important Considerations

### Slippage

The deep link uses Uniswap's default slippage (0.5%). For volatile tokens or large trades, advise users to adjust slippage in the interface.

### Gas Estimation

Gas costs vary by chain and network congestion. Base and Arbitrum typically have lower gas than Ethereum mainnet.

### Token Verification

Always verify token contracts before generating links. Scam tokens often use similar names to legitimate tokens.

### Price Impact

For large trades, warn users about potential price impact. Suggest splitting into smaller trades if impact would be significant.

## Supported Chains

All chains supported by the Uniswap interface:

- Ethereum Mainnet (`ethereum`)
- Base (`base`)
- Arbitrum One (`arbitrum`)
- Optimism (`optimism`)
- Polygon (`polygon`)
- BNB Chain (`bnb`)
- Avalanche (`avalanche`)
- Celo (`celo`)
- Blast (`blast`)
- Zora (`zora`)
- World Chain (`worldchain`)
- Unichain (`unichain`)

## Additional Resources

### Reference Files

- **`../../references/chains.md`** - Chain IDs, RPC URLs, native tokens, common token addresses
- **`references/data-providers.md`** - DexScreener and DefiLlama APIs for prices and liquidity

### Examples

Common swap scenarios:

- ETH → USDC on Ethereum
- ETH → USDC on Base (lower gas)
- USDC → WBTC on Arbitrum
