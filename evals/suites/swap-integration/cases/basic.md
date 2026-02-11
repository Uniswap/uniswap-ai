# Basic Swap Integration Test Case

Build a complete swap integration using the Uniswap Trading API.

## Context

- TypeScript/Node.js backend script
- Need to swap USDC to ETH on Ethereum mainnet
- Using the Uniswap Trading API (not SDK)
- Have a private key for signing

## Requirements

1. Check token approval status via /check_approval endpoint
2. Get a quote via /quote endpoint with proper parameters
3. Execute the swap via /swap endpoint with correct request body format
4. Handle Permit2 fields correctly (strip null permitData)
5. Validate swap response before broadcasting

## Constraints

- Must use the Uniswap Trading API (<https://trade-api.gateway.uniswap.org/v1>)
- Must handle the 3-step flow: check_approval -> quote -> swap
- Must strip null permitData fields from the swap request
- Must validate swap.data is non-empty before broadcasting
- Should include error handling for API failures

## Expected Output

A working TypeScript implementation that demonstrates the complete Trading API swap flow with proper null field handling, Permit2 rules, and pre-broadcast validation.
