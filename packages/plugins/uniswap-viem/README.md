# Uniswap Viem Plugin

EVM blockchain integration using viem and wagmi.

## Installation

```bash
claude plugin add @uniswap/uniswap-viem
```

## Skills

| Skill              | Description                                     |
| ------------------ | ----------------------------------------------- |
| `viem-integration` | EVM blockchain integration using viem and wagmi |

## Use Cases

This plugin helps developers build:

- **Node.js Scripts/Backends** - Read blockchain data, send transactions, interact with smart contracts
- **React Frontends** - Wallet connection, contract reads/writes with wagmi hooks
- **Real-Time Monitoring** - Event subscriptions via WebSocket transports
- **Multi-Chain Applications** - Cross-chain client configuration

## Quick Start

### Using the Skill

The `viem-integration` skill activates when you mention blockchain development with viem or wagmi:

```text
"Help me read data from a smart contract using viem"
"Set up wagmi hooks for my React app"
"Send a transaction with viem"
```

### Slash Command

```text
/viem-integration
```

## Reference Topics

| Topic                | Coverage                                          |
| -------------------- | ------------------------------------------------- |
| Clients & Transports | PublicClient, WalletClient, http/webSocket/custom |
| Reading Data         | getBalance, readContract, getLogs, events         |
| Writing Transactions | sendTransaction, writeContract, gas, nonce        |
| Accounts & Keys      | Private keys, HD wallets, message signing         |
| Contract Patterns    | ABI handling, multicall, encoding/decoding        |
| Wagmi React          | useAccount, useConnect, useReadContract, and more |

## Related Plugins

- **uniswap-trading** - Uniswap swap integration (builds on viem basics)
- **uniswap-hooks** - Uniswap V4 hook development

## License

MIT
