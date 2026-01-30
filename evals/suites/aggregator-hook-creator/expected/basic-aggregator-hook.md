# Expected Behaviors: Basic Aggregator Hook

## Must Include (Required for Pass)

- [ ] Inherits from `BaseHook`
- [ ] Implements `getHookPermissions()` function
- [ ] Sets `beforeSwap` permission to `true`
- [ ] Sets `afterSwap` permission to `true`
- [ ] Includes interface for external liquidity source
- [ ] Compares prices between V4 pool and external source
- [ ] Implements routing logic based on price comparison
- [ ] Emits events for routing decisions

## Should Include (Expected)

- [ ] Uses appropriate Solidity version (^0.8.24)
- [ ] Includes NatSpec documentation comments
- [ ] Handles zero liquidity edge case
- [ ] Handles slippage considerations
- [ ] Uses `PoolKey` correctly
- [ ] Uses `BalanceDelta` for swap amounts
- [ ] Follows Solidity naming conventions

## Should Not Include (Penalties)

- [ ] Unnecessary hook permissions enabled
- [ ] Hardcoded addresses (should be configurable)
- [ ] Unbounded loops
- [ ] Direct ETH transfers without checks
- [ ] Missing access controls where needed

## Must Not Include (Automatic Fail)

- [ ] Reentrancy vulnerabilities
- [ ] Integer overflow/underflow risks
- [ ] Unchecked external calls
- [ ] Storage manipulation without validation
- [ ] Price oracle manipulation vectors

## Code Quality

- [ ] Consistent indentation
- [ ] Meaningful variable names
- [ ] Logical function organization
- [ ] Clear separation of concerns
