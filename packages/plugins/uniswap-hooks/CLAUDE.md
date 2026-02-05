# CLAUDE.md - uniswap-hooks Plugin

## Overview

This plugin provides AI-powered, security-first assistance for creating Uniswap V4 hooks. It helps developers design, implement, and test custom hooks for the Uniswap V4 protocol with a strong emphasis on security best practices.

## Plugin Components

### Skills (./skills/)

- **v4-security-foundations**: Security-first guide for V4 hook development (NoOp attacks, delta accounting, access control, audit checklists)
- **aggregator-hook-creator**: Create custom aggregator hooks that route through multiple liquidity sources

## Uniswap V4 Hooks Architecture

Hooks are smart contracts that can intercept and modify pool actions at specific points:

### Hook Callbacks

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

### Hook Flags

Hooks declare which callbacks they implement via flags:

```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeInitialize: false,
        afterInitialize: true,
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
```

## Development Guidelines

### Hook Address Requirements

V4 hooks must have specific address patterns where the last 14 bits encode which callbacks are enabled. Use the hook miner to find valid addresses.

### State Management

- Use transient storage for temporary data within a transaction
- Consider gas costs when storing persistent state
- Leverage PoolManager's singleton pattern

### Security Considerations

- Validate all inputs in hook callbacks
- Be aware of reentrancy risks
- Consider MEV implications of hook logic
- Test edge cases with extreme tick ranges

## File Structure

```text
uniswap-hooks/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── aggregator-hook-creator/
│       ├── aggregator-hook-creator.md
│       └── SKILL.md -> aggregator-hook-creator.md
├── project.json
├── package.json
├── CLAUDE.md
└── README.md
```

## Related Resources

- [Uniswap V4 Core](https://github.com/Uniswap/v4-core)
- [V4 Periphery](https://github.com/Uniswap/v4-periphery)
- [Hook Examples](https://github.com/Uniswap/v4-periphery/tree/main/src/lens)
