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
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";

struct ExternalAction {
    address to;
    uint256 value;
    bytes data;
}

contract GenericAggregatorHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    address public owner;
    mapping(address => bool) public allowedTargets;

    // Routing analytics
    mapping(PoolId => uint256) public v4Volume;
    mapping(PoolId => uint256) public externalVolume;

    // Events
    event RouteDecision(
        PoolId indexed poolId,
        bool routedToExternal,
        uint256 amount
    );

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {
        owner = msg.sender;
    }

    function setAllowedTarget(address target, bool allowed) external {
        require(msg.sender == owner, "Not owner");
        allowedTargets[target] = allowed;
    }

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
            // No external routing, proceed with v4
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // Decode external actions from hookData
        ExternalAction[] memory actions = abi.decode(hookData, (ExternalAction[]));

        // Execute each external action
        for (uint256 i = 0; i < actions.length; i++) {
            require(allowedTargets[actions[i].to], "Target not allowed");
            (bool success, bytes memory result) = actions[i].to.call{value: actions[i].value}(actions[i].data);
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
    /// @dev When routing externally, the hook tells PoolManager it handled the swap
    ///      by returning a delta equal to the specified amount. This prevents
    ///      PoolManager from also executing the swap in the V4 pool.
    ///
    /// Token flow for external routing:
    ///   1. User sends tokens to PoolManager (via router)
    ///   2. Hook takes tokens from PoolManager (via take())
    ///   3. Hook swaps on external DEX
    ///   4. Hook returns output tokens to PoolManager (via settle())
    ///   5. PoolManager sends output tokens to user (via router)
    function _calculateDelta(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params
    ) internal returns (BeforeSwapDelta) {
        // The specified amount is what the user wants to swap
        // For EXACT_INPUT (amountSpecified < 0): we take the input tokens
        // For EXACT_OUTPUT (amountSpecified > 0): we provide the output tokens
        int128 specifiedAmount = int128(params.amountSpecified);

        // Return a delta claiming the hook handled the specified amount
        // This tells PoolManager: "I handled this swap, don't execute it in the pool"
        // First param = specified token delta, Second param = unspecified token delta
        return toBeforeSwapDelta(specifiedAmount, 0);
    }

    receive() external payable {
        require(msg.sender == owner || allowedTargets[msg.sender], "Unauthorized ETH sender");
    }
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
import {GenericAggregatorHook, ExternalAction} from "../src/GenericAggregatorHook.sol";

interface ICurvePool {
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256);
}

contract MockCurvePool is ICurvePool {
    function exchange(int128, int128, uint256 dx, uint256) external pure returns (uint256) {
        return dx; // 1:1 mock exchange
    }
}

contract AggregatorHookTest is Test, Deployers {
    GenericAggregatorHook hook;
    MockCurvePool mockCurvePool;

    function setUp() public {
        deployFreshManagerAndRouters();
        hook = new GenericAggregatorHook(manager);
        (key, ) = initPool(currency0, currency1, hook, 3000, SQRT_PRICE_1_1, ZERO_BYTES);
        mockCurvePool = new MockCurvePool();
        hook.setAllowedTarget(address(mockCurvePool), true);
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

    function test_noExternalRouting() public {
        // Swap without external routing — should use V4 pool
        swap(key, true, 1e18, "");
        assertEq(hook.v4Volume(key.toId()), 1e18);
        assertEq(hook.externalVolume(key.toId()), 0);
    }

    function test_volumeTracking() public {
        // Swap with external routing
        ExternalAction[] memory actions = new ExternalAction[](1);
        actions[0] = ExternalAction({
            to: address(mockCurvePool),
            value: 0,
            data: abi.encodeCall(ICurvePool.exchange, (0, 1, 1e18, 0))
        });
        swap(key, true, 1e18, abi.encode(actions));
        assertEq(hook.externalVolume(key.toId()), 1e18);
    }

    function test_unauthorizedTargetReverts() public {
        address unauthorized = makeAddr("unauthorized");
        ExternalAction[] memory actions = new ExternalAction[](1);
        actions[0] = ExternalAction({to: unauthorized, value: 0, data: ""});
        vm.expectRevert("Target not allowed");
        swap(key, true, 1e18, abi.encode(actions));
    }
}
```

### Test Coverage Checklist

1. **Basic routing**: Correct routing based on hookData presence
2. **Edge cases**: Zero liquidity, equal prices, empty hookData
3. **Analytics**: Volume tracking accuracy for both v4 and external
4. **Failures**: External DEX unavailable, malformed hookData
5. **Gas**: Acceptable gas consumption for multi-action swaps

### Mainnet Fork Testing

```bash
# Fork mainnet and test against real Curve pool
forge test --fork-url $ETH_RPC_URL --match-test test_curveSwapViaHook -vvv
```
