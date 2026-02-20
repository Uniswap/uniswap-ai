---
title: Quick Start
order: 3
---

# Quick Start

Create your first Uniswap V4 hook with AI assistance in minutes.

## Prerequisites

- Claude Code with the `uniswap-hooks` plugin installed
- A Foundry project for Solidity development

## Step 1: Describe Your Hook

Start by telling Claude what you want to build:

```text
Create a simple hook that logs swap events and tracks total volume
```

## Step 2: Review the Generated Code

Claude will generate a complete hook implementation. Review the key components:

### Hook Permissions

```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeInitialize: false,
        afterInitialize: false,
        beforeAddLiquidity: false,
        afterAddLiquidity: false,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false,
        beforeSwap: false,
        afterSwap: true,  // We only need afterSwap
        beforeDonate: false,
        afterDonate: false,
        beforeSwapReturnDelta: false,
        afterSwapReturnDelta: false,
        afterAddLiquidityReturnDelta: false,
        afterRemoveLiquidityReturnDelta: false
    });
}
```

### Hook Implementation

```solidity
function afterSwap(
    address sender,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    BalanceDelta delta,
    bytes calldata hookData
) external override returns (bytes4, int128) {
    // Track volume
    uint256 amount = params.amountSpecified < 0
        ? uint256(-params.amountSpecified)
        : uint256(params.amountSpecified);

    totalVolume += amount;

    // Emit event
    emit SwapExecuted(sender, key.toId(), amount);

    return (BaseHook.afterSwap.selector, 0);
}
```

## Step 3: Deploy and Test

Claude can help you write tests:

```text
Write Foundry tests for this hook
```

Example test:

```solidity
function test_afterSwap_tracksVolume() public {
    // Setup pool with hook
    PoolKey memory key = PoolKey({
        currency0: currency0,
        currency1: currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: IHooks(address(hook))
    });

    // Initialize pool
    manager.initialize(key, SQRT_PRICE_1_1, ZERO_BYTES);

    // Perform swap
    swap(key, true, 1 ether, ZERO_BYTES);

    // Verify volume tracked
    assertEq(hook.totalVolume(), 1 ether);
}
```

## Step 4: Iterate

Ask Claude to enhance the hook:

```text
Add a fee mechanism that takes 0.1% of swap volume
```

Or:

```text
Make the hook compare prices with an external DEX
```

## Example: Complete Workflow

```text
User: Create a hook that implements dynamic fees based on volatility

Claude: I'll create a dynamic fee hook that adjusts fees based on
recent price volatility...

[Generates complete implementation]

User: Add tests for edge cases

Claude: I'll add tests for high volatility, zero volatility, and
boundary conditions...

[Generates test suite]

User: Optimize for gas

Claude: I'll review the implementation for gas optimizations...

[Suggests improvements]
```

## Next Steps

- Explore [more skills](/skills/)
- Learn about [evaluations](/evals/)
- Read the [v4 Hooks Guide](https://docs.uniswap.org/contracts/v4/concepts/hooks)
