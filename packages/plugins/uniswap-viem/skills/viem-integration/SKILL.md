---
name: viem-integration
description: Integrate EVM blockchains using viem. Use when user says "read blockchain data", "send transaction", "interact with smart contract", "connect to Ethereum", "use viem", "use wagmi", "wallet integration", "viem setup", or mentions blockchain/EVM development with TypeScript.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), WebFetch, Task(subagent_type:viem-integration-expert)
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# viem Integration

Integrate EVM blockchains using viem for TypeScript/JavaScript applications.

## Quick Decision Guide

| Building...                | Use This                       |
| -------------------------- | ------------------------------ |
| Node.js script/backend     | viem with http transport       |
| React/Next.js frontend     | wagmi hooks (built on viem)    |
| Real-time event monitoring | viem with webSocket transport  |
| Browser wallet integration | wagmi or viem custom transport |

## Installation

```bash
# Core library
npm install viem

# For React apps, also install wagmi
npm install wagmi viem @tanstack/react-query
```

## Core Concepts

### Clients

viem uses two client types:

| Client           | Purpose              | Example Use                              |
| ---------------- | -------------------- | ---------------------------------------- |
| **PublicClient** | Read-only operations | Get balances, read contracts, fetch logs |
| **WalletClient** | Write operations     | Send transactions, sign messages         |

### Transports

| Transport     | Use Case                          |
| ------------- | --------------------------------- |
| `http()`      | Standard RPC calls (most common)  |
| `webSocket()` | Real-time event subscriptions     |
| `custom()`    | Browser wallets (window.ethereum) |

### Chains

viem includes 50+ chain definitions. Import from `viem/chains`:

```typescript
import { mainnet, arbitrum, optimism, base, polygon } from 'viem/chains';
```

---

## Quick Start Examples

### Read Balance

```typescript
import { createPublicClient, http, formatEther } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const balance = await client.getBalance({
  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
});

console.log(`Balance: ${formatEther(balance)} ETH`);
```

### Read Contract

```typescript
import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

const balance = await client.readContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  abi,
  functionName: 'balanceOf',
  args: ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'],
});
```

### Send Transaction

```typescript
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});

const hash = await client.sendTransaction({
  to: '0x...',
  value: parseEther('0.1'),
});

console.log(`Transaction hash: ${hash}`);
```

### Write to Contract

```typescript
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

// Simulate first to catch errors
const { request } = await publicClient.simulateContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi,
  functionName: 'transfer',
  args: ['0x...', parseUnits('100', 6)],
  account,
});

// Execute the transaction
const hash = await walletClient.writeContract(request);

// Wait for confirmation
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`Confirmed in block ${receipt.blockNumber}`);
```

---

## Reference Documentation

For deeper coverage of specific topics:

| Topic                            | Reference File                                                 |
| -------------------------------- | -------------------------------------------------------------- |
| Client setup, transports, chains | [Clients & Transports](./references/clients-and-transports.md) |
| Reading blockchain data          | [Reading Data](./references/reading-data.md)                   |
| Sending transactions             | [Writing Transactions](./references/writing-transactions.md)   |
| Private keys, HD wallets         | [Accounts & Keys](./references/accounts-and-keys.md)           |
| ABI handling, multicall          | [Contract Patterns](./references/contract-patterns.md)         |
| React/wagmi hooks                | [Wagmi React](./references/wagmi-react.md)                     |

---

## Related Plugins

Once you're comfortable with viem basics, the **uniswap-trading** plugin provides comprehensive Uniswap swap integration:

- Uniswap Trading API integration
- Universal Router SDK usage
- Token swap implementations

Install it with: `claude plugin add @uniswap/uniswap-trading`

---

## Common Utilities

### Unit Conversion

```typescript
import { parseEther, formatEther, parseUnits, formatUnits } from 'viem';

// ETH
parseEther('1.5'); // 1500000000000000000n (wei)
formatEther(1500000000000000000n); // "1.5"

// Tokens (e.g., USDC with 6 decimals)
parseUnits('100', 6); // 100000000n
formatUnits(100000000n, 6); // "100"
```

### Address Utilities

```typescript
import { getAddress, isAddress } from 'viem';

isAddress('0x...'); // true/false
getAddress('0x...'); // checksummed address
```

### Hashing

```typescript
import { keccak256, toHex } from 'viem';

keccak256(toHex('hello')); // 0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8
```

---

## Error Handling

viem throws typed errors that can be caught and handled:

```typescript
import { ContractFunctionExecutionError, InsufficientFundsError } from 'viem'

try {
  await client.writeContract(...)
} catch (error) {
  if (error instanceof ContractFunctionExecutionError) {
    console.error('Contract call failed:', error.shortMessage)
  }
  if (error instanceof InsufficientFundsError) {
    console.error('Not enough ETH for gas')
  }
}
```

---

## Resources

- [viem Documentation](https://viem.sh)
- [wagmi Documentation](https://wagmi.sh)
- [viem GitHub](https://github.com/wevm/viem)
- [wagmi GitHub](https://github.com/wevm/wagmi)
