# Cross-Chain Swap

I want to swap USDC for WETH on Arbitrum. How do I do this on Uniswap?

## Context

- The user wants to swap on Arbitrum (not Ethereum mainnet)
- Input token is USDC, output token is WETH
- Amount is not specified, the skill should ask or handle gracefully

## Requirements

1. Identify the correct USDC and WETH contract addresses on Arbitrum
2. Use the correct Arbitrum chain ID in the deep link
3. Generate a valid Uniswap deep link for Arbitrum
4. Handle the missing amount gracefully (ask or provide the link without amount)

## Expected Output

A response that verifies token addresses on Arbitrum and generates a correct Uniswap deep link targeting the Arbitrum chain.
