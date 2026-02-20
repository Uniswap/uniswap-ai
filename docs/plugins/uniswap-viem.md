---
title: Uniswap Viem
order: 6
---

# Uniswap Viem

EVM blockchain integration using viem and wagmi.

## Installation

```bash
/plugin install uniswap-viem
```

## Skills

| Skill                                          | Description                                                   | Invocation          |
| ---------------------------------------------- | ------------------------------------------------------------- | ------------------- |
| [Viem Integration](../skills/viem-integration) | Comprehensive guide for EVM blockchain integration using viem | `/viem-integration` |

## Agents

| Agent                   | Description                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| viem-integration-expert | Expert agent for complex viem and wagmi integration questions, debugging, gas optimization, and multi-chain patterns |

## Topics Covered

| Reference              | Topics                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------- |
| clients-and-transports | PublicClient, WalletClient, http/webSocket/custom transports, chain configuration  |
| reading-data           | getBalance, readContract, getLogs, watchContractEvent, getTransaction              |
| writing-transactions   | sendTransaction, writeContract, simulateContract, gas estimation, nonce management |
| accounts-and-keys      | privateKeyToAccount, mnemonicToAccount, HD wallets, message signing                |
| contract-patterns      | ABI formats, getContract, multicall, encodeFunctionData, decodeEventLog            |
| wagmi-react            | useAccount, useConnect, useReadContract, useWriteContract, useSwitchChain          |

## Supported Chains

All EVM-compatible chains including Ethereum, Arbitrum, Optimism, Base, Polygon, BNB Chain, Avalanche, Blast, zkSync, Linea, Scroll, and more.

## Key References

- [viem Documentation](https://viem.sh)
- [wagmi Documentation](https://wagmi.sh)
- **Packages**: `viem`, `wagmi`, `@tanstack/react-query`

## Related

- [Plugins Overview](/plugins/) - All available plugins
- [Uniswap Trading](/plugins/uniswap-trading) - Swap integration (builds on viem basics)
- [Uniswap Hooks](/plugins/uniswap-hooks) - v4 hook development
- [Skills](/skills/) - All available skills
