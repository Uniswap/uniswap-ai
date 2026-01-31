---
description: Integrate external DEX liquidity into Uniswap V4 via Aggregator Hooks. Use when user says "aggregator hook", "external liquidity", "wrap Curve/Balancer/Aerodrome", "route through external DEX", "V4 hook for non-Uniswap pools", "compare liquidity sources", or mentions integrating third-party AMM liquidity into Uniswap routing.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(forge:*), Bash(cast:*), Bash(curl:*), WebFetch, Task(subagent_type:Explore)
model: opus
---

# Aggregator Hook Integration

Integrate external DEX liquidity (Curve, Balancer, Aerodrome, etc.) into Uniswap V4 routing via Aggregator Hooks.

## Overview

Aggregator Hooks are Uniswap V4 hooks that wrap non-Uniswap pools, allowing the Uniswap router to include external liquidity sources. This improves execution quality by routing through the best available liquidity across multiple protocols.

## Prerequisites

This skill assumes familiarity with:

- viem Integration - EVM basics
- Swap Integration - Uniswap swap patterns
- Uniswap V4 hook architecture basics

## Quick Decision Guide

| Building...                        | Use This Approach                    |
| ---------------------------------- | ------------------------------------ |
| Single protocol (e.g., just Curve) | Protocol-Specific Hook (Proposal #2) |
| Multi-protocol aggregation         | Generic Hook (Proposal #1)           |
| Quick PoC / testing                | Generic Hook with hardcoded calls    |
| Production deployment at scale     | Protocol-Specific Hooks              |

## Supported Patterns

| Pattern              | Description                              | Callbacks                 |
| -------------------- | ---------------------------------------- | ------------------------- |
| **Price Comparison** | Compare V4 price with external source    | `beforeSwap`              |
| **Split Routing**    | Split orders across multiple venues      | `beforeSwap`, `afterSwap` |
| **Fallback Routing** | Route to external if V4 liquidity is low | `beforeSwap`              |
| **Analytics**        | Track routing decisions and volume       | `afterSwap`               |

---

## Hook Architecture

### Proposal #1: Generic Hook (Single Deployment)

A single hook that accepts encoded external calls via hookData. All routing logic is computed off-chain.

```solidity
struct ExternalAction {
    address to;      // Target contract (e.g., Curve pool)
    uint256 value;   // ETH value to send
    bytes data;      // Encoded function call
}

// hookData = abi.encode(ExternalAction[])
```

**When to use**: Rapid prototyping, maximum flexibility, don't want to deploy new contracts for each protocol.

**Pros**: Deploy once (supports any protocol), future-proof, less smart contract development.

**Cons**: More complex off-chain integration, larger calldata, harder to index on-chain.

### Proposal #2: Protocol-Specific Hooks (One Per DEX)

Dedicated hooks for each external protocol. The hook knows how to interact with its target DEX.

```solidity
// CurveAggregatorHook.sol
contract CurveAggregatorHook is BaseHook {
    ICurvePool public immutable curvePool;

    function beforeSwap(...) external override {
        // Encode Curve-specific swap call from SwapParams
        curvePool.exchange(i, j, dx, min_dy);
    }
}
```

**When to use**: Production deployments, optimized gas usage, simpler off-chain integration.

**Pros**: Simpler off-chain logic, less calldata, easier to audit.

**Cons**: Deploy new hook per pool/protocol, more smart contract development, must add explicit support for each DEX.

---

## Protocol Compatibility Matrix

| Protocol      | Extra Hops | Callback? | Replaces Router? | Unique Pools? |
| ------------- | ---------- | --------- | ---------------- | ------------- |
| Curve         | 0          | No        | Yes              | No            |
| Aerodrome     | 0          | No        | Yes              | Yes           |
| Balancer      | 1          | No        | No               | No            |
| Fluid V2      | 0          | Yes       | Yes              | No            |
| Sushiswap     | 0          | No        | Yes              | Yes           |
| PancakeswapV3 | 0          | Yes       | Yes              | Yes           |

- **Unique Pools** = Can use one hook per protocol (vs. one hook per pool)
- **Extra Hops** = Additional contract calls compared to direct DEX interaction

---

## Protocol Integration Guides

### Curve

Curve pools use the exchange function for swaps. Many variants exist (StableSwap, StableSwap-NG, CryptoSwap). Token indices are pool-specific.

```solidity
interface ICurvePool {
    function exchange(
        int128 i,           // Input token index
        int128 j,           // Output token index
        uint256 dx,         // Input amount
        uint256 min_dy      // Minimum output
    ) external returns (uint256);

    // For underlying tokens (e.g., aTokens)
    function exchange_underlying(
        int128 i, int128 j,
        uint256 dx, uint256 min_dy
    ) external returns (uint256);
}
```

### Balancer

Balancer uses a Vault architecture where all pools share one contract. Adds one extra hop because the Vault is normally called directly.

```solidity
interface IBalancerVault {
    struct SingleSwap {
        bytes32 poolId;
        SwapKind kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }

    function swap(
        SingleSwap memory singleSwap,
        FundManagement memory funds,
        uint256 limit,
        uint256 deadline
    ) external returns (uint256 amountCalculated);
}
```

### Aerodrome

Aerodrome (Velodrome fork on Base) uses a simple router pattern. Hook replaces router — zero extra hops.

```solidity
interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;    // true for stable pools
        address factory;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
```

---

## Generic Hook Implementation (Proposal #1)

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

## Security Considerations

### Must Validate

1. **External call safety**: Verify external DEX responses; don't blindly trust return values
2. **Price manipulation**: Don't trust single-block prices for large amounts; use TWAPs or multiple sources
3. **Reentrancy**: Use appropriate guards for external calls; consider `nonReentrant` modifier
4. **Slippage**: Respect user-specified slippage parameters; never allow zero minAmountOut

### Must Avoid

1. **Unbounded loops**: Can cause out-of-gas; limit array sizes
2. **Hardcoded addresses**: Use constructor parameters or governance-updatable storage
3. **Direct ETH handling**: Use WETH wrapper for consistency
4. **Unchecked arithmetic**: Use Solidity 0.8.x checked math

### Generic Hook Specific Risks

The generic hook pattern allows arbitrary external calls. Consider:

- **Allowlisting**: Only permit calls to pre-approved contracts
- **Selector filtering**: Only permit known-safe function selectors
- **Value limits**: Cap ETH value per call

---

## Testing

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

---

## Deployment Checklist

- [ ] Audit hook contract
- [ ] Test on forked mainnet with real pool addresses
- [ ] Verify token approvals flow correctly
- [ ] Check gas estimates for all supported protocols
- [ ] Deploy hook with correct PoolManager address
- [ ] Initialize pools with hook attached
- [ ] Test end-to-end swap flow
- [ ] Set up monitoring for RouteDecision events

---

## Troubleshooting

| Issue                | Cause                      | Solution                                |
| -------------------- | -------------------------- | --------------------------------------- |
| External call failed | Wrong calldata encoding    | Verify function selector and parameters |
| Tokens stuck in hook | Missing sweep/transfer     | Add token recovery in afterSwap         |
| High gas usage       | Inefficient external calls | Consider protocol-specific hooks        |
| Hook not authorized  | Wrong permissions          | Check getHookPermissions()              |
| Volume not tracking  | afterSwap not enabled      | Set afterSwap: true in permissions      |

---

## Open Questions

From ongoing research, still to be determined:

- **Protocol fees**: How to implement fee collection on aggregator hook swaps?
- **MEV protection**: How to handle sandwich attacks on external DEX portions?
- **Liquidity discovery**: How to efficiently index available external liquidity?

---

## References

- [Uniswap V4 Hooks](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Hook Permissions](https://docs.uniswap.org/contracts/v4/concepts/hook-permissions)
- [BaseHook Contract](https://github.com/Uniswap/v4-periphery/blob/main/src/base/hooks/BaseHook.sol)
- [Curve Technical Docs](https://curve.readthedocs.io)
- [Balancer V2 Docs](https://docs.balancer.fi)
- [Aerodrome Docs](https://aerodrome.finance/docs)
