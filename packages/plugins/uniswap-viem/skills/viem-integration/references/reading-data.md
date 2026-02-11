# Reading Data

Reference for all read operations from the blockchain using viem.

## Account Data

### Get Balance

```typescript
import { createPublicClient, http, formatEther } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// Get ETH balance
const balance = await client.getBalance({
  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
});

console.log(`${formatEther(balance)} ETH`);

// At specific block
const historicalBalance = await client.getBalance({
  address: '0x...',
  blockNumber: 18000000n,
});

// At block tag
const pendingBalance = await client.getBalance({
  address: '0x...',
  blockTag: 'pending', // 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized'
});
```

### Get Transaction Count (Nonce)

```typescript
const nonce = await client.getTransactionCount({
  address: '0x...',
});

// Pending nonce (includes mempool txs)
const pendingNonce = await client.getTransactionCount({
  address: '0x...',
  blockTag: 'pending',
});
```

### Get Bytecode

```typescript
const bytecode = await client.getCode({
  address: '0x...',
});

// Check if address is a contract
const isContract = bytecode && bytecode !== '0x';
```

---

## Block Data

### Get Block

```typescript
// Latest block
const block = await client.getBlock();

// By number
const block = await client.getBlock({
  blockNumber: 18000000n,
});

// By hash
const block = await client.getBlock({
  blockHash: '0x...',
});

// Include transactions
const blockWithTxs = await client.getBlock({
  blockNumber: 18000000n,
  includeTransactions: true,
});
```

### Block Properties

```typescript
const block = await client.getBlock();

block.number; // bigint - block number
block.hash; // string - block hash
block.timestamp; // bigint - unix timestamp
block.gasUsed; // bigint - gas used
block.gasLimit; // bigint - gas limit
block.baseFeePerGas; // bigint | null - EIP-1559 base fee
block.transactions; // string[] | Transaction[] - tx hashes or full txs
block.parentHash; // string - parent block hash
block.miner; // string - miner/validator address
```

### Get Block Number

```typescript
const blockNumber = await client.getBlockNumber();
```

### Watch Blocks

```typescript
const unwatch = client.watchBlocks({
  onBlock: (block) => {
    console.log(`New block: ${block.number}`);
  },
});

// Stop watching
unwatch();
```

---

## Reading Contracts

### readContract

```typescript
import { parseAbi } from 'viem';

const abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
]);

// Read single function
const balance = await client.readContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  abi,
  functionName: 'balanceOf',
  args: ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'],
});

// Read without args
const name = await client.readContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi,
  functionName: 'name',
});

// At specific block
const historicalBalance = await client.readContract({
  address: '0x...',
  abi,
  functionName: 'balanceOf',
  args: ['0x...'],
  blockNumber: 18000000n,
});
```

### Using getContract

For multiple reads on the same contract:

```typescript
import { getContract } from 'viem';

const contract = getContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi,
  client,
});

// Cleaner syntax for reads
const balance = await contract.read.balanceOf(['0x...']);
const name = await contract.read.name();
const decimals = await contract.read.decimals();
```

---

## Fetching Logs/Events

### getLogs

```typescript
import { parseAbiItem } from 'viem';

// Define event
const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

// Get all Transfer events from a contract
const logs = await client.getLogs({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  event: transferEvent,
  fromBlock: 18000000n,
  toBlock: 18001000n,
});

// Process logs
for (const log of logs) {
  console.log(`Transfer: ${log.args.from} -> ${log.args.to}: ${log.args.value}`);
}
```

### Filter by Indexed Parameters

```typescript
// Get transfers TO a specific address
const logs = await client.getLogs({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  event: transferEvent,
  args: {
    to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  },
  fromBlock: 18000000n,
  toBlock: 'latest',
});

// Get transfers FROM a specific address
const logs = await client.getLogs({
  address: '0x...',
  event: transferEvent,
  args: {
    from: '0x...',
  },
  fromBlock: 18000000n,
});

// Multiple values (OR condition)
const logs = await client.getLogs({
  address: '0x...',
  event: transferEvent,
  args: {
    from: ['0xAddress1', '0xAddress2'],
  },
  fromBlock: 18000000n,
});
```

### Get All Events (No Filter)

