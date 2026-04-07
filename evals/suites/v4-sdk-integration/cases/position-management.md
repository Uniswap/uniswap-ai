# Position Management Test Case

Add liquidity to a Uniswap v4 pool using the v4 SDK PositionManager.

## Context

- TypeScript/Node.js application
- Adding liquidity to a USDC/ETH 0.05% v4 pool on Ethereum mainnet
- Using the Uniswap v4 SDK PositionManager
- User has already approved tokens through Permit2

## Requirements

1. Use `V4PositionManager` to construct the add-liquidity call
2. Call `addCallParameters` to generate the encoded calldata
3. Use `multicall` to batch the operation if needed
4. Include `slippageTolerance` to limit price impact
5. Include a `deadline` on all operations

## Constraints

- Must use `V4PositionManager` from `@uniswap/v4-sdk`
- Must use `addCallParameters` to build the position calldata
- Must use `multicall` for batching operations
- Must specify `slippageTolerance` for the liquidity addition
- Must include a `deadline` parameter
- Must NOT call PoolManager directly for position management

## Expected Output

A working TypeScript implementation that demonstrates v4 position management:
`V4PositionManager.addCallParameters()` with slippage tolerance and deadline, submitted via multicall.
