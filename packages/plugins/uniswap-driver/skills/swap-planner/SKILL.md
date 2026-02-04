---
name: swap-planner
description: This skill should be used when the user asks to "swap tokens", "trade ETH for USDC", "exchange tokens on Uniswap", "buy tokens", "sell tokens", "convert ETH to stablecoins", or mentions swapping, trading, or exchanging tokens on any Uniswap-supported chain. Generates deep links to execute swaps in the Uniswap interface.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), Bash(xdg-open:*), Bash(open:*), WebFetch, WebSearch, Task(subagent_type:Explore)
model: sonnet
---

# Swap Planning

Plan and generate deep links for token swaps on Uniswap across all supported chains.

## Overview

Plan token swaps by:

1. Gathering swap intent (tokens, amounts, chain)
2. Verifying token contracts on-chain
3. Researching tokens via web search when needed
4. Generating a deep link that opens in the Uniswap interface with parameters pre-filled

The generated link opens Uniswap with all parameters ready for execution.

## Workflow

### Step 1: Gather Swap Intent

Extract from the user's request:

| Parameter | Required | Example |
|-----------|----------|---------|
| Input token | Yes | ETH, USDC, token address |
| Output token | Yes | USDC, WBTC, token address |
| Amount | Yes | 1.5 ETH, $500 worth |
| Chain | Yes (default: Ethereum) | Base, Arbitrum, etc. |

If any required parameter is missing, ask the user to clarify.

### Step 2: Resolve Token Addresses

For token symbols, resolve to addresses using known tokens or web search:

**Native tokens**: Use `NATIVE` as the address parameter.

**Common tokens by chain** - see `references/chains.md` for full list:

| Token | Ethereum | Base | Arbitrum |
|-------|----------|------|----------|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `0x4200000000000000000000000000000000000006` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | N/A | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` |

For unknown tokens, use web search to find the contract address, then verify on-chain.

### Step 3: Verify Token Contracts (Basic)

Verify token contracts exist on-chain using curl (RPC call):

```bash
# Check if address is a contract using eth_getCode
curl -s -X POST <rpc_url> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["<token_address>","latest"],"id":1}' \
  | jq -r '.result'
```

If the result is `0x` or empty, the address is not a valid contract.

**Alternative with cast** (if Foundry is installed):

```bash
cast code <token_address> --rpc-url <rpc_url>
```

**RPC URLs by chain** - see `references/chains.md` for full list.

### Step 4: Research (If Needed)

For unfamiliar tokens, use web search to research:

- Token legitimacy and project info
- Recent news or security concerns
- Liquidity availability on Uniswap

Include relevant findings in the summary.

### Step 5: Generate Deep Link

Construct the Uniswap swap URL:

```text
https://app.uniswap.org/swap?chain={chain}&inputCurrency={input}&outputCurrency={output}&value={amount}&field=INPUT
```

**URL Parameters:**

| Parameter | Description | Values |
|-----------|-------------|--------|
| `chain` | Network name | `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bnb`, `avalanche`, `celo`, `blast`, `zora` |
| `inputCurrency` | Input token | Address or `NATIVE` |
| `outputCurrency` | Output token | Address or `NATIVE` |
| `value` | Amount | Decimal number (e.g., `1.5`) |
| `field` | Which field value applies to | `INPUT` or `OUTPUT` |

### Step 6: Present Output and Open Browser

Format the response with:

1. **Summary** of the swap parameters
2. **Deep link** URL (displayed for reference)
3. **Notes** about risks or considerations
4. **Open the browser** automatically using system command

**Example output format:**

```markdown
## Swap Summary

| Parameter | Value |
|-----------|-------|
| From | 1 ETH |
| To | USDC |
| Chain | Base |
| Estimated Output | ~3,200 USDC |

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

Always open the browser after presenting the summary so users can review and execute.

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

## Additional Resources

### Reference Files

For detailed chain information and token addresses:

- **`references/chains.md`** - Chain IDs, RPC URLs, native tokens, common token addresses

### Examples

Common swap scenarios:

- ETH → USDC on Ethereum
- ETH → USDC on Base (lower gas)
- USDC → WBTC on Arbitrum
