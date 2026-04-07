# Multi-Hop v4 SDK Swap Test Case

Build a multi-hop exact-input swap through multiple pools using the Uniswap v4 SDK.

## Context

- TypeScript/Node.js application
- Need to swap USDC -> WETH -> UNI (two hops) on Ethereum mainnet
- Using the Uniswap v4 SDK directly
- Each hop goes through a separate v4 pool

## Requirements

1. Encode a multi-hop path using `encodeMultihopExactInPath`
2. Construct the swap using V4Planner with the SWAP_EXACT_IN action (not SWAP_EXACT_IN_SINGLE)
3. Add appropriate settlement actions for the multi-hop flow
4. Wrap with RoutePlanner and execute via Universal Router
5. Include slippage tolerance calculation for the multi-hop route

## Constraints

- Must use `SWAP_EXACT_IN` (not `SWAP_EXACT_IN_SINGLE`) for multi-hop
- Must use `encodeMultihopExactInPath` to encode the path
- Must NOT use the single-hop action variant for a multi-pool route
- Must include a transaction deadline
- Must use Permit2 two-step approval for USDC (ERC20 input token)

## Expected Output

A working TypeScript implementation that demonstrates multi-hop v4 SDK swap: encoding the path with
`encodeMultihopExactInPath`, using SWAP_EXACT_IN action, and executing via Universal Router.
