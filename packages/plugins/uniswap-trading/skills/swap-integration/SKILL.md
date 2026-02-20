---
name: swap-integration
description: Integrate Uniswap swaps into applications. Use when user says "integrate swaps", "uniswap", "trading api", "add swap functionality", "build a swap frontend", "create a swap script", "smart contract swap integration", "use Universal Router", "Trading API", or mentions swapping tokens via Uniswap.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(yarn:*), Bash(curl:*), WebFetch, Task(subagent_type:swap-integration-expert)
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.2.0'
---

# Swap Integration

Integrate Uniswap swaps into frontends, backends, and smart contracts.

## Prerequisites

This skill assumes familiarity with viem basics (client setup, account management, contract interactions, transaction signing). Install the **uniswap-viem** plugin for comprehensive viem/wagmi guidance: `claude plugin add @uniswap/uniswap-viem`

## Quick Decision Guide

| Building...                    | Use This Method               |
| ------------------------------ | ----------------------------- |
| Frontend with React/Next.js    | Trading API                   |
| Backend script or bot          | Trading API                   |
| Smart contract integration     | Universal Router direct calls |
| Need full control over routing | Universal Router SDK          |

### Routing Types Quick Reference

| Type     | Description                             | Chains                             |
| -------- | --------------------------------------- | ---------------------------------- |
| CLASSIC  | Standard AMM swap through Uniswap pools | All supported chains               |
| DUTCH_V2 | UniswapX Dutch auction V2               | Ethereum, Arbitrum, Base, Unichain |
| PRIORITY | MEV-protected priority order            | Base, Unichain                     |
| WRAP     | ETH to WETH conversion                  | All                                |
| UNWRAP   | WETH to ETH conversion                  | All                                |

