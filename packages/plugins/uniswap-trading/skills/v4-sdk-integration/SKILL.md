---
name: v4-sdk-integration
description: >
  App-layer SDK guide for building swap and liquidity experiences directly with the Uniswap v4 SDK.
  Use when user asks about "v4 sdk", "uniswap v4", "v4 swap", "v4 liquidity", "PoolManager",
  "V4Planner", "StateView", "PositionManager", "pool state", "v4 position", "uniswap sdk",
  or when building swap/liquidity UX directly with SDKs rather than via the Trading API.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(yarn:*), Bash(curl:*), WebFetch
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# Uniswap v4 SDK Integration

> App-layer SDK for swaps, quotes, and liquidity. For Solidity hook contracts, use the
> `uniswap-hooks` skill. For Trading API or v3-centric swaps, use the `swap-integration` skill.

## When to Use

- Token swap UI (single-hop or multi-hop)
- Quote/price display before executing a trade
- Liquidity position management (add/remove/collect)
- Pool state reads (price, tick, liquidity)

## Packages

```bash
npm i @uniswap/v4-sdk @uniswap/sdk-core @uniswap/universal-router-sdk
```

---

## v4 vs v3 Decision Table

| Aspect             | v3                         | v4                                            |
| ------------------ | -------------------------- | --------------------------------------------- |
| Swap execution     | SwapRouter directly        | Universal Router required (V4Planner)         |
| Pool architecture  | One contract per pool      | Singleton PoolManager                         |
| Pool state reads   | Direct pool contract       | StateView contract                            |
| Native ETH         | Wrap to WETH               | Native support (`Ether.onChain(chainId)`)     |
| Position NFTs      | NonfungiblePositionManager | PositionManager + multicall                   |
| Fee collection     | Explicit `collect()`       | Automatic on position modification            |
| Position discovery | Onchain enumeration        | Offchain event indexing                       |
| Token approvals    | Direct approve             | Permit2 required                              |
| Contract addresses | Same across chains         | Different per chain — verify from deployments |

---

## Core Contracts (Per Chain)

Look up addresses at <https://docs.uniswap.org/contracts/v4/deployments> — they differ per chain.

| Contract         | Purpose                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| PoolManager      | Singleton pool state                                                                    |
| Universal Router | Swap execution entry point                                                              |
| Quoter           | Offchain quote simulation (callStatic)                                                  |
| StateView        | Pool state reads (getSlot0, getLiquidity)                                               |
| PositionManager  | LP position lifecycle                                                                   |
| Permit2          | Token approval layer (same across chains: `0x000000000022D473030F116dDEE9F6B43aC78BA3`) |

---

## Swap Pattern (Universal Router)

All swaps use: V4Planner -> RoutePlanner -> Universal Router `execute()`.

**Single-hop (exact input):**

```typescript
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';

const v4Planner = new V4Planner();
v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
v4Planner.addAction(Actions.SETTLE_ALL, [inputCurrency, amountIn]);
v4Planner.addAction(Actions.TAKE_ALL, [outputCurrency, amountOutMinimum]);

const routePlanner = new RoutePlanner();
routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

const deadline = Math.floor(Date.now() / 1000) + 3600;
// Note: universalRouter.execute() is pseudocode for the viem call pattern.
// With viem, use: walletClient.writeContract({ address: UNIVERSAL_ROUTER_ADDRESS, abi: universalRouterAbi, functionName: 'execute', args: [routePlanner.commands, [v4Planner.finalize()], deadline], ...txOptions })
await universalRouter.execute(routePlanner.commands, [v4Planner.finalize()], deadline, txOptions);
```

**Multi-hop (exact input):**

```typescript
import { Actions, V4Planner, encodeMultihopExactInPath } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';

const v4Planner = new V4Planner();
// Build multi-hop path: tokenA -> tokenB -> tokenC
const path = encodeMultihopExactInPath([poolKeyAB, poolKeyBC], tokenA);
v4Planner.addAction(Actions.SWAP_EXACT_IN, [{ path, amountIn, amountOutMinimum }]);
// SETTLE_ALL uses first pool's input currency; TAKE_ALL uses last pool's output currency
v4Planner.addAction(Actions.SETTLE_ALL, [tokenA, amountIn]);
v4Planner.addAction(Actions.TAKE_ALL, [tokenC, amountOutMinimum]);

const routePlanner = new RoutePlanner();
routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

const deadline = Math.floor(Date.now() / 1000) + 3600;
// Note: universalRouter.execute() is pseudocode for the viem call pattern.
// With viem, use: walletClient.writeContract({ address: UNIVERSAL_ROUTER_ADDRESS, abi: universalRouterAbi, functionName: 'execute', args: [routePlanner.commands, [v4Planner.finalize()], deadline], ...txOptions })
await universalRouter.execute(routePlanner.commands, [v4Planner.finalize()], deadline, txOptions);
```

