# Advanced Trading API Patterns

Supplementary patterns for the swap-integration skill covering smart account integration, L2 WETH handling, and rate limiting.

## Smart Account Integration (ERC-4337)

Execute Trading API swaps through ERC-4337 smart accounts using delegation and bundlers. This pattern is useful for automated services (DCA bots, portfolio rebalancers) that execute swaps on behalf of users via delegated smart accounts.

### Architecture

```text
Trading API (get calldata) -> Create Execution -> Delegation Redemption -> Bundler (UserOperation)
```

### Full Pattern

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  encodeFunctionData,
} from 'viem';
import { base } from 'viem/chains';

// Types for smart account integration
interface SwapCalldata {
  to: Address;
  data: Hex;
  value: string;
}

interface Execution {
  target: Address;
  callData: Hex;
  value: bigint;
}

interface SignedDelegation {
  delegator: Address;
  delegate: Address;
  authority: Hex;
  caveats: readonly unknown[];
  salt: bigint;
  signature: Hex;
}

// 1. Get swap calldata from Trading API (standard 3-step flow)
async function getSwapCalldata(
  quoteResponse: Record<string, unknown>,
  apiKey: string
): Promise<SwapCalldata> {
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;

  const swapRes = await fetch('https://trade-api.gateway.uniswap.org/v1/swap', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...cleanQuote,
      ...(permitData && { permitData }),
    }),
  });

  const swapData = await swapRes.json();
  if (!swapRes.ok) throw new Error(swapData.detail || 'Swap request failed');

  return swapData.swap;
}

// 2. Create execution for delegation redemption
function createExecution(swap: SwapCalldata): Execution {
  return {
    target: swap.to, // Universal Router address
    callData: swap.data,
    value: BigInt(swap.value),
  };
}

// 3. Submit via bundler as a UserOperation
async function executeViaSmartAccount(
  bundlerClient: {
    sendUserOperation: (params: {
      account: unknown;
      calls: readonly { to: Address; data: Hex; value?: bigint }[];
    }) => Promise<Hex>;
  },
  delegateSmartAccount: unknown,
  delegationManagerAddress: Address,
  signedDelegation: SignedDelegation,
  execution: Execution
): Promise<Hex> {
  // Encode the delegation redemption call
  const redeemData = encodeFunctionData({
    abi: [
      {
        name: 'redeemDelegations',
        type: 'function',
        inputs: [
          { name: 'delegations', type: 'tuple[][]', components: [] },
          { name: 'modes', type: 'uint8[]' },
          { name: 'executions', type: 'tuple[][]', components: [] },
        ],
        outputs: [],
      },
    ] as const,
    functionName: 'redeemDelegations',
    args: [
      [[signedDelegation]], // delegations (array of delegation chains)
      [0], // modes (0 = SingleDefault)
      [[execution]], // executions
    ],
  });

  return bundlerClient.sendUserOperation({
    account: delegateSmartAccount,
    calls: [
      {
        to: delegationManagerAddress,
        data: redeemData,
        value: execution.value,
      },
    ],
  });
}

