# Writing Transactions

Reference for sending transactions and writing to contracts using viem.

## Simple ETH Transfer

### Basic Transfer

```typescript
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const account = privateKeyToAccount('0x...');

const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});

const hash = await client.sendTransaction({
  to: '0xRecipient...',
  value: parseEther('0.1'),
});

console.log(`Transaction hash: ${hash}`);
```

### With Gas Configuration

```typescript
const hash = await client.sendTransaction({
  to: '0x...',
  value: parseEther('0.1'),
  // EIP-1559 (recommended)
  maxFeePerGas: parseGwei('50'),
  maxPriorityFeePerGas: parseGwei('2'),
  // Or legacy gas price
  // gasPrice: parseGwei('50'),
  gas: 21000n, // Optional: override gas limit
});
```

---

## Writing to Contracts

### Basic Contract Write

```typescript
import { createWalletClient, http, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const account = privateKeyToAccount('0x...');

const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});

const abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const hash = await client.writeContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  abi,
  functionName: 'transfer',
  args: ['0xRecipient...', parseUnits('100', 6)],
});
```

### Using getContract

```typescript
import { getContract } from 'viem';

const contract = getContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi,
  client: walletClient,
});

const hash = await contract.write.transfer(['0x...', parseUnits('100', 6)]);
```

---

## Simulate Before Sending

Always simulate contract calls to catch errors before spending gas.

### simulateContract

```typescript
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const account = privateKeyToAccount('0x...');

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});

const abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

// Simulate the transaction
const { request, result } = await publicClient.simulateContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi,
  functionName: 'transfer',
  args: ['0x...', parseUnits('100', 6)],
  account,
});

console.log('Simulation result:', result); // true (return value)

// Execute if simulation succeeds
const hash = await walletClient.writeContract(request);
```

### Handle Simulation Errors

```typescript
import { ContractFunctionRevertedError } from 'viem';

try {
  const { request } = await publicClient.simulateContract({
    address: '0x...',
    abi,
    functionName: 'transfer',
    args: ['0x...', amount],
    account,
  });
  const hash = await walletClient.writeContract(request);
} catch (error) {
  if (error instanceof ContractFunctionRevertedError) {
    console.error('Contract reverted:', error.reason);
  }
  throw error;
}
```

---

## Waiting for Confirmation

### waitForTransactionReceipt

```typescript
const hash = await walletClient.writeContract({
  address: '0x...',
  abi,
  functionName: 'transfer',
  args: ['0x...', amount],
});

// Wait for 1 confirmation (default)
const receipt = await publicClient.waitForTransactionReceipt({ hash });

console.log('Status:', receipt.status); // 'success' | 'reverted'
console.log('Block:', receipt.blockNumber);
console.log('Gas used:', receipt.gasUsed);
```

### With Options

```typescript
const receipt = await publicClient.waitForTransactionReceipt({
  hash,
  confirmations: 3, // Wait for 3 block confirmations
  timeout: 120_000, // 2 minute timeout
  pollingInterval: 1_000, // Check every second
});
```

### Check Transaction Success

```typescript
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status === 'reverted') {
  throw new Error('Transaction reverted');
}
```

---

## Gas Estimation

### Estimate Gas for Transaction

```typescript
const gas = await publicClient.estimateGas({
  account,
  to: '0x...',
  value: parseEther('1'),
});

// Use with buffer
const hash = await walletClient.sendTransaction({
  to: '0x...',
  value: parseEther('1'),
  gas: (gas * 110n) / 100n, // 10% buffer
});
```

### Estimate Gas for Contract Call

```typescript
const gas = await publicClient.estimateContractGas({
  address: '0x...',
  abi,
  functionName: 'transfer',
  args: ['0x...', amount],
  account,
});
```

### Get Current Gas Prices

```typescript
// EIP-1559 fees (recommended)
const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

// Legacy gas price
const gasPrice = await publicClient.getGasPrice();
```

### Custom Gas Strategy

```typescript
// Get fee data and add buffer
const feeData = await publicClient.estimateFeesPerGas();

const hash = await walletClient.sendTransaction({
  to: '0x...',
  value: parseEther('1'),
  maxFeePerGas: (feeData.maxFeePerGas! * 120n) / 100n, // 20% buffer
  maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas! * 120n) / 100n,
});
```

---

## Nonce Management

### Auto Nonce (Default)

viem automatically manages nonces:

