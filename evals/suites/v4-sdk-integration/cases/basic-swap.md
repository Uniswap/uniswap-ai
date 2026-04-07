# Basic v4 SDK Swap Test Case

Build a complete single-hop exact-input swap using the Uniswap v4 SDK.

## Context

- TypeScript/Node.js application
- Need to swap ETH for USDC on Ethereum mainnet
- Using the Uniswap v4 SDK directly (not the Trading API)
- Have a viem wallet client for signing and sending

## Requirements

1. Construct the swap using V4Planner with the SWAP_EXACT_IN_SINGLE action
2. Add SETTLE_ALL and TAKE_ALL settlement actions
3. Wrap the encoded plan with RoutePlanner using CommandType.V4_SWAP
4. Execute via the Universal Router's execute() method
5. Handle the ETH input value correctly (native ETH, not WETH)

## Constraints

- Must use `@uniswap/v4-sdk` V4Planner and Actions
- Must use `@uniswap/universal-router-sdk` RoutePlanner with CommandType.V4_SWAP
- Must NOT call PoolManager directly for swap execution
- Must include a deadline on the transaction
- Must use Permit2 two-step approval for any ERC20 input (ETH is exempt)

## Expected Output

A working TypeScript implementation that demonstrates the complete v4 SDK single-hop swap pattern:
V4Planner with SWAP_EXACT_IN_SINGLE -> RoutePlanner -> Universal Router execute().