// Complete flow
async function swapViaSmartAccount(
  quoteResponse: Record<string, unknown>,
  apiKey: string,
  bundlerClient: Parameters<typeof executeViaSmartAccount>[0],
  delegateSmartAccount: Parameters<typeof executeViaSmartAccount>[1],
  delegationManagerAddress: Address,
  signedDelegation: SignedDelegation
): Promise<Hex> {
  // Get swap calldata from Trading API
  const swapCalldata = await getSwapCalldata(quoteResponse, apiKey);

  // Create execution for delegation
  const execution = createExecution(swapCalldata);

  // Submit via bundler
  return executeViaSmartAccount(
    bundlerClient,
    delegateSmartAccount,
    delegationManagerAddress,
    signedDelegation,
    execution
  );
}
```

### Key Considerations

- **Approval target**: For smart accounts, approve tokens directly to the Universal Router (legacy mode) rather than using Permit2. This avoids the need for EIP-712 signature flows that are complex with smart accounts.
- **Gas estimation**: Bundlers estimate gas differently. Add a 20-30% buffer to the `callGasLimit` for swap operations.
- **Nonce management**: If executing multiple swaps in sequence, handle UserOperation nonces carefully to avoid conflicts.
- **Error handling**: Bundler errors differ from standard transaction errors. Check both the UserOperation receipt and the inner execution status.

---

## WETH Handling on L2s

On L2 chains (Base, Optimism, Arbitrum), swaps that output ETH often deliver WETH instead of native ETH. This is because the Universal Router's `UNWRAP_WETH` command may not be included in all routes, especially when the Trading API optimizes for gas efficiency.

### When This Happens

- Swapping any token to ETH on L2 chains
- Using smart accounts where the swap recipient is the smart account itself
- Cross-chain swaps landing on L2s

### WETH Addresses by Chain

| Chain    | Chain ID | WETH Address                                 |
| -------- | -------- | -------------------------------------------- |
| Ethereum | 1        | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| Base     | 8453     | `0x4200000000000000000000000000000000000006` |
| Optimism | 10       | `0x4200000000000000000000000000000000000006` |
| Arbitrum | 42161    | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |

### Detection and Unwrap Pattern

```typescript
import { createPublicClient, createWalletClient, http, parseAbi, type Address } from 'viem';
import { base } from 'viem/chains';

const WETH_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function withdraw(uint256)',
]);

// Chain-specific WETH addresses
const WETH_ADDRESSES: Record<number, Address> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  10: '0x4200000000000000000000000000000000000006',
  8453: '0x4200000000000000000000000000000000000006',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
};

async function unwrapWethIfNeeded(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  accountAddress: Address,
  chainId: number
): Promise<void> {
  const wethAddress = WETH_ADDRESSES[chainId];
  if (!wethAddress) return;

  // Check WETH balance after swap
  const wethBalance = await publicClient.readContract({
    address: wethAddress,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [accountAddress],
  });

  if (wethBalance > 0n) {
    // Unwrap WETH to native ETH
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

### Integration with Trading API Flow

```typescript
// After executing a swap that outputs ETH on an L2:
const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });

if (receipt.status === 'success') {
  // Check and unwrap any WETH received instead of native ETH
  await unwrapWethIfNeeded(publicClient, walletClient, account.address, chainId);
}
```

---

## Rate Limiting Best Practices

The Trading API enforces rate limits to ensure fair usage. Hitting rate limits during batch operations is common and should be handled gracefully.

### Known Limits

| Endpoint          | Rate Limit          |
| ----------------- | ------------------- |
| `/check_approval` | ~10 requests/second |
| `/quote`          | ~10 requests/second |
| `/swap`           | ~10 requests/second |

### Exponential Backoff Implementation

```typescript
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 5,
  baseDelayMs: 200,
  maxDelayMs: 10000,
};

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    const response = await fetch(url, init);

    if (response.status !== 429 && response.status < 500) {
      return response;
    }

    if (attempt === options.maxRetries) {
      lastError = new Error(
        `Request failed after ${options.maxRetries} retries: ${response.status}`
      );
      break;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      options.baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
      options.maxDelayMs
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw lastError;
}
```

### Batch Operations

When executing multiple swaps or quotes in sequence, add deliberate delays:

```typescript
async function batchQuotes(
  params: QuoteParams[],
  apiKey: string,
  delayMs = 150
): Promise<QuoteResponse[]> {
  const results: QuoteResponse[] = [];

  for (const param of params) {
    const response = await fetchWithRetry('https://trade-api.gateway.uniswap.org/v1/quote', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(param),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Quote failed');
    results.push(data);

    // Deliberate delay between requests to stay under rate limits
    if (params.indexOf(param) < params.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
```

### Best Practices Summary

- Add 100-200ms delays between sequential API calls
- Implement exponential backoff with jitter for 429 responses
- Cache approval check results (approvals rarely change between calls)
- Batch quote requests where possible rather than requesting individually
- Monitor for 429 responses and adjust delay dynamically
