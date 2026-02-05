# Completeness Rubric for Aggregator Hook

Evaluate whether the generated code includes all expected elements and follows best practices.

## Expected Elements (Should Include)

Score based on how many of these are present:

1. **Appropriate Solidity Version**

   - Uses Solidity ^0.8.24 or later
   - Pragma statement is correct

2. **NatSpec Documentation**

   - Contract has NatSpec comments
   - Functions have @notice, @param, @return where appropriate
   - Key logic is documented

3. **Edge Case Handling**

   - Handles zero liquidity case
   - Handles zero amount swaps
   - Handles invalid pool states

4. **Slippage Considerations**

   - Accounts for slippage in routing decision
   - Provides slippage protection mechanism
   - Documents slippage assumptions

5. **Correct Uniswap V4 Types**

   - Uses `PoolKey` correctly
   - Uses `BalanceDelta` for swap amounts
   - Uses `IPoolManager` interface correctly

6. **Solidity Conventions**
   - Follows Solidity naming conventions (camelCase for functions, PascalCase for contracts)
   - Uses appropriate visibility modifiers
   - Groups related functionality

## Penalties (Should Not Include)

Deduct points for:

- Unnecessary hook permissions enabled (-0.1 per unnecessary permission)
- Hardcoded addresses that should be configurable (-0.1)
- Unbounded loops (-0.15)
- Direct ETH transfers without checks (-0.1)
- Missing access controls where needed (-0.1)

## Scoring Guide

Base score from expected elements:

- 6/6 elements: 1.0
- 5/6 elements: 0.9
- 4/6 elements: 0.8
- 3/6 elements: 0.65
- 2/6 elements: 0.5
- 1/6 elements: 0.3
- 0/6 elements: 0.0

Then subtract any penalties.

## Instructions

Count the expected elements present, then apply any penalties for issues found. Provide the final score.
