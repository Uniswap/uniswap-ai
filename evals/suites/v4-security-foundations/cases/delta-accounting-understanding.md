# Delta Accounting Understanding

You are helping a developer understand Uniswap V4's delta accounting system for their hook implementation.

## Context

The developer is confused about how the PoolManager's credit/debit system works and keeps getting "delta not settled" errors.

Their current code looks like this:

```solidity
function afterSwap(
    address sender,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    BalanceDelta delta,
    bytes calldata hookData
) external override returns (bytes4, int128) {
    // Take tokens from PoolManager
    poolManager.take(key.currency0, address(this), 100);

    // Try to do something with the tokens
    // ...

    return (BaseHook.afterSwap.selector, 0);
}
```

## Questions

1. Explain the core invariant of V4's delta accounting system.
2. What is wrong with the developer's current approach?
3. What is the correct pattern for taking tokens and then settling the resulting debt?
4. What are the common mistakes developers make with delta accounting?

## Requirements

Your response should:

1. Explain the credit/debit system clearly
2. Describe the correct sequence: sync, transfer, settle
3. Identify the specific error in the provided code
4. Provide a corrected code example

## Expected Output

A clear explanation of delta accounting with practical guidance for fixing the developer's code.
