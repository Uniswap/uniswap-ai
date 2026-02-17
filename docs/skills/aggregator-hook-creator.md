---
title: Aggregator Hook Creator
order: 2
---

# Aggregator Hook Creator

Create custom aggregator hooks for Uniswap V4 that route through multiple liquidity sources.

## Invocation

```text
/aggregator-hook-creator
```

Or describe your requirements naturally:

```text
Create a hook that compares prices between Uniswap v4 and an external DEX
```

## What It Does

This skill helps you create hooks that:

- **Compare liquidity sources**: Check prices across v4 pools and external DEXs
- **Optimize routing**: Route swaps to the best execution venue
- **Track analytics**: Monitor routing decisions and volume
- **Handle edge cases**: Manage slippage, zero liquidity, and failures

## Example Outputs

### Basic Aggregator Hook

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";

/// @title AggregatorHook
/// @notice Routes swaps through the best liquidity source
contract AggregatorHook is BaseHook {
    IExternalDEX public immutable externalDEX;

    event RouteDecision(
        bytes32 indexed poolId,
        bool routedToExternal,
        uint256 v4Price,
        uint256 externalPrice
    );

    constructor(
        IPoolManager _poolManager,
        IExternalDEX _externalDEX
    ) BaseHook(_poolManager) {
        externalDEX = _externalDEX;
    }

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Get prices from both sources
        uint256 v4Price = getV4Price(key);
        uint256 externalPrice = externalDEX.getPrice(
            key.currency0,
            key.currency1
        );

        // Compare and decide routing
        bool routeToExternal = shouldRouteExternal(
            v4Price,
            externalPrice,
            params.zeroForOne
        );

        emit RouteDecision(
            key.toId(),
            routeToExternal,
            v4Price,
            externalPrice
        );

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    // ... additional implementation
}
```

## Configuration Options

When invoking the skill, you can specify:

| Option       | Description                      | Default     |
| ------------ | -------------------------------- | ----------- |
| Pool pair    | Token pair for the hook          | WETH/USDC   |
| External DEX | Which external source to compare | Mock DEX    |
| Fee tier     | Uniswap V4 fee tier              | 3000 (0.3%) |
| Chain        | Target deployment chain          | Ethereum    |

## Best Practices

The skill follows these best practices:

1. **Security**: No reentrancy vulnerabilities, validated inputs
2. **Gas efficiency**: Minimal storage, optimized comparisons
3. **Maintainability**: Clear naming, comprehensive NatSpec
4. **Testing**: Generates accompanying test suggestions

## Related Resources

- [v4 Hooks Overview](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Hook Permissions](https://docs.uniswap.org/contracts/v4/concepts/hook-permissions)
- [BaseHook Contract](https://github.com/Uniswap/v4-periphery/blob/main/src/base/hooks/BaseHook.sol)
