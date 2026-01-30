---
description: Create aggregator hooks for Uniswap V4 that route swaps through multiple liquidity sources. Use when user says "create aggregator hook", "route through multiple DEXs", "compare liquidity sources", "build a hook that checks external prices", or "aggregate liquidity for swaps".
allowed-tools: Read, Glob, Grep, LS, WebSearch, WebFetch, Write(*.sol), Write(*.t.sol), Bash(forge build:*), Bash(forge test:*)
model: opus
---

# Aggregator Hook Creator

Create custom aggregator hooks for Uniswap V4 that route swaps through multiple liquidity sources for optimal execution.

## When to Activate

- User wants to create a hook that aggregates liquidity
- User asks about routing swaps through multiple sources
- User wants to compare prices across DEXs
- User needs a hook that checks external liquidity before executing

## Quick Process

1. **Understand Requirements**: Gather details about the aggregation strategy
2. **Design Hook**: Plan the hook permissions and callback implementations
3. **Generate Code**: Create the Solidity contract with best practices
4. **Add Tests**: Generate comprehensive Foundry tests
5. **Review Security**: Check for common vulnerabilities

## Hook Capabilities

### Supported Patterns

| Pattern | Description | Callbacks |
|---------|-------------|-----------|
| **Price Comparison** | Compare V4 price with external source | `beforeSwap` |
| **Split Routing** | Split orders across multiple venues | `beforeSwap`, `afterSwap` |
| **Fallback Routing** | Route to external if V4 liquidity is low | `beforeSwap` |
| **Analytics** | Track routing decisions and volume | `afterSwap` |

### Recommended Callbacks

For most aggregator hooks:

```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeInitialize: false,
        afterInitialize: false,
        beforeAddLiquidity: false,
        afterAddLiquidity: false,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false,
        beforeSwap: true,  // Check external prices
        afterSwap: true,   // Log routing decisions
        beforeDonate: false,
        afterDonate: false,
        beforeSwapReturnDelta: false,
        afterSwapReturnDelta: false,
        afterAddLiquidityReturnDelta: false,
        afterRemoveLiquidityReturnDelta: false
    });
}
```

## Implementation Guide

### Base Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";

/// @title AggregatorHook
/// @notice Routes swaps through optimal liquidity source
/// @dev Compares V4 pool prices with external sources
contract AggregatorHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    // External DEX interface
    IExternalDEX public immutable externalDEX;

    // Routing analytics
    mapping(PoolId => uint256) public v4Volume;
    mapping(PoolId => uint256) public externalVolume;

    // Events
    event RouteDecision(
        PoolId indexed poolId,
        bool routedToExternal,
        uint256 amount,
        uint256 v4Price,
        uint256 externalPrice
    );

    constructor(
        IPoolManager _poolManager,
        IExternalDEX _externalDEX
    ) BaseHook(_poolManager) {
        externalDEX = _externalDEX;
    }

    // Implementation continues...
}
```

### External DEX Interface

```solidity
/// @title IExternalDEX
/// @notice Interface for external liquidity sources
interface IExternalDEX {
    /// @notice Get the current price for a token pair
    /// @param tokenIn Input token address
    /// @param tokenOut Output token address
    /// @return price Current price (tokenOut per tokenIn, scaled by 1e18)
    function getPrice(address tokenIn, address tokenOut) external view returns (uint256 price);

    /// @notice Check available liquidity
    /// @param tokenIn Input token address
    /// @param tokenOut Output token address
    /// @return liquidity Available liquidity in tokenOut
    function getLiquidity(address tokenIn, address tokenOut) external view returns (uint256 liquidity);

    /// @notice Execute a swap on the external DEX
    /// @param tokenIn Input token address
    /// @param tokenOut Output token address
    /// @param amountIn Amount of tokenIn to swap
    /// @param minAmountOut Minimum acceptable output
    /// @return amountOut Actual output received
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
}
```

## Security Considerations

### Must Validate

1. **External call safety**: Verify external DEX responses
2. **Price manipulation**: Don't trust single-block prices for large amounts
3. **Reentrancy**: Use appropriate guards for external calls
4. **Slippage**: Respect user-specified slippage parameters

### Must Avoid

1. **Unbounded loops**: Can cause out-of-gas
2. **Hardcoded addresses**: Use constructor parameters
3. **Direct ETH handling**: Use WETH wrapper
4. **Unchecked arithmetic**: Use Solidity 0.8.x checked math

## Test Coverage

Generate tests covering:

1. **Basic routing**: Correct routing based on prices
2. **Edge cases**: Zero liquidity, equal prices
3. **Analytics**: Volume tracking accuracy
4. **Failures**: External DEX unavailable
5. **Gas**: Acceptable gas consumption

## Example Usage

```text
User: Create a hook that routes to the DEX with better price

Claude: I'll create an aggregator hook that:
1. Checks V4 pool price in beforeSwap
2. Compares with external DEX price
3. Emits routing decision event
4. Tracks volume analytics in afterSwap

[Generates complete implementation with tests]
```

## References

- [Uniswap V4 Hooks](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Hook Permissions](https://docs.uniswap.org/contracts/v4/concepts/hook-permissions)
- [BaseHook Contract](https://github.com/Uniswap/v4-periphery/blob/main/src/base/hooks/BaseHook.sol)
