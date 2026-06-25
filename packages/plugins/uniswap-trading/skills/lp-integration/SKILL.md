---
name: lp-integration
description: Integrate Uniswap liquidity provisioning (LP) into applications via the LP REST API. Use when the user says "LP API", "liquidity provisioning API", "provide liquidity programmatically", "create LP position via API", "add liquidity via API", "increase liquidity", "decrease liquidity", "remove liquidity", "claim LP fees", "collect LP fees", "manage LP positions in code", or mentions building a backend, bot, or frontend that creates or manages Uniswap v2/v3/v4 liquidity positions through an API. Also use when debugging LP API calls (e.g. /lp/create, /lp/check_approval, /lp/increase, /lp/decrease, /lp/claim_fees), unexpected response fields, the approval or EIP-712 permit flow, or transaction-building errors for liquidity positions. For generating deep links to the Uniswap web app instead of calling the API, use the liquidity-planner skill; for using the Uniswap v4 SDK directly rather than the REST API, use the v4-sdk-integration skill.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(yarn:*), Bash(curl:*), WebFetch, Task(subagent_type:swap-integration-expert)
model: opus
license: MIT
metadata:
  author: uniswap
  version: '0.1.0'
---

# LP Integration

Integrate Uniswap liquidity provisioning into frontends, backends, and bots using the Uniswap LP API.

The LP API is a transaction-building service. You send position parameters; the API fetches live pool state, computes the dependent token amount, and returns a fully-formed, unsigned transaction. Your application signs and broadcasts it. The API never holds keys, never moves funds, and never broadcasts.

## Prerequisites

This skill assumes familiarity with viem basics (client setup, account management, contract interactions, transaction signing). Install the **uniswap-viem** plugin for comprehensive viem/wagmi guidance: `claude plugin add @uniswap/uniswap-viem`

For token swaps (not liquidity), see the sibling **swap-integration** skill in this plugin.

## Base URL

```text
LP_API_BASE_URL = https://liquidity.api.uniswap.org
```

All LP endpoints are POST requests under the `/lp/` prefix (e.g. `https://liquidity.api.uniswap.org/lp/create`).

> **The LP API host is intentionally different from the swap Trading API.** Liquidity provisioning lives at `https://liquidity.api.uniswap.org` (no `/v1` prefix), not the `https://trade-api.gateway.uniswap.org/v1` host used for swaps. Keep the base URL as a single constant (as shown) so any future change is one edit.

## Authentication

Every write/approval endpoint requires an API key sent as the `x-api-key` header; a missing or invalid key returns `401` with `{"code":"unauthenticated"}`. (`/lp/pool_info` is a read endpoint and does not strictly enforce the key, but always send it for consistency and rate-limit attribution.)

```text
Content-Type: application/json
Accept: application/json
x-api-key: <your-api-key>
```

