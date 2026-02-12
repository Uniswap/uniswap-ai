---
title: Uniswap Hooks
order: 3
---

# Uniswap Hooks

AI-powered, security-first assistance for creating Uniswap V4 hooks.

## Installation

```bash
/install https://github.com/Uniswap/uniswap-ai/tree/main/packages/plugins/uniswap-hooks
```

## Skills

| Skill                                                        | Description                                                                   | Invocation                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------- |
| [V4 Security Foundations](../skills/v4-security-foundations) | Security-first guide for V4 hook development                                  | `/v4-security-foundations` |
| [Aggregator Hook Creator](../skills/aggregator-hook-creator) | Create custom aggregator hooks for routing through multiple liquidity sources | `/aggregator-hook-creator` |

## Hook Callbacks

Hooks are smart contracts that intercept and modify pool actions at specific points:

| Callback                | When Called           | Use Case                  |
| ----------------------- | --------------------- | ------------------------- |
| `beforeInitialize`      | Before pool creation  | Validate pool parameters  |
| `afterInitialize`       | After pool creation   | Set up hook state         |
| `beforeAddLiquidity`    | Before LP deposit     | Custom fee logic          |
| `afterAddLiquidity`     | After LP deposit      | Update rewards            |
| `beforeRemoveLiquidity` | Before LP withdrawal  | Lock periods              |
| `afterRemoveLiquidity`  | After LP withdrawal   | Distribute rewards        |
| `beforeSwap`            | Before swap execution | Price oracles, routing    |
| `afterSwap`             | After swap execution  | MEV protection, analytics |
| `beforeDonate`          | Before donation       | Access control            |
| `afterDonate`           | After donation        | Track donations           |

## Hook Flags

Hooks declare which callbacks they implement via a permissions struct. The hook address must encode which callbacks are enabled in its last 14 bits. Use the hook miner to find valid addresses during deployment.

```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeInitialize: false,
        afterInitialize: true,
        beforeSwap: true,
        afterSwap: true,
        // ... remaining flags
    });
}
```

## Development Guidelines

- **Address requirements**: V4 hooks must have specific address patterns where the last 14 bits encode enabled callbacks
- **State management**: Use transient storage for temporary data; consider gas costs for persistent state
- **Security**: Validate all inputs, guard against reentrancy, consider MEV implications
- **Testing**: Test edge cases with extreme tick ranges

## Related

- [Plugins Overview](/plugins/) - All available plugins
- [Skills](/skills/) - All available skills
- [Uniswap V4 Core](https://github.com/Uniswap/v4-core)
- [V4 Periphery](https://github.com/Uniswap/v4-periphery)
