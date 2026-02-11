# Smart Account Swap Integration Test Case

Build a swap integration that executes through an ERC-4337 smart account on Base.

## Context

- TypeScript/Node.js backend service
- Need to swap USDC to ETH on Base (chain ID 8453)
- Using the Uniswap Trading API through an ERC-4337 smart account
- The smart account uses delegation for executing swaps
- After swap, ETH should be native ETH (not WETH)

## Requirements

1. Get swap calldata from Trading API (3-step flow)
2. Wrap swap calldata in a delegation redemption execution
3. Submit via bundler as a UserOperation
4. Handle WETH unwrapping after swap (Base often returns WETH instead of native ETH)
5. Implement rate limiting with exponential backoff for API calls
6. Use legacy approval (direct to Universal Router) instead of Permit2

## Constraints

- Must use viem for all blockchain interactions
- Must handle the Trading API 3-step flow correctly
- Must explain the approval target choice (legacy vs Permit2 for smart accounts)
- Must include WETH detection and unwrap logic for L2
- Must include retry logic with exponential backoff for 429 responses
- Should include error handling for bundler-specific errors

## Expected Output

A working TypeScript implementation that demonstrates executing Uniswap swaps through an ERC-4337 smart account with delegation, including L2 WETH handling and rate limiting.