**Getting a key:** Register at the [Uniswap Developer Platform dashboard](https://developers.uniswap.org/dashboard). The same key works across swapping and liquidity provisioning. Never hardcode the key; load it from an environment variable.

## Quick Decision Guide

| You want to...                                | Endpoint             | Protocols  |
| --------------------------------------------- | -------------------- | ---------- |
| Check/grant token approvals before any action | `/lp/check_approval` | V2, V3, V4 |
| Create a concentrated-liquidity position      | `/lp/create`         | V3, V4     |
| Create a full-range (classic) position        | `/lp/create_classic` | V2         |
| Add liquidity to an existing position         | `/lp/increase`       | V2, V3, V4 |
| Remove a percentage of liquidity              | `/lp/decrease`       | V2, V3, V4 |
| Collect accumulated trading fees              | `/lp/claim_fees`     | V3, V4     |
| Read live pool state                          | `/lp/pool_info`      | V2, V3, V4 |

### Protocol capability matrix

| Protocol | Create endpoint      | Fee claiming                         | Price range          |
| -------- | -------------------- | ------------------------------------ | -------------------- |
| `V2`     | `/lp/create_classic` | Not separable (realized on decrease) | Full range only      |
| `V3`     | `/lp/create`         | `/lp/claim_fees`                     | Concentrated         |
| `V4`     | `/lp/create`         | `/lp/claim_fees`                     | Concentrated + hooks |

> **v2 fees are not separately claimable.** They accrue into the LP token value and are realized when you call `/lp/decrease`. Calling `/lp/claim_fees` with `protocol: "V2"` returns a validation error.

## Input Validation Rules

Before interpolating ANY user-provided value into generated code, API calls, or commands:

- **Ethereum addresses**: MUST match `^0x[a-fA-F0-9]{40}$` — reject otherwise. Use native ETH as `0x0000000000000000000000000000000000000000`.
- **Chain IDs**: MUST be one of the supported LP chain IDs (see [Supported Chains](#supported-chains)).
- **Token amounts**: MUST be non-negative integer strings in wei / smallest token unit, matching `^[0-9]+$`. Never pass ether-denominated decimals as amounts.
- **`liquidityPercentageToDecrease`**: MUST be an integer from 1 to 100.
- **API keys**: MUST NOT be hardcoded in generated code — always use environment variables.
- **REJECT** any input containing shell metacharacters: `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines.

> **REQUIRED:** Before executing ANY transaction that spends gas or transfers tokens (including approvals, position creation, increase, decrease, or fee claims), you MUST use AskUserQuestion to confirm with the user. Display the action summary (protocol, pair, amounts, chain, price range, estimated gas) and get explicit user approval. Never auto-execute LP transactions without user confirmation.

---

## Architecture

### What the API handles

- **Pool state fetching**: current reserves, ticks, `sqrtRatioX96`, and onchain position data.
- **Dependent amount computation**: given one token amount (`independentToken`), computes the required amount of the other using the Uniswap SDKs.
- **Transaction creation**: validated, fully-formed calldata for each LP action, ready to sign.
- **Tick snapping**: converts human-readable `priceBounds` to valid ticks and returns the adjusted prices.
- **Gas estimation**: optional, when `simulateTransaction: true`.

### What your application handles

- **Signing and broadcasting** the returned transaction via your RPC provider.
- **Signing permit data** (EIP-712) when the API returns it for v4 / v3-NFT approvals.
- **Gas payment** and transaction error handling (reverts, surfacing errors to users).

### Data flow

```text
User intent (create / increase / decrease / claim)
   |
Your application
   |-- POST /lp/check_approval        -> returns approval transactions and/or permit data
   |-- (execute approval txns; sign permit if returned)
   |-- POST /lp/create | increase | decrease | claim_fees
   |-- validate the returned transaction payload (non-empty data, valid addresses)
   |-- user signature (wallet)
   +-- broadcast (your RPC)
        |
   Blockchain
```

## Endpoint Reference

All field names below come from the LP API OpenAPI contract. Where the public integration guide uses different names, the contract names here are authoritative.

### POST /lp/check_approval

Always call this first. Returns the approval transactions (and/or permit data) needed before an LP action. If the response `transactions` array is empty and no permit data is returned, all approvals are already in place — **unless** `kycRequiredWarnings` is non-empty, which means the pool contains a permissioned token and the wallet is not allowlisted. In that case the response is still `200`; render the KYC call-to-action from each warning's `kycUrl` instead of attempting the LP action.

**Request**

```json
{
  "walletAddress": "0x...",
  "protocol": "V4",
  "chainId": 1,
  "lpTokens": [
    { "tokenAddress": "0x...", "amount": "1000000000000000000" },
    { "tokenAddress": "0x...", "amount": "500000000" }
  ],
  "action": "CREATE"
}
```

| Field                         | Required | Notes                                                                       |
| ----------------------------- | -------- | --------------------------------------------------------------------------- |
| `walletAddress`               | Yes      | The position owner                                                          |
| `protocol`                    | Yes      | `V2` \| `V3` \| `V4`                                                        |
| `chainId`                     | Yes      | Supported chain ID                                                          |
| `lpTokens`                    | Yes      | Array of `{ tokenAddress, amount }` to be spent                             |
| `action`                      | Yes      | `CREATE` \| `INCREASE` \| `DECREASE` \| `MIGRATE`                           |
| `simulateTransaction`         | No       | Include gas estimates                                                       |
| `includeGasInfo`              | No       | Include gas info on returned approvals                                      |
| `generatePermitAsTransaction` | No       | If `true`, return permit as an executable transaction instead of typed data |
| `urgency`                     | No       | `NORMAL` \| `FAST` \| `URGENT`                                              |
| `v3NftTokenId`                | No       | v3 NFT id when approving a position-manager NFT                             |

**Response**

```ts
interface CheckApprovalResponse {
  requestId: string;
  transactions: ApprovalTransactionRequest[]; // sign each .transaction; empty (with kycRequiredWarnings also empty) = nothing to approve
  v4BatchPermitData?: NullablePermit; // v4: sign and pass into /lp/create or /lp/increase
  v3NftPermitData?: NullablePermit; // v3 NFT permit
  kycRequiredWarnings: KycRequiredWarning[]; // permissioned pools: non-empty when the wallet is NOT allowlisted. Always present (usually []).
}

interface ApprovalTransactionRequest {
  transaction: TransactionRequest; // the tx to sign and broadcast
  cancelApproval: boolean;
  action: 'CREATE' | 'INCREASE' | 'DECREASE' | 'MIGRATE';
  gasFee?: string;
}

interface KycRequiredWarning {
  kycUrl: string;
  tokenAddress: string;
  chainId: number;
}
```

> **The response field is `transactions`, not `approvals`.** Each element WRAPS a transaction. Sign `element.transaction`, never the element object itself. There are no top-level `token`/`spender` fields.

### POST /lp/create

Create a v3 or v4 concentrated-liquidity position. Specify a price range and one token amount; the API computes the other from live pool state.

**Pool specification** — provide exactly one of:

- `existingPool`: `{ token0Address, token1Address, poolReference }` where `poolReference` is the pool address (v3) or pool ID (v4).
- `newPool`: `{ token0Address, token1Address, fee, tickSpacing, hooks?, initialPrice }` where `initialPrice` is a `sqrtRatioX96` string (`hooks` is v4-only).

**Price range** — provide exactly one of:

- `priceBounds`: `{ minPrice, maxPrice, quotedTokenAddress }` — `minPrice`/`maxPrice` are decimal price strings and `quotedTokenAddress` is **required** (it must equal `token0Address` or `token1Address`). `quotedTokenAddress` sets which token the prices are denominated in; there is no default, and omitting it returns a `400`. The API snaps to valid ticks and returns the adjusted prices.
- `tickBounds`: `{ tickLower, tickUpper }` raw integers.

**Request**

```json
{
  "walletAddress": "0x...",
  "chainId": 1,
  "protocol": "V3",
  "existingPool": {
    "token0Address": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "token1Address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "poolReference": "0x3470447f3cecffac709d3e783a307790b0208d60"
  },
  "independentToken": {
    "tokenAddress": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "amount": "198251669183062942"
  },
  "priceBounds": {
    "minPrice": "0.00000000000324",
    "maxPrice": "0.00000000000393",
    "quotedTokenAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  },
  "simulateTransaction": false
}
```

| Field                                                      | Required     | Notes                                                                                    |
| ---------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `walletAddress`, `chainId`, `protocol`, `independentToken` | Yes          | `independentToken` is `{ tokenAddress, amount }`                                         |
| `existingPool` \| `newPool`                                | One required | See pool specification above                                                             |
| `priceBounds` \| `tickBounds`                              | One required | See price range above                                                                    |
| `dependentToken`                                           | No           | Override the computed dependent amount                                                   |
| `slippageTolerance`                                        | No           | Decimal percent (e.g. `0.5`)                                                             |
| `deadline`                                                 | No           | Unix seconds                                                                             |
| `simulateTransaction`                                      | No           | Include `gasFee` in response                                                             |
| `urgency`                                                  | No           | `NORMAL` \| `FAST` \| `URGENT`                                                           |
| `batchPermitData` + `signature`                            | No           | v4 permit from `/lp/check_approval` (note: create uses `batchPermitData`)                |
| `nativeTokenBalance`                                       | No           | Used when one side is native ETH                                                         |
| `includeApprovalSimulation`                                | No           | Include approval pre-calls in the gas simulation (only with `simulateTransaction: true`) |

**Response**

```ts
interface CreatePositionResponse {
  requestId: string;
  token0: LPToken; // { tokenAddress, amount }
  token1: LPToken;
  adjustedMinPrice: string; // show THIS to the user, not your input minPrice
  adjustedMaxPrice: string;
  tickLower: number;
  tickUpper: number;
  create: TransactionRequest;
  gasFee?: string; // present when simulateTransaction: true
  slippage?: number; // effective slippage the API applied (e.g. native-token v4 cases)
}
```

> **Display `adjustedMinPrice` / `adjustedMaxPrice`** (the tick-snapped values), not the original `priceBounds` you sent.

### POST /lp/create_classic

Create a v2 (full-range) position. Provide one `independentToken` amount; the API computes the `dependentToken` from current pair reserves.

**Request**

```json
{
  "walletAddress": "0x...",
  "poolParameters": {
    "token0Address": "0xc02fe7317d4eb8753a02c35fe019786854a92001",
    "token1Address": "0x0000000000000000000000000000000000000000",
    "chainId": 130
  },
  "independentToken": {
    "tokenAddress": "0xc02fe7317d4eb8753a02c35fe019786854a92001",
    "amount": "1000000000000000"
  },
  "simulateTransaction": false
}
```

| Field                                                                                          | Required | Notes                                                                        |
| ---------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `walletAddress`                                                                                | Yes      |                                                                              |
| `poolParameters`                                                                               | Yes      | `{ token0Address, token1Address, chainId }`                                  |
| `independentToken`                                                                             | Yes      | `{ tokenAddress, amount }`                                                   |
| `dependentToken`                                                                               | No       | If omitted, computed from reserves. Required when creating a brand-new pool. |
| `slippageTolerance`, `deadline`, `simulateTransaction`, `urgency`, `includeApprovalSimulation` | No       |                                                                              |

**Response**: `{ requestId, independentToken, dependentToken, create: TransactionRequest, gasFee? }`. Note the create_classic response names the tokens `independentToken` / `dependentToken` (not `token0` / `token1`).

### POST /lp/increase

Add liquidity to an existing v2/v3/v4 position. Provide one token amount; the API computes the other.

**Request**

```json
{
  "walletAddress": "0x...",
  "chainId": 130,
  "protocol": "V4",
  "token0Address": "0x0000000000000000000000000000000000000000",
  "token1Address": "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
  "nftTokenId": "1833079",
  "independentToken": {
    "tokenAddress": "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
    "amount": "8223"
  },
  "simulateTransaction": false
}
```

| Field                                                                                        | Required | Notes                                                                                                                         |
| -------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `walletAddress`, `chainId`, `protocol`, `token0Address`, `token1Address`, `independentToken` | Yes      | `token0Address`/`token1Address` must match the order in the existing position                                                 |
| `nftTokenId`                                                                                 | v3/v4    | NFT id identifying the position                                                                                               |
| `slippageTolerance`, `deadline`, `simulateTransaction`, `urgency`                            | No       |                                                                                                                               |
| `v4BatchPermitData` + `signature`                                                            | No       | v4 permit from `/lp/check_approval` (note: increase uses `v4BatchPermitData`, create uses `batchPermitData`)                  |
| `nativeTokenBalance`, `includeApprovalSimulation`, `permissioned`                            | No       | `nativeTokenBalance` when one side is native ETH; `permissioned` routes to the permissioned PositionManager (KYC-gated pools) |

**Response**: `{ requestId, token0, token1, increase: TransactionRequest, gasFee?, slippage? }`.

> **Native ETH**: use `0x0000000000000000000000000000000000000000`. The API generates a multicall including `refundETH` to return any excess.

### POST /lp/decrease

Remove a percentage of liquidity from a v2/v3/v4 position.

**Request**

```json
{
  "walletAddress": "0x...",
  "chainId": 130,
  "protocol": "V4",
  "token0Address": "0x0000000000000000000000000000000000000000",
  "token1Address": "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
  "liquidityPercentageToDecrease": 25,
  "nftTokenId": "1833079",
  "simulateTransaction": false
}
```

| Field                                                                                                     | Required | Notes                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `walletAddress`, `chainId`, `protocol`, `token0Address`, `token1Address`, `liquidityPercentageToDecrease` | Yes      | Percentage is an integer 1-100                                                                         |
| `nftTokenId`                                                                                              | v3/v4    | NFT id identifying the position                                                                        |
| `withdrawAsWeth`                                                                                          | No       | Applies to V2 and V3 (ignored on V4). Default / `true` keeps WETH; `false` unwraps WETH to native ETH. |
| `permissioned`                                                                                            | No       | Routes to the permissioned PositionManager (KYC-gated pools).                                          |
| `slippageTolerance`, `deadline`, `simulateTransaction`, `urgency`                                         | No       |                                                                                                        |

**Response**: `{ requestId, token0, token1, decrease: TransactionRequest, gasFee? }`.

> **v3 fee collection on decrease**: for v3, the returned `decrease` calldata bundles uncollected fees into the withdrawal automatically, so you do not need to call `/lp/claim_fees` separately. Note the response `token0` / `token1` amounts reflect only the pro-rata liquidity removed — the swept fees are encoded in the calldata, not added to those response amounts.

### POST /lp/claim_fees

Collect accumulated trading fees from a v3 or v4 position. Not available for v2.

**Request**

```json
{
  "protocol": "V4",
  "walletAddress": "0x...",
  "chainId": 130,
  "tokenId": "1833079",
  "simulateTransaction": false
}
```

| Field                                             | Required | Notes                                                                                         |
| ------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `protocol`, `walletAddress`, `chainId`, `tokenId` | Yes      | `protocol` of `V2` returns a validation error. Note: claim uses `tokenId` (not `nftTokenId`). |
| `collectAsWeth`                                   | No       | v3 only. If `false`, unwraps WETH to native ETH.                                              |
| `permissioned`                                    | No       | Routes to the permissioned PositionManager (KYC-gated pools).                                 |
| `simulateTransaction`                             | No       |                                                                                               |

**Response**: `{ requestId, token0, token1, claim: TransactionRequest, gasFee? }`.

### POST /lp/pool_info

Read live pool state (reserves, tick, `sqrtRatioX96`, liquidity) for one or more pools.

**Request**: `{ protocol, poolParameters?, poolReferences?, chainId?, pageSize?, currentPage? }` (only `protocol` is strictly required; supply `poolParameters` `{ tokenAddressA, tokenAddressB, fee?, tickSpacing?, hookAddress? }` or `poolReferences` to identify pools).

**Response**: `{ requestId, pools: PoolInformation[], pageSize, currentPage }` where each `PoolInformation` includes `poolReferenceIdentifier, poolProtocol, tokenAddressA, tokenAddressB, tickSpacing, fee, hookAddress, chainId, tokenAmountA, tokenAmountB, tokenDecimalsA, tokenDecimalsB, poolLiquidity, sqrtRatioX96, currentTick, token0Reserves, token1Reserves` (note: address/amount/decimals fields use the `A`/`B` suffix, but the two reserve fields use `0`/`1`). Optional fields (e.g. amounts, `hookAddress`, reserves) are omitted when not applicable to the pool.

### Field-name quirks to preserve

The same concept is named differently across endpoints. Use the exact name per endpoint:

| Concept         | `/lp/claim_fees` | `/lp/increase`, `/lp/decrease` | `/lp/check_approval`     |
| --------------- | ---------------- | ------------------------------ | ------------------------ |
| Position NFT id | `tokenId`        | `nftTokenId`                   | `v3NftTokenId` (integer) |

| Concept           | `/lp/create`      | `/lp/increase`      |
| ----------------- | ----------------- | ------------------- |
| v4 permit payload | `batchPermitData` | `v4BatchPermitData` |

## Approval and Permit Flow

Always call `/lp/check_approval` before any LP action, even when approvals were previously granted (allowances can be revoked or consumed).

### Onchain approvals

```ts
const res = await fetch(`${LP_API_BASE_URL}/lp/check_approval`, {
  method: 'POST',
  headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ walletAddress, protocol: 'V4', chainId: 1, lpTokens, action: 'CREATE' }),
});
if (!res.ok) throw new Error(`check_approval failed: ${res.status}`);
const { transactions, v4BatchPermitData, kycRequiredWarnings } = await res.json();

// A permissioned pool gates LPing on KYC: a non-empty kycRequiredWarnings means render the
// KYC CTA (warning.kycUrl) and stop — do NOT treat empty transactions as "approved" here.
if (kycRequiredWarnings?.length)
  throw new Error('Wallet not allowlisted for this permissioned pool');

// transactions is an array of ApprovalTransactionRequest. Empty (and no KYC warnings) => already approved.
for (const approval of transactions) {
  validateLpTransaction(approval.transaction); // see Critical Notes
  const hash = await walletClient.sendTransaction(approval.transaction);
  await publicClient.waitForTransactionReceipt({ hash });
}
```

### v4 permit (EIP-712 sign-and-return)

For v4, `check_approval` returns a `v4BatchPermitData` (a gasless Permit2 batch approval) — often **alongside** onchain ERC-20 → Permit2 approval `transactions`, not instead of them. Execute any returned `transactions` first (Permit2 needs the ERC-20 allowance), then sign the permit offchain and pass it into the next call.

> **The permit payload is proto-encoded and is NOT directly viem-ready.** Normalize two fields before signing — the un-normalized object is still what you send back to the API:
>
> - `domain.chainId` arrives as the chain **enum-name string** (e.g. `"UNICHAIN"`), not a number — replace it with the numeric chain ID.
> - each `types` entry is wrapped as `{ fields: [...] }`; viem (and the EIP-712 spec) expect a bare array — unwrap `.fields`.

```ts
let signature: string | undefined;
if (v4BatchPermitData) {
  // Normalize the proto-encoded permit into viem's TypedData shape (for signing only).
  const types = Object.fromEntries(
    Object.entries(v4BatchPermitData.types).map(([k, v]) => [k, (v as any).fields])
  );
  const domain = { ...v4BatchPermitData.domain, chainId }; // numeric chainId (e.g. 130), NOT "UNICHAIN"

  signature = await walletClient.signTypedData({
    domain,
    types,
    message: v4BatchPermitData.values,
    primaryType: 'PermitBatch',
  });
}

// Send the ORIGINAL (un-normalized) permit back to the API, with the signature.
// /lp/create (uses batchPermitData) ...
const createBody = { ...createParams, batchPermitData: v4BatchPermitData, signature };
// ... or /lp/increase (uses v4BatchPermitData)
const increaseBody = { ...increaseParams, v4BatchPermitData, signature };
```

For full typed implementations (v3 NFT permit, `EIP712Domain` edge cases, migration), see [Advanced Patterns Reference](./references/advanced-patterns.md#permit-and-approval-deep-dive).

## Critical Implementation Notes

### 1. Sign the wrapped transaction, not the wrapper

`/lp/check_approval` returns `transactions: ApprovalTransactionRequest[]`. Each element is `{ transaction, cancelApproval, action, gasFee? }`.

```ts
// WRONG — signs the wrapper object, not a transaction
for (const a of transactions) await walletClient.sendTransaction(a);

// CORRECT
for (const a of transactions) await walletClient.sendTransaction(a.transaction);
```

### 2. Use the contract's response field names

```ts
// WRONG — these names come from the narrative guide, not the contract
const { approvals } = await checkApprovalRes.json();
const { minPrice, maxPrice } = createResponse;

// CORRECT
const { transactions } = await checkApprovalRes.json();
const { adjustedMinPrice, adjustedMaxPrice } = createResponse;
```

### 3. Never modify, always validate the `data` field

The `create` / `increase` / `decrease` / `claim` field holds pre-validated calldata.

```ts
function validateLpTransaction(tx: TransactionRequest): void {
  if (!tx.data || tx.data === '' || tx.data === '0x') throw new Error('Empty transaction data');
  if (!tx.to || !isAddress(tx.to)) throw new Error('Invalid recipient address');
  if (!tx.from || !isAddress(tx.from)) throw new Error('Invalid sender address');
  if (tx.maxFeePerGas && tx.gasPrice) throw new Error('Cannot set both maxFeePerGas and gasPrice');
}
```

Never edit the calldata — modifying it can cause reverts or loss of funds.

### 4. Transactions are time-sensitive

Pool price moves. If the user takes more than ~30 seconds to review, refetch the transaction before broadcasting.

```ts
const TX_EXPIRY_MS = 30_000;
const builtAt = Date.now();
// ... user reviews ...
if (Date.now() - builtAt > TX_EXPIRY_MS) lpTx = await refetchLpTransaction(params);
```

### 5. Amounts are wei strings

All `amount` fields are integer strings in the token's smallest unit. Convert with `parseUnits(value, decimals).toString()` — never send ether-denominated decimals.

### 6. Strip undefined optional fields

Send permit fields as a matched pair (`batchPermitData` + `signature`) or omit both. Do not send `signature: undefined` alongside a present permit, or vice versa.

## Worked Example: Create a v3 Position (viem)

```ts
import { createWalletClient, createPublicClient, http, isAddress, parseUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const LP_API_BASE_URL = 'https://liquidity.api.uniswap.org';
const API_KEY = process.env.UNISWAP_API_KEY!; // never hardcode

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});
const publicClient = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL) });

