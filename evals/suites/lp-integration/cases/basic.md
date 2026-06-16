# Basic LP Integration Test Case

Build a complete LP integration using the Uniswap LP API.

## Context

- TypeScript/Node.js backend script
- Need to create a concentrated-liquidity v3 position for UNI/USDT on Ethereum mainnet
- Using the Uniswap LP API (not the SDK)
- Have a private key for signing

## Requirements

1. Check token approval status via /lp/check_approval endpoint
2. Create a v3 position via /lp/create endpoint with a price range and one token amount
3. Include the x-api-key header on every request
4. Validate the returned transaction before broadcasting
5. Display the adjusted price range to the user (not the original input)

## Constraints

- Must use the Uniswap LP API (https://liquidity.api.uniswap.org)
- Must follow the approval -> create flow
- Must validate transaction data is non-empty before broadcasting
- API key must come from an environment variable, never hardcoded
- Should include error handling for API failures

## Expected Output

A working TypeScript implementation that demonstrates the complete LP API create flow with proper approval handling, pre-broadcast validation, and display of adjusted price bounds.