```typescript
// Get all events from a contract (use with caution - can be large)
const logs = await client.getLogs({
  address: '0x...',
  fromBlock: 18000000n,
  toBlock: 18000100n,
});
```

### getContractEvents

Alternative syntax using ABI:

```typescript
const logs = await client.getContractEvents({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi,
  eventName: 'Transfer',
  fromBlock: 18000000n,
  toBlock: 18001000n,
});
```

---

## Watching Events (Real-time)

### watchContractEvent

```typescript
const unwatch = client.watchContractEvent({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi,
  eventName: 'Transfer',
  onLogs: (logs) => {
    for (const log of logs) {
      console.log(`New transfer: ${log.args.from} -> ${log.args.to}`);
    }
  },
});

// Stop watching
unwatch();
```

### Watch with Filters

```typescript
const unwatch = client.watchContractEvent({
  address: '0x...',
  abi,
  eventName: 'Transfer',
  args: {
    to: '0xMyAddress...', // Only transfers to me
  },
  onLogs: (logs) => {
    console.log('Received transfer!');
  },
});
```

### Watch All Events

```typescript
const unwatch = client.watchEvent({
  onLogs: (logs) => {
    console.log('New events:', logs);
  },
});
```

### Error Handling

```typescript
const unwatch = client.watchContractEvent({
  address: '0x...',
  abi,
  eventName: 'Transfer',
  onLogs: (logs) => {
    console.log('New logs:', logs);
  },
  onError: (error) => {
    console.error('Watch error:', error);
  },
});
```

---

## Transaction Data

### Get Transaction

```typescript
const tx = await client.getTransaction({
  hash: '0x...',
});

tx.hash; // transaction hash
tx.from; // sender address
tx.to; // recipient address
tx.value; // ETH value in wei
tx.input; // calldata
tx.gas; // gas limit
tx.gasPrice; // gas price (legacy)
tx.maxFeePerGas; // max fee (EIP-1559)
tx.maxPriorityFeePerGas; // priority fee (EIP-1559)
tx.nonce; // sender nonce
tx.blockNumber; // block number (null if pending)
tx.blockHash; // block hash (null if pending)
```

### Get Transaction Receipt

```typescript
const receipt = await client.getTransactionReceipt({
  hash: '0x...',
});

receipt.status; // 'success' | 'reverted'
receipt.blockNumber; // block number
receipt.gasUsed; // gas used
receipt.effectiveGasPrice; // actual gas price paid
receipt.logs; // event logs
receipt.contractAddress; // deployed contract address (if deployment)
```

### Wait for Transaction

```typescript
// Wait for confirmation
const receipt = await client.waitForTransactionReceipt({
  hash: '0x...',
});

// With options
const receipt = await client.waitForTransactionReceipt({
  hash: '0x...',
  confirmations: 2, // Wait for N confirmations
  timeout: 60_000, // Timeout in ms
  pollingInterval: 1_000, // Poll every N ms
});
```

### Watch Pending Transactions

```typescript
const unwatch = client.watchPendingTransactions({
  onTransactions: (hashes) => {
    console.log('Pending txs:', hashes);
  },
});
```

---

## Gas Estimation

### Estimate Gas

```typescript
const gas = await client.estimateGas({
  account: '0x...',
  to: '0x...',
  value: parseEther('1'),
});
```

### Estimate Contract Gas

```typescript
const gas = await client.estimateContractGas({
  address: '0x...',
  abi,
  functionName: 'transfer',
  args: ['0x...', parseUnits('100', 18)],
  account: '0x...',
});
```

### Get Fee Data

```typescript
// EIP-1559 fees
const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();

// Legacy gas price
const gasPrice = await client.getGasPrice();
```

---

## Chain Data

### Get Chain ID

```typescript
const chainId = await client.getChainId();
```

### Get Block Gas Limit

```typescript
const block = await client.getBlock();
const gasLimit = block.gasLimit;
```

---

## Batching Reads

Use multicall for efficient batch reads (see [Contract Patterns](./contract-patterns.md) for details):

```typescript
const results = await client.multicall({
  contracts: [
    { address: token1, abi, functionName: 'balanceOf', args: [user] },
    { address: token2, abi, functionName: 'balanceOf', args: [user] },
    { address: token3, abi, functionName: 'balanceOf', args: [user] },
  ],
});
```
