# CLAUDE.md - uniswap-viem Plugin

## Overview

This plugin provides foundational EVM blockchain integration skills using viem and wagmi. It helps developers quickly set up blockchain connections, read/write data, manage accounts, interact with smart contracts, and build React frontends with wagmi hooks.

## Plugin Components

### Skills (./skills/)

- **viem-integration**: Comprehensive guide for EVM blockchain integration using viem. Covers client setup, reading/writing data, accounts, contract interactions, and wagmi React hooks.

### Agents (./agents/)

- **viem-integration-expert**: Expert agent for complex viem and wagmi integration questions, debugging, gas optimization, and multi-chain patterns.

## File Structure

```text
uniswap-viem/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── viem-integration-expert.md
├── skills/
│   └── viem-integration/
│       ├── viem-integration.md
│       ├── SKILL.md -> viem-integration.md
│       └── references/
│           ├── clients-and-transports.md
│           ├── reading-data.md
│           ├── writing-transactions.md
│           ├── accounts-and-keys.md
│           ├── contract-patterns.md
│           └── wagmi-react.md
├── project.json
├── package.json
├── CLAUDE.md
└── README.md
```

## viem Integration Skill

### Topics Covered

| Reference File            | Topics                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------- |
| clients-and-transports.md | PublicClient, WalletClient, http/webSocket/custom transports, chain configuration  |
| reading-data.md           | getBalance, readContract, getLogs, watchContractEvent, getTransaction              |
| writing-transactions.md   | sendTransaction, writeContract, simulateContract, gas estimation, nonce management |
| accounts-and-keys.md      | privateKeyToAccount, mnemonicToAccount, HD wallets, message signing                |
| contract-patterns.md      | ABI formats, getContract, multicall, encodeFunctionData, decodeEventLog            |
| wagmi-react.md            | useAccount, useConnect, useReadContract, useWriteContract, useSwitchChain          |

### Supported Chains

All EVM-compatible chains including: Ethereum, Arbitrum, Optimism, Base, Polygon, BNB Chain, Avalanche, Blast, zkSync, Linea, Scroll, and more.

## Related Plugins

- **uniswap-trading**: Uniswap swap integration via Trading API, Universal Router, and SDKs (builds on viem basics)
- **uniswap-hooks**: Uniswap V4 hook development with security-first approach

## Key References

- viem Documentation: <https://viem.sh>
- wagmi Documentation: <https://wagmi.sh>
- Package: `viem`, `wagmi`, `@tanstack/react-query`