```typescript
// These will be sent with sequential nonces
const hash1 = await client.sendTransaction({ to: '0x...', value: parseEther('1') });
const hash2 = await client.sendTransaction({ to: '0x...', value: parseEther('1') });
```

### Manual Nonce

```typescript
// Get current nonce
const nonce = await publicClient.getTransactionCount({ address: account.address });

// Send with specific nonce
const hash = await walletClient.sendTransaction({
  to: '0x...',
  value: parseEther('1'),
  nonce,
});
```

### Batch Transactions with Manual Nonces

```typescript
const baseNonce = await publicClient.getTransactionCount({
  address: account.address,
});

// Send multiple transactions in parallel
const hashes = await Promise.all([
  walletClient.sendTransaction({
    to: '0xAddr1',
    value: parseEther('1'),
    nonce: baseNonce,
  }),
  walletClient.sendTransaction({
    to: '0xAddr2',
    value: parseEther('1'),
    nonce: baseNonce + 1,
  }),
  walletClient.sendTransaction({
    to: '0xAddr3',
    value: parseEther('1'),
    nonce: baseNonce + 2,
  }),
]);
```

---

## Transaction Replacement

### Speed Up Transaction

Replace a pending transaction with higher gas:

```typescript
// Original transaction
const originalNonce = await publicClient.getTransactionCount({
  address: account.address,
  blockTag: 'latest', // Confirmed nonce
});

const pendingNonce = await publicClient.getTransactionCount({
  address: account.address,
  blockTag: 'pending', // Includes pending txs
});

// If there's a pending transaction
if (pendingNonce > originalNonce) {
  // Speed up by resending with same nonce, higher gas
  const hash = await walletClient.sendTransaction({
    to: '0x...',
    value: parseEther('1'),
    nonce: originalNonce,
    maxFeePerGas: parseGwei('100'), // Higher gas
    maxPriorityFeePerGas: parseGwei('5'),
  });
}
```

### Cancel Transaction

Send 0 ETH to yourself with the same nonce:

```typescript
const nonce = await publicClient.getTransactionCount({
  address: account.address,
  blockTag: 'latest',
});

// Cancel by sending 0 ETH to self with higher gas
const hash = await walletClient.sendTransaction({
  to: account.address,
  value: 0n,
  nonce,
  maxFeePerGas: parseGwei('100'),
  maxPriorityFeePerGas: parseGwei('5'),
});
```

---

## Raw Transaction Signing

### Sign Without Sending

```typescript
import { createWalletClient, http, parseEther, serializeTransaction } from 'viem';

// Prepare transaction
const request = await walletClient.prepareTransactionRequest({
  to: '0x...',
  value: parseEther('1'),
});

// Sign the transaction
const signedTx = await walletClient.signTransaction(request);

// Later: send the signed transaction
const hash = await walletClient.sendRawTransaction({
  serializedTransaction: signedTx,
});
```

---

## EIP-4844 Blob Transactions

For L2 data availability:

```typescript
import { stringToHex, toBlobs } from 'viem';

const blobs = toBlobs({ data: stringToHex('my data') });

const hash = await walletClient.sendTransaction({
  blobs,
  kzg, // KZG instance
  maxFeePerBlobGas: parseGwei('10'),
  to: '0x...',
});
```

---

## Error Handling

### Common Errors

```typescript
import {
  InsufficientFundsError,
  ContractFunctionExecutionError,
  TransactionExecutionError,
  UserRejectedRequestError,
} from 'viem';

try {
  const hash = await walletClient.writeContract({
    address: '0x...',
    abi,
    functionName: 'transfer',
    args: ['0x...', amount],
  });
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    console.error('Not enough ETH for gas');
  }
  if (error instanceof ContractFunctionExecutionError) {
    console.error('Contract error:', error.shortMessage);
  }
  if (error instanceof UserRejectedRequestError) {
    console.error('User rejected the transaction');
  }
  if (error instanceof TransactionExecutionError) {
    console.error('Transaction failed:', error.shortMessage);
  }
}
```

### Retry Pattern

```typescript
async function sendWithRetry(
  client: WalletClient,
  tx: Parameters<typeof client.sendTransaction>[0],
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.sendTransaction(tx);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // Increase gas on retry
      tx = {
        ...tx,
        maxFeePerGas: tx.maxFeePerGas ? (tx.maxFeePerGas * 120n) / 100n : undefined,
      };
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```