See [Routing Types](#routing-types) for the complete list including DUTCH_V3, DUTCH_LIMIT, LIMIT_ORDER, BRIDGE, and QUICKROUTE.

## Integration Methods

### 1. Trading API (Recommended)

Best for: Frontends, backends, scripts. Handles routing optimization automatically.

**Base URL**: `https://trade-api.gateway.uniswap.org/v1`

**Authentication**: `x-api-key: <your-api-key>` header required

**Getting an API Key**: The Trading API requires an API key for authentication. Visit the [Uniswap Developer Portal](https://developers.uniswap.org/) to register and obtain your API key. Keys are typically available for immediate use after registration. Include it as an `x-api-key` header in all API requests.

**Required Headers** — Include these in ALL Trading API requests:

```text
Content-Type: application/json
x-api-key: <your-api-key>
x-universal-router-version: 2.0
```

**3-Step Flow**:

```text
1. POST /check_approval  -> Check if token is approved
2. POST /quote           -> Get executable quote with routing
3. POST /swap            -> Get transaction to sign and submit
```

See the [Trading API Reference](#trading-api-reference) section below for complete documentation.

### 2. Universal Router SDK

Best for: Direct control over transaction construction.

**Installation**:

```bash
npm install @uniswap/universal-router-sdk @uniswap/sdk-core @uniswap/v3-sdk
```

**Key Pattern**:

```typescript
import { SwapRouter } from '@uniswap/universal-router-sdk';

const { calldata, value } = SwapRouter.swapCallParameters(trade, options);
```

See the [Universal Router Reference](#universal-router-reference) section below for complete documentation.

### 3. Smart Contract Integration

Best for: On-chain integrations, DeFi composability.

**Interface**: Call `execute()` on Universal Router with encoded commands.

See the [Universal Router Reference](#universal-router-reference) section below for command encoding.

---

## Trading API Reference

### Step 1: Check Token Approval

```bash
POST /check_approval
```

**Request**:

```json
{
  "walletAddress": "0x...",
  "token": "0x...",
  "amount": "1000000000",
  "chainId": 1
}
```

**Response**:

```json
{
  "approval": {
    "to": "0x...",
    "from": "0x...",
    "data": "0x...",
    "value": "0",
    "chainId": 1
  }
}
```

If `approval` is `null`, token is already approved.

### Step 2: Get Quote

```bash
POST /quote
```

**Request**:

```json
{
  "swapper": "0x...",
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "tokenInChainId": "1",
  "tokenOutChainId": "1",
  "amount": "1000000000000000000",
  "type": "EXACT_INPUT",
  "slippageTolerance": 0.5,
  "routingPreference": "BEST_PRICE"
}
```

> **Note**: `tokenInChainId` and `tokenOutChainId` must be **strings** (e.g., `"1"`), not numbers.

**Key Parameters**:

| Parameter           | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `type`              | `EXACT_INPUT` or `EXACT_OUTPUT`                                   |
| `slippageTolerance` | 0-100 percentage                                                  |
| `protocols`         | Optional: `["V2", "V3", "V4"]`                                    |
| `routingPreference` | `BEST_PRICE`, `FASTEST`, `CLASSIC`                                |
| `autoSlippage`      | `true` to auto-calculate slippage (overrides `slippageTolerance`) |
| `urgency`           | `normal` or `fast` — affects UniswapX auction timing              |

**Response**:

```json
{
  "routing": "CLASSIC",
  "quote": {
    "input": { "token": "0x...", "amount": "1000000000000000000" },
    "output": { "token": "0x...", "amount": "999000000" },
    "slippage": 0.5,
    "route": [],
    "gasFee": "5000000000000000",
    "gasFeeUSD": "0.01",
    "gasUseEstimate": "150000"
  },
  "permitData": {}
}
```

> **Display tip**: Use `gasFeeUSD` (a string with the USD value) for gas cost display. Do **not** manually convert `gasFee` (wei) using a hardcoded ETH price — this leads to wildly inaccurate estimates (e.g., ~$87 instead of ~$0.01).

### Step 3: Execute Swap

```bash
POST /swap
```

**Request** - Spread the quote response directly into the body:

```typescript
// CORRECT: Spread the quote response, strip null fields
const quoteResponse = await fetchQuote(params);

// Remove null permitData/permitTransaction (API rejects null values)
const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;

const swapRequest = {
  ...cleanQuote,
  // Only include permitData if it's a valid object (not null)
  ...(permitData && { permitData }),
};

// If using Permit2 signature, include BOTH signature and permitData
if (permit2Signature && permitData) {
  swapRequest.signature = permit2Signature;
  swapRequest.permitData = permitData;
}
```

**Critical**: Do NOT wrap the quote in `{quote: quoteResponse}`. The API expects the quote response fields spread into the request body.

**Permit2 Rules**:

- `signature` and `permitData` must BOTH be present, or BOTH be absent
- Never set `permitData: null` - omit the field entirely
- The quote response often includes `permitData: null` - strip this before sending

**Response** (ready-to-sign transaction):

```json
{
  "swap": {
    "to": "0x...",
    "from": "0x...",
    "data": "0x...",
    "value": "0",
    "chainId": 1,
    "gasLimit": "250000"
  }
}
```

**Response Validation** - Always validate before broadcasting:

```typescript
function validateSwapResponse(response: SwapResponse): void {
  if (!response.swap?.data || response.swap.data === '' || response.swap.data === '0x') {
    throw new Error('swap.data is empty - quote may have expired');
  }
  if (!isAddress(response.swap.to) || !isAddress(response.swap.from)) {
    throw new Error('Invalid address in swap response');
  }
}
```

### Supported Chains

| ID   | Chain    | ID      | Chain       |
| ---- | -------- | ------- | ----------- |
| 1    | Ethereum | 8453    | Base        |
| 10   | Optimism | 42161   | Arbitrum    |
| 56   | BNB      | 42220   | Celo        |
| 130  | Unichain | 43114   | Avalanche   |
| 137  | Polygon  | 81457   | Blast       |
| 196  | X Layer  | 7777777 | Zora        |
| 324  | zkSync   | 480     | World Chain |
| 1868 | Soneium  | 143     | Monad       |

### Routing Types

| Type        | Description                                   |
| ----------- | --------------------------------------------- |
| CLASSIC     | Standard AMM swap through Uniswap pools       |
| DUTCH_V2    | UniswapX Dutch auction V2                     |
| DUTCH_V3    | UniswapX Dutch auction V3                     |
| PRIORITY    | MEV-protected priority order (Base, Unichain) |
| DUTCH_LIMIT | UniswapX Dutch limit order                    |
| LIMIT_ORDER | Limit order                                   |
| WRAP        | ETH to WETH conversion                        |
| UNWRAP      | WETH to ETH conversion                        |
| BRIDGE      | Cross-chain bridge                            |
| QUICKROUTE  | Fast approximation quote                      |

**UniswapX availability**: UniswapX V2 orders are supported on Ethereum (1), Arbitrum (42161), Base (8453), and Unichain (130). The auction mechanism varies by chain — see [UniswapX Auction Types](#uniswapx-auction-types) below.

---

## Critical Implementation Notes

These are common pitfalls discovered during real-world Trading API integration. **Follow these rules to avoid on-chain reverts and API errors.**

### 1. Swap Request Body Format

The `/swap` endpoint expects the quote response **spread into the request body**, not wrapped in a `quote` field.

```typescript
// WRONG - causes "quote does not match any of the allowed types"
const badRequest = {
  quote: quoteResponse, // Don't wrap!
  signature: '0x...',
};

// CORRECT - spread the quote response
const goodRequest = {
  ...quoteResponse,
  signature: '0x...', // Only if using Permit2
};
```

### 2. Null Field Handling

The API rejects `permitData: null`. Always strip null fields before sending:

```typescript
function prepareSwapRequest(quoteResponse: QuoteResponse, signature?: string): object {
  // Strip null values that the API rejects
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;

  const request: Record<string, unknown> = { ...cleanQuote };

  // Only include permitData if it's a valid object AND we have a signature
  if (signature && permitData && typeof permitData === 'object') {
    request.signature = signature;
    request.permitData = permitData;
  }

  return request;
}
```

### 3. Permit2 Field Rules

When using Permit2 for gasless approvals:

| Scenario                   | `signature` | `permitData` |
| -------------------------- | ----------- | ------------ |
| Standard swap (no Permit2) | Omit        | Omit         |
| Permit2 swap               | Required    | Required     |
| **Invalid**                | Present     | Missing      |
| **Invalid**                | Missing     | Present      |
| **Invalid (API error)**    | Any         | `null`       |

### 4. Pre-Broadcast Validation

Always validate the swap response before sending to the blockchain:

```typescript
import { isAddress, isHex } from 'viem';

function validateSwapBeforeBroadcast(swap: SwapTransaction): void {
  // 1. data must be non-empty hex
  if (!swap.data || swap.data === '' || swap.data === '0x') {
    throw new Error('swap.data is empty - this will revert on-chain. Re-fetch the quote.');
  }

  if (!isHex(swap.data)) {
    throw new Error('swap.data is not valid hex');
  }

  // 2. Addresses must be valid
  if (!isAddress(swap.to)) {
    throw new Error('swap.to is not a valid address');
  }

  if (!isAddress(swap.from)) {
    throw new Error('swap.from is not a valid address');
  }

  // 3. Value must be present (can be "0" for non-ETH swaps)
  if (swap.value === undefined || swap.value === null) {
    throw new Error('swap.value is missing');
  }
}
```

### 5. Browser Environment Setup

When using viem/wagmi in browser environments, you need Node.js polyfills:

**Install buffer polyfill**:

```bash
npm install buffer
```

**Add to your entry file (before other imports)**:

```typescript
// src/main.tsx or src/index.tsx
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

// Then your other imports
import React from 'react';
import { WagmiProvider } from 'wagmi';
// ...
```

**Vite configuration** (`vite.config.ts`):

```typescript
export default defineConfig({
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
});
```

Without this setup, you'll see: `ReferenceError: Buffer is not defined`

#### CORS Proxy Configuration

The Trading API does not support browser CORS preflight requests — `OPTIONS` requests return `415 Unsupported Media Type`. Direct `fetch()` calls from a browser will always fail. You **must** proxy API requests through your own server or dev server.

**Vite dev proxy** (merge into the same `vite.config.ts` used for the Buffer polyfill above):

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api/uniswap': {
        target: 'https://trade-api.gateway.uniswap.org/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/uniswap/, ''),
      },
    },
  },
});
```

Then use `/api/uniswap/quote` instead of the full URL in your frontend code.

**Vercel production proxy** (`vercel.json`):

```json
{
  "rewrites": [
    {
      "source": "/api/uniswap/:path*",
      "destination": "https://trade-api.gateway.uniswap.org/v1/:path*"
    }
  ]
}
```

**Cloudflare Pages** (`public/_redirects`):

```text
/api/uniswap/* https://trade-api.gateway.uniswap.org/v1/:splat 200
```

**Next.js** (`next.config.js`):

```javascript
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/uniswap/:path*',
        destination: 'https://trade-api.gateway.uniswap.org/v1/:path*',
      },
    ];
  },
};
```

Without a proxy, you'll see: `415 Unsupported Media Type` on preflight or CORS errors in the browser console.

### 6. Quote Freshness

- Quotes expire quickly (typically 30 seconds)
- Always re-fetch if the user takes time to review
- Use the `deadline` parameter to prevent stale execution
- If `/swap` returns empty `data`, the quote likely expired

---

## Universal Router Reference

The Universal Router is a unified interface for swapping across Uniswap v2, v3, and v4.

### Core Function

```solidity
function execute(
    bytes calldata commands,
    bytes[] calldata inputs,
    uint256 deadline
) external payable;
```

### Command Encoding

Each command is a single byte:

| Bits | Name     | Purpose                             |
| ---- | -------- | ----------------------------------- |
| 0    | flag     | Allow revert (1 = continue on fail) |
| 1-2  | reserved | Use 0                               |
| 3-7  | command  | Operation identifier                |

### Swap Commands

| Code | Command           | Description               |
| ---- | ----------------- | ------------------------- |
| 0x00 | V3_SWAP_EXACT_IN  | v3 swap with exact input  |
| 0x01 | V3_SWAP_EXACT_OUT | v3 swap with exact output |
| 0x08 | V2_SWAP_EXACT_IN  | v2 swap with exact input  |
| 0x09 | V2_SWAP_EXACT_OUT | v2 swap with exact output |
| 0x10 | V4_SWAP           | v4 swap                   |

### Token Operations

| Code | Command     | Description                |
| ---- | ----------- | -------------------------- |
| 0x04 | SWEEP       | Clear router token balance |
| 0x05 | TRANSFER    | Send specific amount       |
| 0x0b | WRAP_ETH    | ETH to WETH                |
| 0x0c | UNWRAP_WETH | WETH to ETH                |

### Permit2 Commands

| Code | Command               | Description           |
| ---- | --------------------- | --------------------- |
| 0x02 | PERMIT2_TRANSFER_FROM | Single token transfer |
| 0x03 | PERMIT2_PERMIT_BATCH  | Batch approval        |
| 0x0a | PERMIT2_PERMIT        | Single approval       |

### SDK Usage

```typescript
import { SwapRouter, UniswapTrade } from '@uniswap/universal-router-sdk'
import { TradeType } from '@uniswap/sdk-core'

// Build trade using v3-sdk or router-sdk
const trade = new RouterTrade({
  v3Routes: [...],
  tradeType: TradeType.EXACT_INPUT
})

// Get calldata for Universal Router
const { calldata, value } = SwapRouter.swapCallParameters(trade, {
  slippageTolerance: new Percent(50, 10000), // 0.5%
  recipient: walletAddress,
  deadline: Math.floor(Date.now() / 1000) + 1200 // 20 min
})

// Send transaction
const tx = await wallet.sendTransaction({
  to: UNIVERSAL_ROUTER_ADDRESS,
  data: calldata,
  value
})
```

---

## Permit2 Integration

Permit2 enables signature-based token approvals instead of on-chain approve() calls.

### Approval Target: Permit2 vs Legacy (Direct to Router)

There are two approval paths. Choose based on your integration type:

| Approach                    | Approve To       | Per-Swap Auth       | Best For                         |
| --------------------------- | ---------------- | ------------------- | -------------------------------- |
| **Permit2** (recommended)   | Permit2 contract | EIP-712 signature   | Frontends with user interaction  |
| **Legacy** (direct approve) | Universal Router | None (pre-approved) | Backend services, smart accounts |

**Permit2 flow** (frontend with user signing):

1. User approves token to Permit2 contract (one-time)
2. Each swap: user signs an EIP-712 permit message
3. Universal Router uses the signature to transfer tokens via Permit2

**Legacy flow** (backend services, ERC-4337 smart accounts):

1. Approve token directly to the Universal Router address (one-time)
2. Each swap: no additional authorization needed
3. Simpler for automated systems that cannot sign EIP-712 messages

Use the Trading API's `/check_approval` endpoint — it returns the correct approval target based on the routing type.

### How It Works

1. User approves Permit2 contract once (infinite approval)
2. For each swap, user signs a message authorizing the transfer
3. Universal Router uses signature to transfer tokens via Permit2

### Two Modes

| Mode              | Description                                |
| ----------------- | ------------------------------------------ |
| SignatureTransfer | One-time signature, no on-chain state      |
| AllowanceTransfer | Time-limited allowance with on-chain state |

### Integration Pattern

```typescript
import { getContract, maxUint256, type Address } from 'viem';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;

// Check if Permit2 approval exists
const allowance = await publicClient.readContract({
  address: PERMIT2_ADDRESS,
  abi: permit2Abi,
  functionName: 'allowance',
  args: [userAddress, tokenAddress, spenderAddress],
});

// If not approved, user must approve Permit2 first
if (allowance.amount < requiredAmount) {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [PERMIT2_ADDRESS, maxUint256],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

// Then sign permit for the swap
const permitSignature = await signPermit(...);
```

---

## UniswapX Auction Types

UniswapX routes swaps through off-chain fillers who compete to execute orders at better prices than on-chain AMMs. The auction mechanism varies by chain.

### Exclusive Dutch Auction (Ethereum)

- Starts with an RFQ (Request for Quote) phase where permissioned quoters compete
- Winning quoter receives **exclusive filling rights** for a set period
- If the exclusive filler doesn't execute, falls back to an open Dutch auction where the price decays each block
- Best for large swaps where MEV protection matters most

**Trading API routing type**: `DUTCH_V2` or `DUTCH_V3`

### Open Dutch Auction (Arbitrum)

- Direct open auction without an RFQ phase
- Fillers compete on-chain through a descending price mechanism
- Leverages Arbitrum's fast 0.25-second block times for rapid price discovery
- The **Unimind algorithm** sets auction parameters based on historical pair performance

**Trading API routing type**: `DUTCH_V2`

### Priority Gas Auction (Base, Unichain)

- Fillers bid by submitting transactions with varying **priority fees** at a target block
- Highest priority fee wins the right to fill the order
- Exploits OP Stack's priority ordering mechanism
- Effective on chains where block builders respect priority ordering

**Trading API routing type**: `PRIORITY`

### Key Properties (All Auction Types)

- **Gasless for users** — fillers pay gas fees, incorporated into final pricing
- **No cost on failure** — if a swap doesn't fill, the user pays nothing
- **MEV protection** — auction mechanics prevent frontrunning and sandwich attacks
- UniswapX V2 is currently supported on Ethereum (1), Arbitrum (42161), Base (8453), and Unichain (130)

For more detail, see the [UniswapX Auction Types documentation](https://docs.uniswap.org/contracts/uniswapx/auctiontypes).

---

## Direct Universal Router Integration (SDK)

For direct Universal Router integration without the Trading API, use the SDK's high-level API.

### Installation

```bash
npm install @uniswap/universal-router-sdk @uniswap/router-sdk @uniswap/sdk-core @uniswap/v3-sdk viem
```

### High-Level Approach (Recommended)

Use `RouterTrade` + `SwapRouter.swapCallParameters()` for automatic command building:

```typescript
import { SwapRouter } from '@uniswap/universal-router-sdk';
import { Trade as RouterTrade } from '@uniswap/router-sdk';
import { TradeType, Percent } from '@uniswap/sdk-core';
import { Route as V3Route, Pool } from '@uniswap/v3-sdk';

// 1. Fetch pool data (required to construct routes)
// Using viem to read on-chain pool state:
const slot0 = await publicClient.readContract({
  address: poolAddress,
  abi: [
    {
      name: 'slot0',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [
        { name: 'sqrtPriceX96', type: 'uint160' },
        { name: 'tick', type: 'int24' },
        { name: 'observationIndex', type: 'uint16' },
        { name: 'observationCardinality', type: 'uint16' },
        { name: 'observationCardinalityNext', type: 'uint16' },
        { name: 'feeProtocol', type: 'uint8' },
        { name: 'unlocked', type: 'bool' },
      ],
    },
  ],
  functionName: 'slot0',
});
const liquidity = await publicClient.readContract({
  address: poolAddress,
  abi: [
    {
      name: 'liquidity',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'uint128' }],
    },
  ],
  functionName: 'liquidity',
});

const pool = new Pool(tokenIn, tokenOut, fee, slot0[0].toString(), liquidity.toString(), slot0[1]);

// 2. Build route and trade
const route = new V3Route([pool], tokenIn, tokenOut);
const trade = RouterTrade.createUncheckedTrade({
  route,
  inputAmount: amountIn,
  outputAmount: expectedOut,
  tradeType: TradeType.EXACT_INPUT,
});

// 3. Get calldata
const { calldata, value } = SwapRouter.swapCallParameters(trade, {
  slippageTolerance: new Percent(50, 10000), // 0.5%
  recipient: walletAddress,
  deadline: Math.floor(Date.now() / 1000) + 1800,
});

// 4. Execute with viem
const hash = await walletClient.sendTransaction({
  to: UNIVERSAL_ROUTER_ADDRESS,
  data: calldata,
  value: BigInt(value),
});
```

### Low-Level Approach (Manual Commands)

For custom flows (fee collection, complex routing), use `RoutePlanner` directly:

```typescript
import { RoutePlanner, CommandType, ROUTER_AS_RECIPIENT } from '@uniswap/universal-router-sdk';
import { encodeRouteToPath } from '@uniswap/v3-sdk';

// Special addresses
const MSG_SENDER = '0x0000000000000000000000000000000000000001';
const ADDRESS_THIS = '0x0000000000000000000000000000000000000002';
```

### Example: V3 Swap with Manual Commands

```typescript
import { RoutePlanner, CommandType } from '@uniswap/universal-router-sdk';
import { encodeRouteToPath, Route } from '@uniswap/v3-sdk';

async function swapV3Manual(route: Route, amountIn: bigint, amountOutMin: bigint) {
  const planner = new RoutePlanner();

  // Encode V3 path from route
  const path = encodeRouteToPath(route, false); // false = exactInput

  planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
    MSG_SENDER, // recipient
    amountIn, // amountIn
    amountOutMin, // amountOutMin
    path, // encoded path
    true, // payerIsUser
  ]);

  return executeRoute(planner);
}
```

### Example: ETH to Token (Wrap + Swap)

```typescript
async function swapEthToToken(route: Route, amountIn: bigint, amountOutMin: bigint) {
  const planner = new RoutePlanner();
  const path = encodeRouteToPath(route, false);

  // 1. Wrap ETH to WETH (keep in router)
  planner.addCommand(CommandType.WRAP_ETH, [ADDRESS_THIS, amountIn]);

  // 2. Swap WETH → Token (payerIsUser = false since using router's WETH)
  planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
    MSG_SENDER,
    amountIn,
    amountOutMin,
    path,
    false,
  ]);

  return executeRoute(planner, { value: amountIn });
}
```

### Example: Token to ETH (Swap + Unwrap)

```typescript
async function swapTokenToEth(route: Route, amountIn: bigint, amountOutMin: bigint) {
  const planner = new RoutePlanner();
  const path = encodeRouteToPath(route, false);

  // 1. Swap Token → WETH (output to router)
  planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
    ADDRESS_THIS,
    amountIn,
    amountOutMin,
    path,
    true,
  ]);

  // 2. Unwrap WETH to ETH
  planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, amountOutMin]);

  return executeRoute(planner);
}
```

### Example: Fee Collection with PAY_PORTION

```typescript
async function swapWithFee(route: Route, amountIn: bigint, feeRecipient: Address, feeBips: number) {
  const planner = new RoutePlanner();
  const path = encodeRouteToPath(route, false);
  const outputToken = route.output.wrapped.address;

  // Swap to router (ADDRESS_THIS)
  planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [ADDRESS_THIS, amountIn, 0n, path, true]);

  // Pay fee portion (e.g., 30 bips = 0.3%)
  planner.addCommand(CommandType.PAY_PORTION, [outputToken, feeRecipient, feeBips]);

  // Sweep remainder to user
  planner.addCommand(CommandType.SWEEP, [outputToken, MSG_SENDER, 0n]);

  return executeRoute(planner);
}
```

### Execute Route Helper

```typescript
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk';

const ROUTER_ABI = [
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

async function executeRoute(planner: RoutePlanner, options?: { value?: bigint }) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
  const routerAddress = UNIVERSAL_ROUTER_ADDRESS('2.0', 1); // version, chainId

  const { request } = await publicClient.simulateContract({
    address: routerAddress,
    abi: ROUTER_ABI,
    functionName: 'execute',
    args: [planner.commands, planner.inputs, deadline],
    account,
    value: options?.value ?? 0n,
  });

  return walletClient.writeContract(request);
}
```

### Command Cheat Sheet

| Command           | Parameters                                               |
| ----------------- | -------------------------------------------------------- |
| V3_SWAP_EXACT_IN  | (recipient, amountIn, amountOutMin, path, payerIsUser)   |
| V3_SWAP_EXACT_OUT | (recipient, amountOut, amountInMax, path, payerIsUser)   |
| V2_SWAP_EXACT_IN  | (recipient, amountIn, amountOutMin, path[], payerIsUser) |
| V2_SWAP_EXACT_OUT | (recipient, amountOut, amountInMax, path[], payerIsUser) |
| WRAP_ETH          | (recipient, amount)                                      |
| UNWRAP_WETH       | (recipient, amountMin)                                   |
| SWEEP             | (token, recipient, amountMin)                            |
| TRANSFER          | (token, recipient, amount)                               |
| PAY_PORTION       | (token, recipient, bips)                                 |

### Fee Tiers

| Tier   | Value | Percentage |
| ------ | ----- | ---------- |
| LOWEST | 100   | 0.01%      |
| LOW    | 500   | 0.05%      |
| MEDIUM | 3000  | 0.30%      |
| HIGH   | 10000 | 1.00%      |

---

## Common Integration Patterns

### Frontend Swap Hook (React)

**Note**: Ensure you've set up the Buffer polyfill and CORS proxy (see Critical Implementation Notes). For wagmi v2 `useWalletClient()` pitfalls, see [wagmi v2 Integration Pitfalls](#wagmi-v2-integration-pitfalls) below.

```typescript
import { isAddress, isHex } from 'viem';
import { useWalletClient } from 'wagmi';

// In browser apps, use your CORS proxy path instead (see CORS Proxy Configuration)
// e.g., const API_URL = '/api/uniswap';
const API_URL = 'https://trade-api.gateway.uniswap.org/v1';

function useSwap() {
  const { data: walletClient } = useWalletClient();
  const [quoteResponse, setQuoteResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getQuote = async (params) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'x-universal-router-version': '2.0',
        },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Quote failed');
      setQuoteResponse(data); // Store the FULL response, not just data.quote
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async (permit2Signature?: string) => {
    if (!quoteResponse) throw new Error('No quote available');

    // CRITICAL: Strip null fields and spread quote response into body
    const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;

    const swapRequest: Record<string, unknown> = {
      ...cleanQuote,
    };

    // CRITICAL: Only include permitData if we have BOTH signature and permitData
    // The API requires both fields to be present or both to be absent
    if (permit2Signature && permitData && typeof permitData === 'object') {
      swapRequest.signature = permit2Signature;
      swapRequest.permitData = permitData;
    }

    const swapResponse = await fetch(`${API_URL}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-universal-router-version': '2.0',
      },
      body: JSON.stringify(swapRequest),
    });
    const data = await swapResponse.json();
    if (!swapResponse.ok) throw new Error(data.detail || 'Swap failed');

    // CRITICAL: Validate response before broadcasting
    if (!data.swap?.data || data.swap.data === '' || data.swap.data === '0x') {
      throw new Error('Empty swap data - quote may have expired. Please refresh.');
    }

    // Send transaction via wallet (walletClient from useWalletClient())
    if (!walletClient) throw new Error('Wallet not connected');
    const tx = await walletClient.sendTransaction(data.swap);
    return tx;
  };

  return { quote: quoteResponse?.quote, loading, error, getQuote, executeSwap };
}
```

### wagmi v2 Integration Pitfalls

The `useWalletClient()` hook from wagmi v2 can return `undefined` even when the wallet is connected — it resolves asynchronously. This causes "wallet not connected" errors at swap time. Additionally, the returned client needs a `chain` for `sendTransaction()` to work.

**Recommended pattern** — use `@wagmi/core` action functions at swap time instead of hooks:

```typescript
import { getWalletClient, getPublicClient, switchChain } from '@wagmi/core';
import type { Config } from 'wagmi';

async function executeSwapTransaction(
  config: Config,
  chainId: number,
  swapTx: { to: string; data: string; value: string }
) {
  // 1. Ensure the wallet is on the correct chain
  await switchChain(config, { chainId });

  // 2. Get wallet client with explicit chainId — avoids undefined and missing chain
  const walletClient = await getWalletClient(config, { chainId });

  // 3. Execute the swap
  const hash = await walletClient.sendTransaction({
    to: swapTx.to as `0x${string}`,
    data: swapTx.data as `0x${string}`,
    value: BigInt(swapTx.value || '0'),
  });

  // 4. Wait for confirmation
  const publicClient = getPublicClient(config, { chainId });
  if (!publicClient) throw new Error(`No public client configured for chainId ${chainId}`);
  return publicClient.waitForTransactionReceipt({ hash });
}
```

**Why this matters**:

- `useWalletClient()` hook returns `{ data: undefined }` during async resolution, even after `useAccount()` shows connected
- `getWalletClient(config, { chainId })` is a promise that resolves only when the client is ready, and includes the chain
- `switchChain()` prevents "chain mismatch" errors when the wallet is on a different network than the swap

### Backend Swap Script (Node.js)

```typescript
import { createWalletClient, createPublicClient, http, isAddress, isHex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const API_URL = 'https://trade-api.gateway.uniswap.org/v1';
const API_KEY = process.env.UNISWAP_API_KEY!;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: mainnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mainnet, transport: http() });

// Helper to strip null fields from quote response
function prepareSwapRequest(quoteResponse: Record<string, unknown>, signature?: string): object {
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;

  const request: Record<string, unknown> = { ...cleanQuote };

  // CRITICAL: Only include permitData if we have BOTH signature and permitData
  // The API requires both fields to be present or both to be absent
  if (signature && permitData && typeof permitData === 'object') {
    request.signature = signature;
    request.permitData = permitData;
  }

  return request;
}

// Validate swap response before broadcasting
function validateSwap(swap: { data?: string; to?: string; from?: string }): void {
  if (!swap?.data || swap.data === '' || swap.data === '0x') {
    throw new Error('swap.data is empty - quote may have expired');
  }
  if (!isHex(swap.data)) {
    throw new Error('swap.data is not valid hex');
  }
  if (!swap.to || !isAddress(swap.to) || !swap.from || !isAddress(swap.from)) {
    throw new Error('Invalid address in swap response');
  }
}

async function executeSwap(tokenIn: Address, tokenOut: Address, amount: string, chainId: number) {
  const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

  // 1. Check approval (for ERC20 tokens, not native ETH)
  if (tokenIn !== ETH_ADDRESS) {
    const approvalRes = await fetch(`${API_URL}/check_approval`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
        'x-universal-router-version': '2.0',
      },
      body: JSON.stringify({
        walletAddress: account.address,
        token: tokenIn,
        amount,
        chainId,
      }),
    });
    const approvalData = await approvalRes.json();

    if (approvalData.approval) {
      const hash = await walletClient.sendTransaction({
        to: approvalData.approval.to,
        data: approvalData.approval.data,
        value: BigInt(approvalData.approval.value || '0'),
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }

  // 2. Get quote
  const quoteRes = await fetch(`${API_URL}/quote`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      'x-universal-router-version': '2.0',
    },
    body: JSON.stringify({
      swapper: account.address,
      tokenIn,
      tokenOut,
      tokenInChainId: String(chainId),
      tokenOutChainId: String(chainId),
      amount,
      type: 'EXACT_INPUT',
      slippageTolerance: 0.5,
    }),
  });
  const quoteResponse = await quoteRes.json(); // Store FULL response

  if (!quoteRes.ok) {
    throw new Error(quoteResponse.detail || 'Quote failed');
  }

  // 3. Execute swap - CRITICAL: spread quote response, strip null fields
  const swapRequest = prepareSwapRequest(quoteResponse);

  const swapRes = await fetch(`${API_URL}/swap`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      'x-universal-router-version': '2.0',
    },
    body: JSON.stringify(swapRequest),
  });
  const swapData = await swapRes.json();

  if (!swapRes.ok) {
    throw new Error(swapData.detail || 'Swap request failed');
  }

  // 4. Validate before broadcasting
  validateSwap(swapData.swap);

  const hash = await walletClient.sendTransaction({
    to: swapData.swap.to,
    data: swapData.swap.data,
    value: BigInt(swapData.swap.value || '0'),
  });
  return publicClient.waitForTransactionReceipt({ hash });
}
```

### Smart Contract Integration (Solidity)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUniversalRouter {
    function execute(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

contract SwapIntegration {
    IUniversalRouter public immutable router;
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    constructor(address _router) {
        router = IUniversalRouter(_router);
    }

    function swap(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable {
        router.execute{value: msg.value}(commands, inputs, deadline);
    }

    // Approve token for Permit2 (one-time setup)
    function approveToken(address token) external {
        IERC20(token).approve(PERMIT2, type(uint256).max);
    }
}
```

---

## Advanced Patterns

### Smart Account Integration (ERC-4337)

Execute Trading API swaps through ERC-4337 smart accounts with delegation. The pattern:

1. Get swap calldata from Trading API (standard 3-step flow)
2. Wrap the calldata in a delegation redemption execution
3. Submit via bundler as a UserOperation

```typescript
// After getting swap calldata from Trading API:
const { to, data, value } = swapResponse.swap;

// Wrap in delegation execution
const execution = {
  target: to, // Universal Router
  callData: data,
  value: BigInt(value),
};

// Submit via bundler
const userOpHash = await bundlerClient.sendUserOperation({
  account: delegateSmartAccount,
  calls: [
    {
      to: delegationManagerAddress,
      data: encodeFunctionData({
        abi: delegationManagerAbi,
        functionName: 'redeemDelegations',
        args: [[[signedDelegation]], [0], [[execution]]],
      }),
      value: execution.value,
    },
  ],
});
```

**Key considerations**:

- Use legacy approvals (direct to Universal Router) instead of Permit2 for smart accounts — see [Approval Target](#approval-target-permit2-vs-legacy-direct-to-router)
- Add 20-30% gas buffer for bundler gas estimation
- Handle bundler-specific error codes separately from standard transaction errors

See [Advanced Patterns Reference](./references/advanced-patterns.md#smart-account-integration-erc-4337) for the complete implementation with types and error handling.

### WETH Handling on L2s

On L2 chains (Base, Optimism, Arbitrum), swaps outputting ETH may deliver WETH instead of native ETH. Always check and unwrap after swaps:

```typescript
import { parseAbi, type Address } from 'viem';

const WETH_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function withdraw(uint256)',
]);

const WETH_ADDRESSES: Record<number, Address> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  10: '0x4200000000000000000000000000000000000006',
  8453: '0x4200000000000000000000000000000000000006',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
};

// After swap completes on an L2:
const wethAddress = WETH_ADDRESSES[chainId];
if (wethAddress) {
  const wethBalance = await publicClient.readContract({
    address: wethAddress,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [accountAddress],
  });

  if (wethBalance > 0n) {
    const hash = await walletClient.writeContract({
      address: wethAddress,
      abi: WETH_ABI,
      functionName: 'withdraw',
      args: [wethBalance],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
}
```

See [Advanced Patterns Reference](./references/advanced-patterns.md#weth-handling-on-l2s) for chain-specific WETH addresses and integration details.

### Rate Limiting

The Trading API enforces rate limits (~10 requests/second per endpoint). For batch operations:

- Add **100-200ms delays** between sequential API calls
- Implement **exponential backoff with jitter** on 429 responses
- **Cache approval results** — approvals rarely change between calls

```typescript
// Exponential backoff for 429 responses
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 5): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt === maxRetries) throw new Error(`Failed after ${maxRetries} retries`);

    const delay = Math.min(200 * Math.pow(2, attempt) + Math.random() * 100, 10000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('Unreachable');
}
```

See [Advanced Patterns Reference](./references/advanced-patterns.md#rate-limiting-best-practices) for batch operation patterns and full retry implementation.

---

## Key Contract Addresses

### Universal Router (v4)

Addresses are per-chain. The legacy v1 address `0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD` is deprecated.

| Chain       | ID      | Address                                      |
| ----------- | ------- | -------------------------------------------- |
| Ethereum    | 1       | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` |
| Unichain    | 130     | `0xef740bf23acae26f6492b10de645d6b98dc8eaf3` |
| Optimism    | 10      | `0x851116d9223fabed8e56c0e6b8ad0c31d98b3507` |
| Base        | 8453    | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Arbitrum    | 42161   | `0xa51afafe0263b40edaef0df8781ea9aa03e381a3` |
| Polygon     | 137     | `0x1095692a6237d83c6a72f3f5efedb9a670c49223` |
| Blast       | 81457   | `0xeabbcb3e8e415306207ef514f660a3f820025be3` |
| BNB         | 56      | `0x1906c1d672b88cd1b9ac7593301ca990f94eae07` |
| Zora        | 7777777 | `0x3315ef7ca28db74abadc6c44570efdf06b04b020` |
| World Chain | 480     | `0x8ac7bee993bb44dab564ea4bc9ea67bf9eb5e743` |
| Avalanche   | 43114   | `0x94b75331ae8d42c1b61065089b7d48fe14aa73b7` |
| Celo        | 42220   | `0xcb695bc5d3aa22cad1e6df07801b061a05a0233a` |
| Soneium     | 1868    | `0x4cded7edf52c8aa5259a54ec6a3ce7c6d2a455df` |
| Ink         | 57073   | `0x112908dac86e20e7241b0927479ea3bf935d1fa0` |
| Monad       | 143     | `0x0d97dc33264bfc1c226207428a79b26757fb9dc3` |

For testnet addresses, see [Uniswap v4 Deployments](https://docs.uniswap.org/contracts/v4/deployments).

### Permit2

| Chain      | Address                                      |
| ---------- | -------------------------------------------- |
| All chains | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## Troubleshooting

### Common Issues

| Issue                                                  | Solution                                                                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Insufficient allowance"                               | Call /check_approval first and submit approval tx                                                                                                        |
| "Quote expired"                                        | Increase deadline or re-fetch quote                                                                                                                      |
| "Slippage exceeded"                                    | Increase slippageTolerance or retry                                                                                                                      |
| "Insufficient liquidity"                               | Try smaller amount or different route                                                                                                                    |
| **"Buffer is not defined"**                            | Add Buffer polyfill (see Critical Implementation Notes)                                                                                                  |
| **On-chain revert with empty data**                    | Validate `swap.data` is non-empty hex before broadcasting                                                                                                |
| **"permitData must be of type object"**                | Strip `permitData: null` from request - omit field entirely                                                                                              |
| **"quote does not match any of the allowed types"**    | Don't wrap quote in `{quote: ...}` - spread it into request body                                                                                         |
| **Received WETH instead of ETH on L2**                 | Check and unwrap WETH after swap (see [WETH Handling on L2s](#weth-handling-on-l2s))                                                                     |
| **429 Too Many Requests**                              | Implement exponential backoff and add delays between batch requests (see [Rate Limiting](#rate-limiting))                                                |
| **415 on OPTIONS preflight / CORS error**              | Set up a CORS proxy (see [CORS Proxy Configuration](#cors-proxy-configuration) in Browser Environment Setup)                                             |
| **walletClient is undefined when wallet is connected** | Use `getWalletClient()` from `@wagmi/core` instead of the `useWalletClient()` hook (see [wagmi v2 Integration Pitfalls](#wagmi-v2-integration-pitfalls)) |
| **"Please provide a chain with the chain argument"**   | Pass `chainId` to `getWalletClient(config, { chainId })`                                                                                                 |
| **Chain mismatch error on swap**                       | Call `switchChain()` before `getWalletClient()` (see [wagmi v2 Integration Pitfalls](#wagmi-v2-integration-pitfalls))                                    |

### API Validation Errors (400)

| Error Message                                     | Cause                                      | Fix                                         |
| ------------------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| `"permitData" must be of type object`             | Sending `permitData: null`                 | Omit the field entirely when null           |
| `"quote" does not match any of the allowed types` | Wrapping quote in `{quote: quoteResponse}` | Spread quote response: `{...quoteResponse}` |
| `signature and permitData must both be present`   | Including only one Permit2 field           | Include both or neither                     |

### API Error Codes

| Code | Meaning                                                  |
| ---- | -------------------------------------------------------- |
| 400  | Invalid request parameters (see validation errors above) |
| 401  | Invalid or missing API key                               |
| 404  | No route found for pair                                  |
| 429  | Rate limit exceeded                                      |
| 500  | API error - implement exponential backoff retry          |

### Pre-Broadcast Checklist

Before sending a swap transaction to the blockchain:

1. **Verify `swap.data`** is non-empty hex (not `''`, not `'0x'`)
2. **Verify addresses** - `swap.to` and `swap.from` are valid
3. **Check quote freshness** - Re-fetch if older than 30 seconds
4. **Validate gas** - Apply 10-20% buffer to estimates
5. **Confirm balance** - User has sufficient token balance

---

## Additional Resources

- [Universal Router GitHub](https://github.com/Uniswap/universal-router)
- [Uniswap Docs](https://docs.uniswap.org)
- [SDK Monorepo](https://github.com/Uniswap/sdks)
- [Permit2 Patterns](https://github.com/dragonfly-xyz/useful-solidity-patterns/tree/main/patterns/permit2)
