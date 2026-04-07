---
title: v4 SDK Integration
order: 9
---

# v4 SDK Integration

Build swap and liquidity experiences directly with the Uniswap v4 SDK — no Trading API required. This skill covers the full app-layer SDK stack: V4Planner swap construction, Quoter price reads, StateView pool state, PositionManager multicall operations, and Permit2 approval flow.

## Invocation

```text
/v4-sdk-integration
```

Or describe your requirements naturally:

```text
Help me build a swap using the Uniswap v4 SDK
```

## What It Does

This skill helps you:

- **Execute swaps with V4Planner**: Construct single-hop and multi-hop swaps using the V4Planner and RoutePlanner pattern, executed via the Universal Router
- **Quote prices off-chain**: Call the Quoter using `callStatic` for exact-input and exact-output quotes without on-chain state changes
- **Read pool state**: Fetch slot0, liquidity, and pool IDs from StateView using `Pool.getPoolId()`
- **Manage LP positions**: Add, remove, collect fees, and create positions using `V4PositionManager.multicall()`

## v4 vs v3 Decision Guide

| Concern            | v3 Approach                     | v4 Approach                           |
| ------------------ | ------------------------------- | ------------------------------------- |
| Swap execution     | SwapRouter02                    | V4Planner + Universal Router          |
| Pool architecture  | Separate pool contracts         | Singleton PoolManager                 |
| Pool state reads   | IUniswapV3Pool interface        | StateView contract                    |
| Native ETH         | Wrap to WETH first              | `Ether.onChain(chainId)` natively     |
| Position NFTs      | NonfungiblePositionManager      | PositionManager (ERC-6909 or ERC-721) |
| Fee collection     | `collect()` on NFT              | `V4PositionManager` multicall         |
| Position discovery | NonfungiblePositionManager logs | PositionManager events                |
| Token approvals    | Router direct approval          | Permit2 two-step flow                 |
| Contract addresses | Fixed per chain                 | Chain-specific; use deployments page  |

## Key Topics Covered

- **V4Planner pattern**: `Actions.SWAP_EXACT_IN_SINGLE` / `SWAP_EXACT_IN` actions, `SETTLE_ALL` / `TAKE_ALL` settlement, and encoding via `RoutePlanner` with `CommandType.V4_SWAP`
- **Quoter callStatic**: Off-chain price reads using `quoteExactInputSingle`, `quoteExactInput`, `quoteExactOutputSingle`, and `quoteExactOutput` — never called on-chain
- **StateView**: `Pool.getPoolId()` for pool ID computation; `Promise.all` batching for slot0 and getLiquidity reads
- **PositionManager multicall**: Single transaction for add/remove/collect/create operations; always includes `slippageTolerance` and `deadline`
- **Permit2 two-step approval**: `token.approve(Permit2Address)` followed by `permit2.approve(token, universalRouter, amount, expiry)` — required for all ERC-20 tokens
- **Native ETH handling**: Use `Ether.onChain(chainId)` instead of WETH in v4 contexts; native ETH bypasses the Permit2 approval step
- **Strict rules**: Never call PoolManager directly for swaps, never skip Permit2, never hardcode contract addresses, always set deadlines

## Related Resources

- [Uniswap Trading Plugin](/plugins/uniswap-trading) - Parent plugin
- [Swap Integration](/skills/swap-integration) - Trading API and v3-centric swaps
- [v4 Security Foundations](/skills/v4-security-foundations) - Solidity hook development (uniswap-hooks plugin)
- [@uniswap/v4-sdk on npm](https://www.npmjs.com/package/@uniswap/v4-sdk) - SDK package
- [v4 Deployments](https://docs.uniswap.org/contracts/v4/deployments) - Chain-specific contract addresses
- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview) - Official v4 documentation
