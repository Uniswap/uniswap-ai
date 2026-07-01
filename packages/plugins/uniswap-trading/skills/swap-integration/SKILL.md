---
name: swap-integration
description: Integrate Uniswap swaps into applications. Use when user says "integrate swaps", "uniswap", "trading api", "add swap functionality", "build a swap frontend", "create a swap script", "swap bot", "smart contract swap integration", "use Universal Router", "Trading API", "uni CLI", or mentions swapping tokens via Uniswap.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(uni:*), Bash(bun:*), Bash(npm:*), Bash(npx:*), Bash(yarn:*), Bash(curl:*), WebFetch, Task(subagent_type:swap-integration-expert)
model: opus
license: MIT
metadata:
  author: uniswap
  version: '2.0.0'
---

# Swap Integration

Integrate Uniswap swaps into scripts, agents, frontends, and smart contracts.

There are two supported "swap engines" that handle the hard parts (routing, approvals, Permit2, routing-aware output) for you, plus lower-level fallbacks for cases they don't cover:

- **The `uni` CLI** — drive swaps from a script, agent, or shell. Preview-by-default; a swap only sends with `--execute`.
- **The `@uniswap/sdk` facade** — a typed `createUniswapClient(...)` you call from a frontend or Node app instead of hand-rolling `fetch` to the Trading API.

Both wrap the Uniswap Trading API. Prefer them over hand-rolling the raw REST calls, because they absorb the request-body/permit/routing gotchas that this skill used to spend pages teaching. Reach for the raw Trading API (Method 3) or the lower-level engines (Universal Router SDK / contracts / smart accounts) only when an engine genuinely can't drive your case — those cases are called out explicitly below.

