# Token Discovery

What memecoins are trending on Base right now? I want to find something interesting to buy.

## Context

- The user wants to discover tokens, not swap a known token
- They are interested in memecoins specifically
- They want to trade on Base chain
- They need help finding and evaluating tokens before swapping

## Requirements

1. Use DexScreener or similar data providers to find trending tokens
2. Present token options with relevant metrics (price, volume, liquidity)
3. Verify token contracts on-chain before recommending
4. After selection, generate a Uniswap deep link for the swap

## Expected Output

A response that searches for trending memecoins on Base, presents options with liquidity and volume data, and offers to generate a swap deep link.
