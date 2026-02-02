# Hook Implementations

## Table of Contents

- [Generic Aggregator Hook (Proposal #1)](#generic-aggregator-hook-proposal-1)
- [Off-Chain Integration (TypeScript/viem)](#off-chain-integration)
- [Test Suite](#test-suite)

---

## Generic Aggregator Hook (Proposal #1)

A single hook that accepts encoded external calls via hookData. All routing logic is computed off-chain.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

struct ExternalAction {
    address to;
    uint256 value;
    bytes data;
}

contract GenericAggregatorHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    // Routing analytics
    mapping(PoolId => uint256) public v4Volume;
    mapping(PoolId => uint256) public externalVolume;

    // Events
    event RouteDecision(
        PoolId indexed poolId,
        bool routedToExternal,
        uint256 amount
    );

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,   // For analytics tracking
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        if (hookData.length == 0) {
            // No external routing, proceed with V4
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // Decode external actions from hookData
        ExternalAction[] memory actions = abi.decode(hookData, (ExternalAction[]));

        // Execute each external action
        for (uint256 i = 0; i < actions.length; i++) {
            (bool success, ) = actions[i].to.call{value: actions[i].value}(actions[i].data);
            require(success, "External call failed");
        }

        BeforeSwapDelta delta = _calculateDelta(key, params);
        return (this.beforeSwap.selector, delta, 0);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        bool routedExternal = hookData.length > 0;

        uint256 amount = params.amountSpecified > 0
            ? uint256(params.amountSpecified)
            : uint256(-params.amountSpecified);

        if (routedExternal) {
            externalVolume[poolId] += amount;
        } else {
            v4Volume[poolId] += amount;
        }

        emit RouteDecision(poolId, routedExternal, amount);
        return (this.afterSwap.selector, 0);
    }

    /// @notice Calculate the balance delta for external routing
    /// @dev Implementation depends on your routing strategy. This is a placeholder.
    function _calculateDelta(
        PoolKey calldata, /* key */
        IPoolManager.SwapParams calldata /* params */
    ) internal pure returns (BeforeSwapDelta) {
        // TODO: Implement based on external swap results
        // For pass-through to V4, return ZERO_DELTA
        // For full external routing, calculate actual token deltas
        return BeforeSwapDeltaLibrary.ZERO_DELTA;
    }

    receive() external payable {}
}
```

---

## Off-Chain Integration

### Encoding hookData (TypeScript/viem)

```typescript
import { encodeAbiParameters, parseAbiParameters } from 'viem';

interface ExternalAction {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
}

function encodeHookData(actions: ExternalAction[]): `0x${string}` {
  return encodeAbiParameters(parseAbiParameters('(address to, uint256 value, bytes data)[]'), [
    actions.map((a) => ({ to: a.to, value: a.value, data: a.data })),
  ]);
}

// Example: Encode a Curve swap
function encodeCurveSwap(
  poolAddress: `0x${string}`,
  i: number,
  j: number,
  dx: bigint,
  minDy: bigint
): ExternalAction {
  const data = encodeAbiParameters(parseAbiParameters('int128, int128, uint256, uint256'), [
    BigInt(i),
    BigInt(j),
    dx,
    minDy,
  ]);
  const selector = '0x3df02124'; // exchange(int128,int128,uint256,uint256)
  return {
    to: poolAddress,
    value: 0n,
    data: (selector + data.slice(2)) as `0x${string}`,
  };
}
```

---

## Test Suite

### Local Testing with Foundry

```solidity
// test/AggregatorHook.t.sol
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {GenericAggregatorHook} from "../src/GenericAggregatorHook.sol";

contract AggregatorHookTest is Test, Deployers {
    GenericAggregatorHook hook;

    function setUp() public {
        deployFreshManagerAndRouters();
        hook = new GenericAggregatorHook(manager);
        (key, ) = initPool(currency0, currency1, hook, 3000, SQRT_PRICE_1_1, ZERO_BYTES);
    }

    function test_curveSwapViaHook() public {
        ExternalAction[] memory actions = new ExternalAction[](1);
        actions[0] = ExternalAction({
            to: address(mockCurvePool),
            value: 0,
            data: abi.encodeCall(ICurvePool.exchange, (0, 1, 1e18, 0))
        });
        bytes memory hookData = abi.encode(actions);
        swap(key, true, 1e18, hookData);
    }

    function test_volumeTracking() public {
        // Swap without external routing
        swap(key, true, 1e18, "");
        assertEq(hook.v4Volume(key.toId()), 1e18);
        assertEq(hook.externalVolume(key.toId()), 0);
    }
}
```

### Test Coverage Checklist

1. **Basic routing**: Correct routing based on hookData presence
2. **Edge cases**: Zero liquidity, equal prices, empty hookData
3. **Analytics**: Volume tracking accuracy for both V4 and external
4. **Failures**: External DEX unavailable, malformed hookData
5. **Gas**: Acceptable gas consumption for multi-action swaps

### Mainnet Fork Testing

```bash
# Fork mainnet and test against real Curve pool
forge test --fork-url $ETH_RPC_URL --match-test test_curveSwapViaHook -vvv
```
