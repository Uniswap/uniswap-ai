---
name: aggregator-hook-creator
description: Integrate external DEX liquidity into Uniswap v4 via Aggregator Hooks. Use when user says "aggregator hook", "external liquidity", "wrap Curve/Balancer/Aerodrome", "route through external DEX", "v4 hook for non-Uniswap pools", "compare liquidity sources", or mentions integrating third-party AMM liquidity into Uniswap routing.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(forge:*), Bash(cast:*), Bash(curl:*), WebFetch, Task(subagent_type:Explore)
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.1.0'
  prerequisites: v4-security-foundations
---

# Aggregator Hook Integration

Integrate external DEX liquidity (Curve, Balancer, Aerodrome, etc.) into Uniswap v4 routing via Aggregator Hooks.

## Overview

Aggregator Hooks are Uniswap v4 hooks that wrap non-Uniswap pools, allowing the Uniswap router to include external liquidity sources. This improves execution quality by routing through the best available liquidity across multiple protocols.

## Prerequisites

This skill assumes familiarity with:

- viem Integration - EVM basics
- Swap Integration - Uniswap swap patterns
- Uniswap v4 hook architecture basics
- **[v4-security-foundations](../v4-security-foundations/v4-security-foundations.md)** - Complete the security foundations skill before building aggregator hooks. Understanding NoOp attacks, delta accounting, and access control is essential.

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
| **Price Comparison** | Compare v4 price with external source    | `beforeSwap`              |
| **Split Routing**    | Split orders across multiple venues      | `beforeSwap`, `afterSwap` |
| **Fallback Routing** | Route to external if v4 liquidity is low | `beforeSwap`              |
| **Analytics**        | Track routing decisions and volume       | `afterSwap`               |

---

## Hook Architecture

### Token Flow (External Routing)

When a swap is routed through an external DEX via the hook, tokens flow as follows:

```text
User ──[input tokens]──► Router ──► PoolManager
                                        │
                                   beforeSwap()
                                        │
                                        ▼
                                   Hook Contract
                                        │
                              ┌─────────┴─────────┐
                              │  External DEX      │
                              │  (Curve/Balancer/  │
                              │   Aerodrome)       │
                              └─────────┬─────────┘
                                        │
                                   [output tokens]
                                        │
                                        ▼
                                   Hook Contract
                                        │
                                   settle() + take()
                                        │
                                        ▼
                                   PoolManager ──► Router ──[output tokens]──► User
```

**Key points:**

- The hook uses `beforeSwapReturnDelta` to claim it handled the swap
- PoolManager tracks credits/debits -- the hook must settle what it owes
- External DEX calls happen inside the `beforeSwap` callback
- The hook must have tokens approved for the external DEX

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

For protocol-specific interfaces and implementation details:

- **Curve**: See [references/protocols/curve.md](references/protocols/curve.md)
- **Balancer**: See [references/protocols/balancer.md](references/protocols/balancer.md)
- **Aerodrome**: See [references/protocols/aerodrome.md](references/protocols/aerodrome.md)

---

## Implementation

For full implementation code including:

- Generic Aggregator Hook (Solidity)
- Off-chain integration (TypeScript/viem)
- Test suite (Foundry)

See [references/implementations.md](references/implementations.md)

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

## Research Notes

For open questions and ongoing research topics, see [references/research-notes.md](references/research-notes.md).

---

## References

- [Uniswap v4 Hooks](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Hook Permissions](https://docs.uniswap.org/contracts/v4/concepts/hook-permissions)
- [BaseHook Contract](https://github.com/Uniswap/v4-periphery/blob/main/src/base/hooks/BaseHook.sol)
- [Curve Technical Docs](https://curve.readthedocs.io)
- [Balancer V2 Docs](https://docs.balancer.fi)
- [Aerodrome Docs](https://aerodrome.finance/docs)