const headers = {
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function lpFetch(path: string, body: object) {
  const res = await fetch(`${LP_API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Same checks as the canonical validateLpTransaction in "Critical Implementation Notes" above.
function validateLpTransaction(tx: any) {
  if (!tx || !tx.data || tx.data === '' || tx.data === '0x')
    throw new Error('Empty transaction data');
  if (!tx.to || !isAddress(tx.to)) throw new Error('Invalid recipient address');
  if (!tx.from || !isAddress(tx.from)) throw new Error('Invalid sender address');
  if (tx.maxFeePerGas && tx.gasPrice) throw new Error('Cannot set both maxFeePerGas and gasPrice');
}

async function createV3Position() {
  const protocol = 'V3';
  const chainId = 1;
  const token0Address = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'; // UNI
  const token1Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT
  const independentToken = { tokenAddress: token0Address, amount: parseUnits('10', 18).toString() };

  // 1. Approvals
  const { transactions } = await lpFetch('/lp/check_approval', {
    walletAddress: account.address,
    protocol,
    chainId,
    lpTokens: [independentToken],
    action: 'CREATE',
  });
  for (const a of transactions) {
    validateLpTransaction(a.transaction);
    const hash = await walletClient.sendTransaction(a.transaction);
    await publicClient.waitForTransactionReceipt({ hash });
  }

  // 2. Build the create transaction
  const created = await lpFetch('/lp/create', {
    walletAddress: account.address,
    chainId,
    protocol,
    independentToken,
    existingPool: {
      token0Address,
      token1Address,
      poolReference: '0x3470447f3cecffac709d3e783a307790b0208d60',
    },
    priceBounds: {
      minPrice: '0.00000000000324',
      maxPrice: '0.00000000000393',
      quotedTokenAddress: token1Address,
    },
    simulateTransaction: true,
  });

  // 3. CONFIRM WITH USER before broadcasting (use AskUserQuestion in the skill flow):
  //    pair, amounts (created.token0 / created.token1), adjusted range
  //    (created.adjustedMinPrice / created.adjustedMaxPrice), created.gasFee
  validateLpTransaction(created.create);
  const hash = await walletClient.sendTransaction(created.create);
  return publicClient.waitForTransactionReceipt({ hash });
}
```

## Companion SDKs

The API returns ready-to-sign transactions, so a protocol SDK is not required. For client-side pool/position math, tick conversions, and validation, developers commonly pair the LP API with:

- `@uniswap/sdk-core` — chains, `Token`, `CurrencyAmount`, `Percent`, `Price` (foundational).
- `@uniswap/v3-sdk` — v3 tick math (`TickMath`, `nearestUsableTick`), `Pool`, `Position`.
- `@uniswap/v4-sdk` — v4 pool keys, hooks-aware `Position` modeling.
- `@uniswap/v2-sdk` — v2 pair/liquidity math.
- `viem` (or ethers) — sign and broadcast the returned `{ to, data, value }`, and sign EIP-712 permit data.

## Error Handling

| Code | Meaning                  | Action                                       |
| ---- | ------------------------ | -------------------------------------------- |
| 400  | Validation error         | Fix request fields (see common errors below) |
| 401  | Invalid API key          | Check the `x-api-key` header                 |
| 429  | Rate limited             | Exponential backoff; cache repeated reads    |
| 500  | API error                | Retry with backoff                           |
| 503  | Temporary unavailability | Retry                                        |

Error body (Connect protocol): `{ code: string, message: string, details?: Array<{ type: string; value: string }> }` — e.g. `{"code":"invalid_argument","message":"RequestValidationError: ...","details":[...]}`. `code` is a Connect error-code string (`invalid_argument`, `unauthenticated`, `failed_precondition`, `internal`, …), **not** an HTTP number, and there is no top-level `error` field. Read `body.code` / `body.message`, not `body.error`.

**Common errors**

- **v2 fee claim attempt**: calling `/lp/claim_fees` with `protocol: "V2"`. Use `/lp/decrease` to realize v2 fees.
- **Pool not found**: verify token addresses, the `poolReference`, and the chain; or use `newPool` to initialize.
- **Insufficient liquidity**: the computed dependent amount exceeds balances; reduce `independentToken.amount` or widen the range.
- **Validation error**: ensure all required fields for the chosen `protocol`, checksummed addresses, wei-denominated amounts, and `liquidityPercentageToDecrease` in 1-100.

For retry/backoff, request caching, monitoring, and the full pre-broadcast checklist, see [Advanced Patterns Reference](./references/advanced-patterns.md#error-recovery-and-reliability).

## Supported Chains

The LP API supports a fixed set of chain IDs. Validate `chainId` against this set before sending:

```text
1, 10, 56, 130, 137, 143, 196, 324, 480, 1868, 4217, 4326, 4663, 5042,
8453, 10143, 42161, 42220, 43114, 59144, 81457, 7777777, 1301, 84532, 11155111
```

(Mainnet 1, Optimism 10, BNB 56, Unichain 130, Polygon 137, Base 8453, Arbitrum 42161, Avalanche 43114, Linea 59144, Blast 81457, Zora 7777777, Sepolia 11155111, and others.) Confirm the live set against `/lp/pool_info` availability or the [supported chains docs](https://developers.uniswap.org/docs/liquidity/liquidity-provisioning-api/getting-started).

## Additional Resources

- [LP API: Getting Started](https://developers.uniswap.org/docs/liquidity/liquidity-provisioning-api/getting-started) — official conceptual overview
- [LP API: Integration Guide](https://developers.uniswap.org/docs/liquidity/liquidity-provisioning-api/integration-guide) — official guide
- [Uniswap Developer Platform dashboard](https://developers.uniswap.org/dashboard) — get an API key
- [swap-integration](../swap-integration/SKILL.md) — sibling skill for token swaps via the Trading API
- [Advanced Patterns Reference](./references/advanced-patterns.md) — permit deep-dive, migration, NFT-position quirks, reliability