**SwapConfig** (`SwapExactInSingle`):

```typescript
const swapConfig = {
  poolKey: { currency0, currency1, fee, tickSpacing, hooks },
  zeroForOne,
  amountIn,
  amountOutMinimum,
  hookData: '0x00',
};
```

---

## Quoting Pattern

Use the Quoter contract with `callStatic` — this simulates the swap offchain without executing it
or spending gas.

```typescript
const quote = await quoterContract.callStatic.quoteExactInputSingle({
  poolKey,
  zeroForOne,
  exactAmount: amountIn,
  hookData: '0x00',
});
```

Four available methods:

- `quoteExactInputSingle` — single-hop, exact input amount
- `quoteExactInput` — multi-hop, exact input amount
- `quoteExactOutputSingle` — single-hop, exact output amount
- `quoteExactOutput` — multi-hop, exact output amount

---

## Pool State Reads (StateView)

```typescript
import { Pool } from '@uniswap/v4-sdk';

const poolId = Pool.getPoolId(currency0, currency1, fee, tickSpacing, hooks);

const [slot0, liquidity] = await Promise.all([
  stateViewContract.getSlot0(poolId),
  stateViewContract.getLiquidity(poolId),
]);
// slot0 → { sqrtPriceX96, tick, protocolFee, lpFee }
```

---

## ERC20 Approval Flow (Permit2)

ERC20 swaps require two approvals — token -> Permit2, then Permit2 -> Universal Router:

```typescript
// Step 1: Approve Permit2 on the token contract
await erc20Contract.approve(PERMIT2_ADDRESS, MaxUint256);

// Step 2: Approve Universal Router on Permit2
await permit2Contract.approve(tokenAddress, UNIVERSAL_ROUTER_ADDRESS, MAX_UINT160, deadline);
```

Native ETH swaps bypass both approvals — pass `value` in the transaction options instead.

---

## Position Management (PositionManager)

All operations use `PositionManager.multicall()`:

| Operation        | SDK Method                                                  |
| ---------------- | ----------------------------------------------------------- |
| Add liquidity    | `V4PositionManager.addCallParameters(position, options)`    |
| Remove liquidity | `V4PositionManager.removeCallParameters(position, options)` |
| Collect fees     | `V4PositionManager.collectCallParameters(options)`          |
| Create position  | `V4PositionManager.createCallParameters(position, options)` |

```typescript
const { calldata, value } = V4PositionManager.addCallParameters(position, {
  slippageTolerance: new Percent(50, 10_000),
  deadline: deadline.toString(),
  tokenId: tokenId.toString(),
  useNative: token0.isNative ? Ether.onChain(chainId) : undefined,
  batchPermit,
  hookData: '0x',
});

await walletClient.writeContract({
  address: POSITION_MANAGER_ADDRESS,
  functionName: 'multicall',
  args: [[calldata]],
  value: BigInt(value),
});
```

---

## Strict Rules

- NEVER call PoolManager directly for swaps — ALWAYS route through Universal Router.
- NEVER assume contract addresses are the same across chains — look up from the deployments page.
- NEVER call Quoter onchain (gas expensive) — ALWAYS use `callStatic` for offchain simulation.
- NEVER skip Permit2 for ERC20 swaps — direct `approve` to Universal Router will not work.
- ALWAYS set a deadline on swaps and LP operations.
- ALWAYS handle native ETH with `Ether.onChain(chainId)`, not WETH, in v4 pool contexts.
- ALWAYS use `Pool.getPoolId()` to compute pool identifiers — do not construct manually.

---

## Links

- SDK overview: <https://docs.uniswap.org/sdk/v4/overview>
- Swap guides: <https://docs.uniswap.org/sdk/v4/guides/swaps/quoting>
- Liquidity guide: <https://docs.uniswap.org/sdk/v4/guides/liquidity/add-remove-liquidity>
- Pool data: <https://docs.uniswap.org/sdk/v4/guides/advanced/pool-data>
- Deployments: <https://docs.uniswap.org/contracts/v4/deployments>
- npm: <https://www.npmjs.com/package/@uniswap/v4-sdk>

---

## Related Skills

- `swap-integration` — Trading API and v3-centric swap integration (not direct v4 SDK)
- `uniswap-hooks` — Solidity hook contract generation (not app-layer SDK)
