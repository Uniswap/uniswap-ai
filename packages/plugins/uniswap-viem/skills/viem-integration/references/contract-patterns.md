# Contract Patterns

Reference for ABI handling, contract instances, multicall, and encoding/decoding with viem.

## ABI Formats

### JSON ABI (From Compilation)

```typescript
// Typically from Solidity compiler output
const abi = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
```

### Human-Readable ABI

```typescript
import { parseAbi, parseAbiItem } from 'viem';

// Parse multiple items
const abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'error InsufficientBalance(uint256 available, uint256 required)',
]);

// Parse single item
const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);
```

### ABI Type Inference

viem provides full TypeScript inference for ABIs:

```typescript
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

// TypeScript knows:
// - balanceOf takes 1 address arg, returns bigint
// - transfer takes address + bigint, returns boolean

const balance = await client.readContract({
  address: '0x...',
  abi,
  functionName: 'balanceOf', // Autocomplete works!
  args: ['0x...'], // Type-checked: must be [Address]
});
// balance is typed as bigint
```

---

## Contract Instance Pattern

### getContract

```typescript
import { getContract } from 'viem';

const contract = getContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  client: publicClient,
});

// Read functions
const name = await contract.read.name();
const balance = await contract.read.balanceOf(['0x...']);
const allowance = await contract.read.allowance(['0xOwner', '0xSpender']);

// Get events
const events = await contract.getEvents.Transfer({
  fromBlock: 18000000n,
});
```

### With Both Clients

```typescript
const contract = getContract({
  address: '0x...',
  abi: erc20Abi,
  client: {
    public: publicClient,
    wallet: walletClient,
  },
});

// Read
const balance = await contract.read.balanceOf(['0x...']);

// Write
const hash = await contract.write.transfer(['0x...', parseUnits('100', 18)]);

// Simulate
const { result } = await contract.simulate.transfer(['0x...', amount]);
```

### Watch Events

```typescript
const unwatch = contract.watchEvent.Transfer({
  onLogs: (logs) => {
    console.log('New transfers:', logs);
  },
});
```

---

## Multicall (Batch Reads)

### Basic Multicall

```typescript
const results = await publicClient.multicall({
  contracts: [
    {
      address: '0xToken1',
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: ['0xUser'],
    },
    {
      address: '0xToken2',
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: ['0xUser'],
    },
    {
      address: '0xToken3',
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: ['0xUser'],
    },
  ],
});

// Results array matches input order
// Each result has: { result, status: 'success' } or { error, status: 'failure' }
for (const res of results) {
  if (res.status === 'success') {
    console.log('Balance:', res.result);
  } else {
    console.error('Failed:', res.error);
  }
}
```

### Reusable Contract Config

```typescript
const usdcContract = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
} as const;

const results = await publicClient.multicall({
  contracts: [
    { ...usdcContract, functionName: 'name' },
    { ...usdcContract, functionName: 'symbol' },
    { ...usdcContract, functionName: 'decimals' },
    { ...usdcContract, functionName: 'totalSupply' },
  ],
});

const [name, symbol, decimals, totalSupply] = results.map((r) =>
  r.status === 'success' ? r.result : null
);
```

### Allow Failures

```typescript
const results = await publicClient.multicall({
  contracts: [...],
  allowFailure: true  // Default: true, continue on individual failures
})

// With allowFailure: false, throws on any failure
const results = await publicClient.multicall({
  contracts: [...],
  allowFailure: false
})
```

### At Specific Block

```typescript
const results = await publicClient.multicall({
  contracts: [...],
  blockNumber: 18000000n
})
```

---

## Encoding Functions

### encodeFunctionData

Encode a function call to calldata:

```typescript
import { encodeFunctionData, parseAbi } from 'viem';

const abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

const data = encodeFunctionData({
  abi,
  functionName: 'transfer',
  args: ['0xRecipient', parseUnits('100', 18)],
});

// data = '0xa9059cbb000000000000000000000000...'
```

### For Low-Level Calls

```typescript
const hash = await walletClient.sendTransaction({
  to: '0xContractAddress',
  data: encodeFunctionData({
    abi,
    functionName: 'transfer',
    args: ['0x...', amount],
  }),
});
```

### encodeAbiParameters

Encode raw parameters (no function selector):

```typescript
import { encodeAbiParameters, parseAbiParameters } from 'viem';

const encoded = encodeAbiParameters(parseAbiParameters('address, uint256'), ['0x...', 123n]);
```

---

## Decoding Functions

### decodeFunctionResult

Decode return data from a function call:

```typescript
import { decodeFunctionResult, parseAbi } from 'viem';

const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

const result = decodeFunctionResult({
  abi,
  functionName: 'balanceOf',
  data: '0x0000000000000000000000000000000000000000000000000000000000000064',
});

// result = 100n
```

### decodeFunctionData

Decode calldata back to function name and args:

```typescript
import { decodeFunctionData, parseAbi } from 'viem';

const abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

const { functionName, args } = decodeFunctionData({
  abi,
  data: '0xa9059cbb...',
});

// functionName = 'transfer'
// args = ['0x...', 100n]
```

### decodeAbiParameters

Decode raw ABI-encoded data:

```typescript
import { decodeAbiParameters, parseAbiParameters } from 'viem';

const decoded = decodeAbiParameters(
  parseAbiParameters('address, uint256'),
  '0x000000000000000000000000...'
);

// decoded = ['0x...', 100n]
```

---

## Event Decoding

### decodeEventLog

```typescript
import { decodeEventLog, parseAbi } from 'viem';

const abi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);

const { eventName, args } = decodeEventLog({
  abi,
  data: log.data,
  topics: log.topics,
});

// eventName = 'Transfer'
// args = { from: '0x...', to: '0x...', value: 100n }
```

### Parse Log from Receipt

```typescript
const receipt = await publicClient.getTransactionReceipt({ hash: '0x...' });

for (const log of receipt.logs) {
  try {
    const { eventName, args } = decodeEventLog({
      abi: erc20Abi,
      data: log.data,
      topics: log.topics,
    });
    console.log(eventName, args);
  } catch {
    // Log doesn't match this ABI
  }
}
```

---

## Error Decoding

### decodeErrorResult

```typescript
import { decodeErrorResult, parseAbi } from 'viem';

const abi = parseAbi(['error InsufficientBalance(uint256 available, uint256 required)']);

const { errorName, args } = decodeErrorResult({
  abi,
  data: '0x...',
});

// errorName = 'InsufficientBalance'
// args = { available: 50n, required: 100n }
```

---

## Common Contract ABIs

### ERC-20 (Tokens)

```typescript
const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);
```

### ERC-721 (NFTs)

```typescript
const erc721Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
]);
```

### ERC-1155 (Multi-Token)

```typescript
const erc1155Abi = parseAbi([
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)',
  'function uri(uint256 id) view returns (string)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
]);
```

### Multicall3

```typescript
const multicall3Abi = parseAbi([
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[])',
  'function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])',
]);

// Multicall3 address (same on all chains)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
```
