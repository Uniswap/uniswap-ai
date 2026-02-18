# Hook Implementations

## Table of Contents

- [Generic Aggregator Hook (Proposal #1)](#generic-aggregator-hook-proposal-1)
- [Protocol-Specific Hook (Proposal #2): CurveAggregatorHook](#protocol-specific-hook-proposal-2-curveaggregatorhook)
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

## Protocol-Specific Hook (Proposal #2): CurveAggregatorHook

A dedicated hook for routing swaps through a specific Curve pool. All routing logic lives on-chain — the off-chain caller only needs to pass a minimum output amount via `hookData`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/base/hooks/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "v4-core/src/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

interface ICurvePool {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256 dy);

    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);
}

/// @title CurveAggregatorHook
/// @notice Routes swaps through a specific Curve pool when hookData is provided.
///         When hookData is empty, the swap proceeds through the v4 pool as normal.
/// @dev Uses beforeSwapReturnDelta to claim the swap when routing externally.
///      See v4-security-foundations for NoOp attack context.
contract CurveAggregatorHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    ICurvePool public immutable curvePool;
    int128 public immutable curveIndexI; // Curve pool index for token0
    int128 public immutable curveIndexJ; // Curve pool index for token1

    // Analytics
    mapping(PoolId => uint256) public v4Volume;
    mapping(PoolId => uint256) public curveVolume;

    event RouteDecision(
        PoolId indexed poolId,
        bool routedToCurve,
        uint256 amount
    );

    constructor(
        IPoolManager _poolManager,
        address _curvePool,
        int128 _indexI,
        int128 _indexJ
    ) BaseHook(_poolManager) {
        curvePool = ICurvePool(_curvePool);
        curveIndexI = _indexI;
        curveIndexJ = _indexJ;
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
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Routes the swap to Curve when hookData is non-empty.
    /// @dev hookData encodes (uint256 minAmountOut).
    ///      Token flow:
    ///        1. take() input tokens from PoolManager
    ///        2. Approve & swap on Curve
    ///        3. sync() + transfer + settle() output tokens back to PoolManager
    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        if (hookData.length == 0) {
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        uint256 minAmountOut = abi.decode(hookData, (uint256));

        // Determine swap direction and amounts
        // Uniswap v4 convention: negative amountSpecified = exact input,
        // positive amountSpecified = exact output
        bool zeroForOne = params.zeroForOne;
        uint256 amountIn = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)  // exact input
            : uint256(params.amountSpecified);  // exact output

        Currency inputCurrency = zeroForOne ? key.currency0 : key.currency1;
        Currency outputCurrency = zeroForOne ? key.currency1 : key.currency0;
        int128 i = zeroForOne ? curveIndexI : curveIndexJ;
        int128 j = zeroForOne ? curveIndexJ : curveIndexI;

        // 1. Take input tokens from PoolManager
        poolManager.take(inputCurrency, address(this), amountIn);

        // 2. Approve and swap on Curve
        address inputToken = Currency.unwrap(inputCurrency);
        IERC20(inputToken).approve(address(curvePool), amountIn);
        uint256 amountOut = curvePool.exchange(i, j, amountIn, minAmountOut);
        // Note: Curve's exchange() reverts internally if amountOut < min_dy,
        // so no additional slippage check is needed here.

        // 3. Settle output tokens back to PoolManager
        address outputToken = Currency.unwrap(outputCurrency);
        poolManager.sync(outputCurrency);
        IERC20(outputToken).transfer(address(poolManager), amountOut);
        poolManager.settle(outputCurrency);

        // Build delta: tell PoolManager we handled the swap
        // specified = input consumed, unspecified = output provided (always negative)
        int128 specifiedDelta = int128(params.amountSpecified);
        int128 unspecifiedDelta = -int128(int256(amountOut));

        BeforeSwapDelta delta = toBeforeSwapDelta(specifiedDelta, unspecifiedDelta);
        return (this.beforeSwap.selector, delta, 0);
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        uint256 amount = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        if (hookData.length > 0) {
            curveVolume[poolId] += amount;
        } else {
            v4Volume[poolId] += amount;
        }

        emit RouteDecision(poolId, hookData.length > 0, amount);
        return (this.afterSwap.selector, 0);
    }
}
```

**Key differences from the Generic Hook:**

| Aspect               | Generic Hook              | CurveAggregatorHook           |
| -------------------- | ------------------------- | ----------------------------- |
| **External calls**   | Arbitrary (via hookData)  | Only Curve `exchange()`       |
| **hookData format**  | `ExternalAction[]`        | `uint256 minAmountOut`        |
| **Token settlement** | Left to caller            | Built-in `take` / `settle`    |
| **Allowlisting**     | Required for safety       | Not needed (immutable target) |
| **Gas cost**         | Higher (dynamic dispatch) | Lower (direct call)           |
| **Auditability**     | Harder (open-ended)       | Simpler (fixed interaction)   |

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
