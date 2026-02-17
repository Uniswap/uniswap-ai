# V4 Liquidity Position

I want to create a V4 liquidity position for WBTC/ETH on Base. What are the options?

## Context

- The user wants to create a Uniswap V4 position
- Token pair: WBTC/ETH on Base chain
- Amount is not specified
- They want to understand V4-specific features

## Requirements

1. Verify WBTC and ETH addresses on Base
2. Explain V4-specific features relevant to LP positions (hooks, dynamic fees)
3. Check available pool configurations and hook options
4. Generate a Uniswap deep link for the V4 position (omit the amount — generate the link without it so the user can fill it in the UI)
5. Handle the missing amount gracefully by generating the link anyway

## Expected Output

A response that explains V4 LP features, verifies token addresses on Base, and generates a clickable Uniswap deep link (app.uniswap.org) for creating a V4 position. The link should work even without a deposit amount specified.
