---
title: viem Integration
order: 7
---

# viem Integration

Integrate EVM blockchains using viem for TypeScript/JavaScript applications. Covers client setup, reading/writing data, accounts, contract interactions, and wagmi React hooks.

## Invocation

```text
/viem-integration
```

Or describe your requirements naturally:

```text
Help me set up viem to read smart contract data on Base
```

## What It Does

This skill helps you:

- **Set up blockchain clients**: PublicClient for reads, WalletClient for writes, with http/webSocket/custom transports
- **Read blockchain data**: Balances, contract state, event logs, and transaction details
- **Send transactions**: Token transfers, contract interactions with simulation, gas estimation, and nonce management
- **Build React frontends**: wagmi hooks for wallet connection, contract reads/writes, and chain switching

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

# For React apps
npm install wagmi viem @tanstack/react-query
```

## Core Concepts

### Clients

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

## Reference Topics

The skill includes detailed reference documentation covering:

- **Clients and Transports** -- PublicClient, WalletClient, chain configuration
- **Reading Data** -- getBalance, readContract, getLogs, watchContractEvent
- **Writing Transactions** -- sendTransaction, writeContract, simulateContract
- **Accounts and Keys** -- privateKeyToAccount, mnemonicToAccount, HD wallets
- **Contract Patterns** -- ABI formats, getContract, multicall, encodeFunctionData
- **Wagmi React** -- useAccount, useConnect, useReadContract, useWriteContract

## Related Resources

- [viem Plugin](/plugins/uniswap-viem) - Parent plugin
- [Swap Integration](/skills/swap-integration) - Build on viem basics with Uniswap swaps
- [viem Documentation](https://viem.sh) - Official docs
- [wagmi Documentation](https://wagmi.sh) - React hooks for Ethereum