> **MVP status (read this — it changes how you install).** As of this skill version the `uni` CLI and `@uniswap/sdk` are an **early / EOA-only MVP** and are **not yet published to npm**. You run them from a checkout of the [`Uniswap/uni-cli`](https://github.com/Uniswap/uni-cli) repo (`bun install`), not via `npm install -g`. What they cover today: same-chain and cross-chain swaps, quotes, and Permit2 inspection, for **externally-owned accounts (EOAs)**. What they do **not** cover today: ERC-4337 smart accounts / bundlers, direct Universal Router command encoding, and standalone WETH-unwrap helpers. For those, use the lower-level methods, which are unchanged. See [MVP surface & known gaps](#mvp-surface--known-gaps) before you pick a method.

## Prerequisites

This skill assumes familiarity with viem basics (client setup, account management, contract interactions, transaction signing). Install the **uniswap-viem** plugin for comprehensive viem/wagmi guidance: `claude plugin add @uniswap/uniswap-viem`

The `uni` CLI additionally needs [`bun`](https://bun.sh) and a checkout of `Uniswap/uni-cli` (see [Method 1](#1-uni-cli-scripts-agents-backends)). All engines need a Trading API key (see [Getting an API Key](#getting-an-api-key)).

## Quick Decision Guide

| Building...                                         | Use This Method                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A script, agent, bot, or CLI-driven backend         | [`uni` CLI](#1-uni-cli-scripts-agents-backends)                                                                   |
| A frontend / Node app (want typed calls, not fetch) | [`@uniswap/sdk` facade](#2-uniswapsdk-facade-frontends-and-apps)                                                  |
| A stack that can't run the CLI or import the SDK    | [Raw Trading API](#3-raw-trading-api-fallback)                                                                    |
| Full control over routing / manual command building | [Universal Router SDK](#universal-router-reference)                                                               |
| On-chain / Solidity integration                     | [Smart contract calls](#direct-universal-router-integration-sdk)                                                  |
| ERC-4337 smart account with a bundler               | [Raw Trading API](#3-raw-trading-api-fallback) + [Smart Account Integration](#smart-account-integration-erc-4337) |

Both the CLI and the SDK are EOA-only today. If your case needs a smart account, direct Universal Router encoding, or a WETH-unwrap step, drop to the raw Trading API / SDK / contract methods — the CLI and facade don't drive those yet (see [known gaps](#mvp-surface--known-gaps)).

### Routing Types Quick Reference

| Type     | Description                             | Chains                             |
| -------- | --------------------------------------- | ---------------------------------- |
| CLASSIC  | Standard AMM swap through Uniswap pools | All supported chains               |
| DUTCH_V2 | UniswapX Dutch auction V2               | Ethereum, Arbitrum, Base, Unichain |
| PRIORITY | MEV-protected priority order            | Base, Unichain                     |
| WRAP     | ETH to WETH conversion                  | All                                |
| UNWRAP   | WETH to ETH conversion                  | All                                |

See [Routing Types](#routing-types) for the complete list including DUTCH_V3, DUTCH_LIMIT, LIMIT_ORDER, BRIDGE, and QUICKROUTE. With the CLI and SDK you rarely name a routing type — the engine picks it. You read it off the response (the `routing` field) to know what happened.

## Integration Methods

### 1. `uni` CLI (scripts, agents, backends)

Best for: shell scripts, coding agents, bots, and any backend that can shell out. The CLI wraps the Trading API and does the whole flow — quote, ERC-20 approval, Permit2 signing, submission, confirmation — behind three commands. You do not construct request bodies, pair `signature` with `permitData`, strip null fields, or read routing-specific output shapes: the CLI does all of that internally. **This is the whole point — the gotchas in the [Trading API Reference](#trading-api-reference) below are what the CLI absorbs.**

**Setup** (MVP — from a checkout, not npm):

```bash
git clone https://github.com/Uniswap/uni-cli
cd uni-cli
bun install
echo 'UNI_API_KEY=your-key' >> .env          # or TRADING_API_KEY
echo 'UNI_PRIVATE_KEY=0x...' >> .env          # EOA signer; or UNI_MNEMONIC=...
bun run uni --help                            # from inside the checkout
```

Invoke with `bun run uni <cmd>` from inside the checkout (or `uni <cmd>` if it's on your PATH). `quote` needs no signer; only `swap --execute` does.

**The golden loop** — preview, then execute:

```bash
# 1. Quote (read-only, no signer, no tx). Read `routing` and `outputAmount`.
uni quote USDC ETH 100 --chain base --format json

# 2. Execute. The CLI checks/does the ERC-20 approval, signs Permit2 if needed,
#    submits the swap, and waits for confirmation — all in one command.
uni swap USDC ETH 100 --chain base --execute \
  --filter-output routing,outputAmount,txHash,status,explorerUrl
```

That is the entire backend flow. There is no separate `check_approval` / `quote` / `swap` orchestration to write and no permit pairing to get right — `uni swap --execute` is the three-step Trading API flow (`check_approval -> quote -> swap`) collapsed into one gated command.

**Human-approval gate — `--execute`, and there is no `--yes`.** Every `uni swap` is a _preview_ unless you pass `--execute` (alias `-x`). A run without `--execute` prints the quote and prepared calldata and sends nothing. This IS the transaction-confirmation gate: an agent shows the preview to the user, and only adds `--execute` after the user approves. There is deliberately no `--yes` / `--force-send` flag, so a tx can never be sent by a forgotten confirmation. When driving the CLI on a user's behalf:

> **REQUIRED:** Before running any `uni swap ... --execute` (which spends gas and moves tokens), you MUST show the user the preview (run the same command **without** `--execute`, or `uni quote`) and get explicit approval. Only then re-run with `--execute`. Never add `--execute` without a confirmed user decision.

**Approvals are automatic.** `uni swap --execute` sends a layer-1 ERC-20 -> Permit2 approval tx only when the current allowance is below the amount, and signs a fresh Permit2 permit for layer 2 when the spender allowance is insufficient or expired. To inspect approval state without swapping:

```bash
uni permit2 check USDC --chain base            # both layers side-by-side
```

**Cross-chain** is the same loop with `--to-chain` (routes through BRIDGE or CHAINED automatically):

```bash
uni swap ETH USDC 0.5 --chain ethereum --to-chain base --execute
```

**Structured, token-cheap output.** Default format is TOON; pass `--format json` when piping to `jq`. Every command supports `--filter-output <keys>`, `--token-count`, `--token-limit N`. Introspect the exact surface with `uni --llms-full`, `uni --schema <cmd>`, or `uni <cmd> --help` — prefer these over guessing a flag.

See [Driving the CLI from a script/agent](#driving-the-cli-from-a-scriptagent) for a complete Node example and JSON parsing.

### 2. `@uniswap/sdk` facade (frontends and apps)

Best for: frontends and Node apps that want typed method calls instead of hand-rolled `fetch`. `createUniswapClient(config)` returns a flat client that wraps the Trading API. Like the CLI, it absorbs the permit/routing/body gotchas — you call `client.getQuote(...)`, `client.executeSwap(...)`, etc.

> **MVP status:** `@uniswap/sdk` is **not yet published to npm** (it's `private` in the `Uniswap/uni-cli` monorepo today). Consume it from a workspace checkout, or use [Method 3 (raw Trading API)](#3-raw-trading-api-fallback) until it publishes. The API shape below is stable and is what will publish.

```typescript
// Throws-on-failure variant — idiomatic for try/catch consumers.
import { createUniswapClient } from '@uniswap/sdk';

const client = createUniswapClient({ apiKey: process.env.UNISWAP_API_KEY });

// Quote (read-only). The client picks routing and normalizes the shape.
const quote = await client.getQuote({
  tokenIn: 'ETH',
  tokenOut: 'USDC',
  amount: '1',
  chainId: 8453,
});

// Execute end-to-end: the client runs the approval / Permit2 / submit step
// machine and observes each receipt before the next step. This is the
// equivalent of `uni swap --execute` in-process.
const result = await client.executeSwap({ quote });
```

Errors from the throwing variant are plain tagged objects (`{ _tag: 'TradingApiError', message, ... }`), **not** `instanceof Error` — narrow after `catch` via the `_tag` discriminant. For pattern-matching on typed `Result<A, E>` instead of try/catch, import from `@uniswap/sdk/safe`.

The facade also exposes `checkApproval`, `createSwap` (prepare-only), `getSwapStatus`, `signTypedData`, and `sendTransaction` — so a frontend can wire the exact steps to a connected wallet (wagmi/viem) while still letting the SDK own request construction. Because the SDK owns the request body, the CLASSIC-vs-UniswapX `permitData` rules and the null-field stripping described in the [Trading API Reference](#trading-api-reference) are handled inside `executeSwap` / `createSwap` — you do not reproduce them.

**Frontend wallet wiring** and the browser-environment setup (Buffer polyfill, CORS proxy) are unchanged whether you use the SDK or raw fetch — see [Browser Environment Setup](#5-browser-environment-setup) and [wagmi v2 Integration Pitfalls](#wagmi-v2-integration-pitfalls).

### 3. Raw Trading API (fallback)

Best for: any stack that can't run the CLI or import the SDK yet (other languages, constrained runtimes), and for cases the EOA-only MVP doesn't cover ([smart accounts](#smart-account-integration-erc-4337), etc.). This is the layer the CLI and SDK sit on top of — everything below documents it directly.

**Base URL**: `https://trade-api.gateway.uniswap.org/v1`

**Authentication**: `x-api-key: <your-api-key>` header required

#### Getting an API Key

The Trading API requires an API key for authentication. Visit the [Uniswap Developer Portal](https://developers.uniswap.org/) to register and obtain your API key. Keys are typically available for immediate use after registration. Include it as an `x-api-key` header in all API requests. The `uni` CLI and `@uniswap/sdk` read the same key from `UNI_API_KEY` / `TRADING_API_KEY` / the `apiKey` config field.

**Required Headers** — Include these in ALL Trading API requests:

```text
Content-Type: application/json
x-api-key: <your-api-key>
x-universal-router-version: 2.0
```

**3-Step Flow** (this is exactly what `uni swap --execute` and `client.executeSwap` do for you):

```text
1. POST /check_approval  -> Check if token is approved
2. POST /quote           -> Get executable quote with routing
3. POST /swap            -> Get transaction to sign and submit
```

See the [Trading API Reference](#trading-api-reference) section below for complete documentation of request/response shapes and the permit rules — but remember, if you're on a stack the CLI or SDK supports, they handle all of it.

### Lower-level engines (not driven by the CLI/SDK MVP)

The following are unchanged and remain the right tool when you need control below the Trading API, or a case the EOA-only MVP doesn't cover. The `uni` CLI and `@uniswap/sdk` do **not** drive these:

- **Universal Router SDK** — direct control over transaction construction and manual command building. `npm install @uniswap/universal-router-sdk @uniswap/sdk-core @uniswap/v3-sdk`. See [Universal Router Reference](#universal-router-reference).
- **Smart contract integration** — call `execute()` on Universal Router with encoded commands from Solidity. See [Direct Universal Router Integration](#direct-universal-router-integration-sdk).
- **ERC-4337 smart accounts** — bundler / `sendUserOperation` flow with delegation. See [Smart Account Integration](#smart-account-integration-erc-4337). The CLI/SDK are EOA-only, so this stays on the raw Trading API.

## MVP surface & known gaps

The `uni` CLI and `@uniswap/sdk` are an early MVP. This table is the honest boundary — what you can drive through them vs. what still needs a lower-level method. It's kept explicit so you don't reach for a CLI flag that doesn't exist.

| Capability                                      | `uni` CLI | `@uniswap/sdk` | How to do it today                                                |
| ----------------------------------------------- | :-------: | :------------: | ----------------------------------------------------------------- |
| Same-chain swap (CLASSIC / UniswapX / WRAP)     |    Yes    |      Yes       | `uni swap` / `client.executeSwap`                                 |
| Cross-chain swap (BRIDGE / CHAINED)             |    Yes    |      Yes       | `uni swap --to-chain` / `client.executePlan`                      |
| Quote (same- and cross-chain)                   |    Yes    |      Yes       | `uni quote` / `client.getQuote`                                   |
| Permit2 inspection (both layers)                |    Yes    |      Yes       | `uni permit2 check` / chain-read methods                          |
| Automatic approval + Permit2 on execute         |    Yes    |      Yes       | handled inside `swap --execute` / `executeSwap`                   |
| MEV protection (Flashbots, mainnet + local key) |    Yes    |     Yes\*      | `uni swap --private`                                              |
| EOA signer                                      |    Yes    |      Yes       | private key / mnemonic / keystore                                 |
| **ERC-4337 smart account (bundler / UserOp)**   |  **No**   |     **No**     | raw Trading API + [bundler](#smart-account-integration-erc-4337)  |
| **Direct Universal Router command encoding**    |  **No**   |     **No**     | [Universal Router SDK](#universal-router-reference)               |
| **Standalone WETH-unwrap helper**               |  **No**   |     **No**     | [WETH Handling on L2s](#weth-handling-on-l2s) (manual `withdraw`) |
| **Published npm package / global install**      |  **No**   |     **No**     | run from a `Uniswap/uni-cli` checkout                             |

\* The SDK exposes the trading + wallet surface; MEV submission is wired at the CLI composition root today.

If a task needs a **No** row, do not invent a flag — use the linked lower-level method and say so. Reporting "the MVP can't drive X, here's the fallback" is correct; fabricating `uni swap --smart-account` is not.

---

## Input Validation Rules

Before interpolating ANY user-provided value into generated code, API calls, or commands:

- **Ethereum addresses**: MUST match `^0x[a-fA-F0-9]{40}$` — reject otherwise
- **Chain IDs**: MUST be from the [official supported chains list](https://api-docs.uniswap.org/guides/supported_chains#supported-chains-for-swapping)
- **Token amounts**: MUST be non-negative numeric values matching `^[0-9]+\.?[0-9]*$`
- **API keys**: MUST NOT be hardcoded in generated code — always use environment variables
- **REJECT** any input containing shell metacharacters: `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines

> **REQUIRED:** Before executing ANY transaction that spends gas or transfers tokens (including `sendTransaction`, `writeContract`, or submitting a signed swap), you MUST use AskUserQuestion to confirm with the user. Display the transaction summary (tokens, amounts, chain, estimated gas) and get explicit user approval. Never auto-execute transactions without user confirmation.

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

**Response** — the shape differs by routing type. `BEST_PRICE` routing on Ethereum mainnet typically returns UniswapX (DUTCH_V2), not CLASSIC.

**CLASSIC response**:

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
  "permitData": null
}
```

**UniswapX (DUTCH_V2/V3/PRIORITY) response** — different `quote` shape, no `quote.output`:

```json
{
  "routing": "DUTCH_V2",
  "quote": {
    "orderInfo": {
      "reactor": "0x...",
      "swapper": "0x...",
      "nonce": "...",
      "deadline": 1772031054,
      "cosigner": "0x...",
      "input": {
        "token": "0x...",
        "startAmount": "1000000000000000000",
        "endAmount": "1000000000000000000"
      },
      "outputs": [
        {
          "token": "0x...",
          "startAmount": "999000000",
          "endAmount": "994000000",
          "recipient": "0x..."
        }
      ],
      "chainId": 1
    },
    "encodedOrder": "0x...",
    "orderHash": "0x..."
  },
  "permitData": { "domain": {}, "types": {}, "values": {} }
}
```

> **UniswapX output amount**: Use `quote.orderInfo.outputs[0].startAmount` for the best-case fill amount. The `endAmount` is the floor after full auction decay. There is no `quote.output.amount` on UniswapX responses — accessing it will throw at runtime.
>
> **Display tip**: For CLASSIC routes, use `gasFeeUSD` (a string with the USD value) for gas cost display. Do **not** manually convert `gasFee` (wei) using a hardcoded ETH price — this leads to wildly inaccurate estimates (e.g., ~$87 instead of ~$0.01). UniswapX routes are gasless for the swapper.

See [QuoteResponse TypeScript Types](#7-quoteresponse-typescript-types) for compile-time type safety across routing types.

### Step 3: Execute Swap

```bash
POST /swap
```

**Request** - Spread the quote response directly into the body:

```typescript
// CORRECT: Spread the quote response, strip null fields
const quoteResponse = await fetchQuote(params);

// Always strip permitData/permitTransaction — handle them explicitly by routing type
const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
const swapRequest: Record<string, unknown> = { ...cleanQuote };

const isUniswapX =
  quoteResponse.routing === 'DUTCH_V2' ||
  quoteResponse.routing === 'DUTCH_V3' ||
  quoteResponse.routing === 'PRIORITY';

if (isUniswapX) {
  // UniswapX: signature only — permitData must NOT go to /swap
  if (permit2Signature) swapRequest.signature = permit2Signature;
} else {
  // CLASSIC: both signature and permitData, or neither
  if (permit2Signature && permitData && typeof permitData === 'object') {
    swapRequest.signature = permit2Signature;
    swapRequest.permitData = permitData;
  }
}
```

**Critical**: Do NOT wrap the quote in `{quote: quoteResponse}`. The API expects the quote response fields spread into the request body.

**Permit2 Rules** (CLASSIC routes):

- `signature` and `permitData` must BOTH be present, or BOTH be absent
- Never set `permitData: null` — omit the field entirely
- The quote response often includes `permitData: null` — strip this before sending

**UniswapX Routes** (DUTCH_V2/V3/PRIORITY): `permitData` is used locally to sign the order but must be **excluded** from the `/swap` body. See [Signing vs. Submission Flow](#uniswapx-signing-vs-submission-flow).

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

See the [official supported chains list](https://api-docs.uniswap.org/guides/supported_chains#supported-chains-for-swapping) for the current set of chains and their IDs.

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

The API rejects `permitData: null`. Additionally, `permitData` handling differs by routing type — see [Signing vs. Submission Flow](#uniswapx-signing-vs-submission-flow) for the full explanation.

```typescript
function prepareSwapRequest(quoteResponse: QuoteResponse, signature?: string): object {
  // Always strip permitData and permitTransaction from the spread — handle them explicitly
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
  const request: Record<string, unknown> = { ...cleanQuote };

  // UniswapX (DUTCH_V2, DUTCH_V3, PRIORITY): permitData is for LOCAL signing only.
  // The /swap body must NOT include permitData — the order is encoded in
  // quote.encodedOrder. Only the signature is needed.
  const isUniswapX =
    quoteResponse.routing === 'DUTCH_V2' ||
    quoteResponse.routing === 'DUTCH_V3' ||
    quoteResponse.routing === 'PRIORITY';

  if (isUniswapX) {
    if (signature) request.signature = signature;
  } else {
    // CLASSIC: both signature and permitData required together, or both omitted.
    // The Universal Router contract needs permitData to verify the Permit2
    // authorization on-chain.
    if (signature && permitData && typeof permitData === 'object') {
      request.signature = signature;
      request.permitData = permitData;
    }
  }

  return request;
}
```

### 3. Permit2 Field Rules

The rules for `signature` and `permitData` in the `/swap` request body depend on the routing type:

**CLASSIC routes**:

| Scenario                   | `signature` | `permitData` |
| -------------------------- | ----------- | ------------ |
| Standard swap (no Permit2) | Omit        | Omit         |
| Permit2 swap               | Required    | Required     |
| **Invalid**                | Present     | Missing      |
| **Invalid**                | Missing     | Present      |
| **Invalid (API error)**    | Any         | `null`       |

**UniswapX routes (DUTCH_V2/V3/PRIORITY)**:

| Scenario       | `signature` | `permitData`             |
| -------------- | ----------- | ------------------------ |
| UniswapX order | Required    | **Omit** (do not send)   |
| **Invalid**    | Any         | Present (schema rejects) |

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

### 7. QuoteResponse TypeScript Types

The quote response shape differs by routing type. Use a discriminated union on the `routing` field to get compile-time safety instead of casting to `any`:

```typescript
type ClassicQuoteResponse = {
  routing: 'CLASSIC' | 'WRAP' | 'UNWRAP';
  quote: {
    input: { token: string; amount: string };
    output: { token: string; amount: string };
    slippage: number;
    route: unknown[];
    gasFee: string;
    gasFeeUSD: string;
    gasUseEstimate: string;
  };
  permitData: Record<string, unknown> | null;
};

type DutchOrderOutput = {
  token: string;
  startAmount: string;
  endAmount: string;
  recipient: string;
};

type UniswapXQuoteResponse = {
  routing: 'DUTCH_V2' | 'DUTCH_V3' | 'PRIORITY';
  quote: {
    orderInfo: {
      outputs: DutchOrderOutput[];
      input: { token: string; startAmount: string; endAmount: string };
      deadline: number;
      nonce: string;
    };
    encodedOrder: string;
    orderHash: string;
  };
  // EIP-712 typed data — sign locally, do NOT send to /swap
  permitData: Record<string, unknown> | null;
};

type QuoteResponse = ClassicQuoteResponse | UniswapXQuoteResponse;

// Type guard for routing-aware logic
function isUniswapXQuote(q: QuoteResponse): q is UniswapXQuoteResponse {
  return q.routing === 'DUTCH_V2' || q.routing === 'DUTCH_V3' || q.routing === 'PRIORITY';
}

// Reading the output amount by routing type
function getOutputAmount(q: QuoteResponse): string {
  if (isUniswapXQuote(q)) {
    const firstOutput = q.quote.orderInfo.outputs[0];
    if (!firstOutput) throw new Error('UniswapX quote has no outputs');
    // startAmount = best-case fill; endAmount = floor after auction decay
    return firstOutput.startAmount;
  }
  return q.quote.output.amount;
}
```

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

### UniswapX: Signing vs. Submission Flow

The `permitData` field in the quote response serves different purposes depending on the routing type. Conflating the two causes `RequestValidationError` on `/swap`.

**CLASSIC flow** — `permitData` goes to the server:

1. `/quote` returns `permitData` (EIP-712 typed data for the Permit2 allowance)
2. User signs `permitData` locally → produces `signature`
3. `/swap` body includes **both** `signature` and `permitData` — the Universal Router contract needs `permitData` to reconstruct and verify the Permit2 authorization on-chain

**UniswapX flow (DUTCH_V2/V3/PRIORITY)** — `permitData` stays local:

1. `/quote` returns `permitData` (EIP-712 typed data for the Dutch order)
2. User signs `permitData` locally → produces `signature`
3. `/swap` body includes **only** `signature` — the order is already fully encoded in `quote.encodedOrder`, which the off-chain filler system reads directly. Sending `permitData` to `/swap` causes a schema validation error.

| Route Type           | Sign with `permitData`? | Send `permitData` to `/swap`? | Send `signature` to `/swap`? |
| -------------------- | ----------------------- | ----------------------------- | ---------------------------- |
| CLASSIC              | Yes                     | **Yes** (router needs it)     | Yes (if using Permit2)       |
| DUTCH_V2/V3/PRIORITY | Yes                     | **No** (schema rejects it)    | Yes                          |

> **Common mistake**: The API error `"quote" does not match any of the allowed types` often points at the `quote` field, but the actual cause is `permitData` being present for a UniswapX route. Strip `permitData` before submitting — see the routing-aware `prepareSwapRequest` in [Null Field Handling](#2-null-field-handling).

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

### Driving the CLI from a script/agent

This is the **preferred backend pattern**: shell out to `uni` and parse its JSON. The CLI owns the whole Trading API flow (`check_approval -> quote -> swap`), the approval/Permit2 steps, and the routing-aware response reading — so your script is a thin wrapper around two commands, not a re-implementation of the [Backend Swap Script](#backend-swap-script-nodejs--raw-trading-api) below.

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Adjust `cwd` to your uni-cli checkout (MVP runs from a checkout, not npm).
const UNI_CWD = process.env.UNI_CLI_DIR ?? './uni-cli';

async function uni<T>(args: string[]): Promise<T> {
  // Always request JSON for machine parsing (default output is TOON).
  const { stdout } = await run('bun', ['run', 'uni', ...args, '--format', 'json'], {
    cwd: UNI_CWD,
    // UNI_API_KEY / UNI_PRIVATE_KEY are read from the checkout's .env or the
    // inherited environment. Never hardcode keys in the args.
    env: process.env,
  });
  return JSON.parse(stdout) as T;
}

// 1. Preview: read routing + expected output. No signer, no tx.
const quote = await uni<{ routing: string; outputAmount: string }>([
  'quote',
  'USDC',
  'ETH',
  '100',
  '--chain',
  'base',
]);
console.log(`routing=${quote.routing} out=${quote.outputAmount} ETH`);

// 2. HUMAN-APPROVAL GATE: show `quote` to the user and get explicit approval
//    before the next call. `--execute` is the only way a tx sends; there is no
//    `--yes`. Do not add `--execute` without a confirmed user decision.

// 3. Execute: the CLI does approval + Permit2 + submit + confirm in one call.
const result = await uni<{ txHash: string; status: string; explorerUrl: string }>([
  'swap',
  'USDC',
  'ETH',
  '100',
  '--chain',
  'base',
  '--execute',
  '--filter-output',
  'routing,outputAmount,txHash,status,explorerUrl',
]);
console.log(`sent ${result.txHash} (${result.status}) -> ${result.explorerUrl}`);
```

Notes:

- **`--execute` is the gate.** Run step 1 (or `uni swap ...` without `--execute`) to preview; only pass `--execute` after the user approves. There is no `--yes`.
- **Errors** come back as structured JSON with a `code` and `message`, and the process exit code categorizes the failure (`1` input, `2` config, `3` API, `4` wallet, `5` internal) — branch on the exit code, then read `message`.
- **Never interpolate unvalidated user input into the args array** — validate token symbols/addresses, amounts, and chain names first (see [Input Validation Rules](#input-validation-rules)). `execFile` with an args array (not a shell string) already avoids shell-metacharacter injection; keep it that way (do not switch to `exec` with a concatenated command).
- **Discover the surface** with `uni --schema swap` / `uni <cmd> --help` rather than guessing flags. If a capability isn't in [MVP surface & known gaps](#mvp-surface--known-gaps), it isn't there — fall back to the raw API, don't invent a flag.

### Frontend Swap Hook (React) — via `@uniswap/sdk`

Preferred frontend pattern: let the SDK own request construction; wire only the wallet interaction. This replaces the hand-rolled `fetch` + permit-pairing logic in the [raw-fetch hook below](#frontend-swap-hook-react--raw-trading-api).

```typescript
import { useState } from 'react';
import { createUniswapClient } from '@uniswap/sdk';
import { getWalletClient, switchChain } from '@wagmi/core';
import type { Config } from 'wagmi';

// One client per app. Point the SDK's Trading API key at your key.
const client = createUniswapClient({ apiKey: import.meta.env.VITE_UNISWAP_API_KEY });

function useSwap(config: Config, chainId: number) {
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof client.getQuote>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getQuote(tokenIn: string, tokenOut: string, amount: string) {
    setError(null);
    try {
      // SDK picks routing and normalizes the response shape.
      setQuote(await client.getQuote({ tokenIn, tokenOut, amount, chainId }));
    } catch (err) {
      // SDK errors are tagged objects, not Error instances.
      setError(
        err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Quote failed'
      );
    }
  }

  // Called only after the user reviews `quote` and clicks Swap (the UI is the
  // human-approval gate). executeSwap runs the approval/Permit2/submit machine.
  async function executeSwap() {
    if (!quote) throw new Error('No quote available');
    await switchChain(config, { chainId });
    await getWalletClient(config, { chainId }); // ensure a ready wallet client
    return client.executeSwap({ quote });
  }

  return { quote, error, getQuote, executeSwap };
}
```

The SDK handles the CLASSIC-vs-UniswapX `permitData` rules, null-field stripping, and pre-broadcast validation internally — you do not reproduce the [Critical Implementation Notes](#critical-implementation-notes) permit logic. You still need the browser [Buffer polyfill and CORS proxy](#5-browser-environment-setup) if your bundler requires them.

### Frontend Swap Hook (React) — raw Trading API

Use this only when you can't import `@uniswap/sdk` (not yet published to npm; see [Method 2](#2-uniswapsdk-facade-frontends-and-apps)). It reproduces by hand what the SDK does for you.

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

    // Strip null fields and spread quote response into body
    const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
    const swapRequest: Record<string, unknown> = { ...cleanQuote };

    // CRITICAL: permitData handling differs by routing type
    const isUniswapX =
      quoteResponse.routing === 'DUTCH_V2' ||
      quoteResponse.routing === 'DUTCH_V3' ||
      quoteResponse.routing === 'PRIORITY';

    if (isUniswapX) {
      // UniswapX: signature only — permitData must NOT be sent to /swap
      // (permitData is used locally to sign the order, not submitted to the API)
      if (permit2Signature) swapRequest.signature = permit2Signature;
    } else {
      // CLASSIC: both signature and permitData required together, or both omitted
      if (permit2Signature && permitData && typeof permitData === 'object') {
        swapRequest.signature = permit2Signature;
        swapRequest.permitData = permitData;
      }
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

### Backend Swap Script (Node.js) — raw Trading API

> **Prefer [Driving the CLI from a script/agent](#driving-the-cli-from-a-scriptagent)** for backends that can shell out — it's the same flow in two commands with the permit/routing gotchas already handled. Use this hand-rolled version only when the CLI isn't available (e.g. a language/runtime that can't run `bun`, or an [ERC-4337 smart account](#smart-account-integration-erc-4337) the EOA-only MVP doesn't cover). It's kept here as the reference implementation of what the CLI/SDK do internally.

```typescript
import { createWalletClient, createPublicClient, http, isAddress, isHex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const API_URL = 'https://trade-api.gateway.uniswap.org/v1';
const API_KEY = process.env.UNISWAP_API_KEY!;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: mainnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mainnet, transport: http() });

// Helper to prepare /swap request body — routing-aware permitData handling
function prepareSwapRequest(quoteResponse: Record<string, unknown>, signature?: string): object {
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
  const request: Record<string, unknown> = { ...cleanQuote };

  // UniswapX (DUTCH_V2, DUTCH_V3, PRIORITY): permitData is for LOCAL signing only.
  // The /swap body must NOT include permitData — the order is already encoded
  // in quote.encodedOrder. Only the signature is needed.
  const isUniswapX =
    quoteResponse.routing === 'DUTCH_V2' ||
    quoteResponse.routing === 'DUTCH_V3' ||
    quoteResponse.routing === 'PRIORITY';

  if (isUniswapX) {
    if (signature) request.signature = signature;
  } else {
    // CLASSIC: both signature and permitData required together, or both omitted
    if (signature && permitData && typeof permitData === 'object') {
      request.signature = signature;
      request.permitData = permitData;
    }
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
3. Submit via **`bundlerClient.sendUserOperation()`** — always use the viem bundler client's
   `sendUserOperation` method (not a custom wrapper function)

> **REQUIRED:** The final submission step MUST use `bundlerClient.sendUserOperation()` from the
> viem permissionless/bundler client. Do NOT write a custom `submitUserOperation` wrapper that
> bypasses this — the bundler client handles UserOperation construction, gas estimation, and
> submission automatically.

```typescript
// After getting swap calldata from Trading API:
const { to, data, value } = swapResponse.swap;

// Wrap in delegation execution
const execution = {
  target: to, // Universal Router
  callData: data,
  value: BigInt(value),
};

// Submit via bundler — use sendUserOperation directly
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

| Issue                                                  | Solution                                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Insufficient allowance"                               | Call /check_approval first and submit approval tx                                                                                                                                                            |
| "Quote expired"                                        | Increase deadline or re-fetch quote                                                                                                                                                                          |
| "Slippage exceeded"                                    | Increase slippageTolerance or retry                                                                                                                                                                          |
| "Insufficient liquidity"                               | Try smaller amount or different route                                                                                                                                                                        |
| **"Buffer is not defined"**                            | Add Buffer polyfill (see Critical Implementation Notes)                                                                                                                                                      |
| **On-chain revert with empty data**                    | Validate `swap.data` is non-empty hex before broadcasting                                                                                                                                                    |
| **"permitData must be of type object"**                | Strip `permitData: null` from request - omit field entirely                                                                                                                                                  |
| **"quote does not match any of the allowed types"**    | Don't wrap quote in `{quote: ...}` — spread into request body. Also check: for UniswapX routes, `permitData` must be omitted from the `/swap` body (see [API Validation Errors](#api-validation-errors-400)) |
| **Received WETH instead of ETH on L2**                 | Check and unwrap WETH after swap (see [WETH Handling on L2s](#weth-handling-on-l2s))                                                                                                                         |
| **429 Too Many Requests**                              | Implement exponential backoff and add delays between batch requests (see [Rate Limiting](#rate-limiting))                                                                                                    |
| **415 on OPTIONS preflight / CORS error**              | Set up a CORS proxy (see [CORS Proxy Configuration](#cors-proxy-configuration) in Browser Environment Setup)                                                                                                 |
| **walletClient is undefined when wallet is connected** | Use `getWalletClient()` from `@wagmi/core` instead of the `useWalletClient()` hook (see [wagmi v2 Integration Pitfalls](#wagmi-v2-integration-pitfalls))                                                     |
| **"Please provide a chain with the chain argument"**   | Pass `chainId` to `getWalletClient(config, { chainId })`                                                                                                                                                     |
| **Chain mismatch error on swap**                       | Call `switchChain()` before `getWalletClient()` (see [wagmi v2 Integration Pitfalls](#wagmi-v2-integration-pitfalls))                                                                                        |

### API Validation Errors (400)

| Error Message                                     | Cause                                                                    | Fix                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `"permitData" must be of type object`             | Sending `permitData: null`                                               | Omit the field entirely when null                                                                          |
| `"quote" does not match any of the allowed types` | Wrapping quote in `{quote: quoteResponse}`                               | Spread quote response: `{...quoteResponse}`                                                                |
| `"quote" does not match any of the allowed types` | Including `permitData` in a UniswapX (DUTCH_V2/V3/PRIORITY) `/swap` body | Omit `permitData` for UniswapX routes — see [Signing vs. Submission](#uniswapx-signing-vs-submission-flow) |
| `signature and permitData must both be present`   | Including only one Permit2 field (CLASSIC routes only)                   | Include both or neither for CLASSIC; omit `permitData` for UniswapX                                        |

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
