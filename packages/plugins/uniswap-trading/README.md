# Uniswap Trading Plugin

Integrate Uniswap swaps into frontends, backends, and smart contracts.

## Installation

```bash
claude plugin add @uniswap/uniswap-trading
```

## Skills

| Skill              | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `swap-integration` | Integrate Uniswap swaps via Trading API, Universal Router, or SDKs |

## Use Cases

This plugin helps developers build:

- **Custom Swap Frontends** - React/TypeScript applications with swap functionality
- **Swap Scripts/Backends** - Node.js scripts for programmatic swaps
- **Smart Contract Integrations** - Solidity contracts calling Universal Router

## Quick Start

### Using the Skill

The `swap-integration` skill activates when you mention building swaps or integrating Uniswap:

```text
"Help me integrate Uniswap swaps into my frontend"
"Build a swap script that trades USDC for ETH"
"Create a smart contract that executes swaps via Universal Router"
```

### Slash Command

```text
/swap-integration
```

## Supported Protocols

- Uniswap V2
- Uniswap V3
- Uniswap V4
- Universal Router (unified interface for all versions)

## Integration Methods

| Method                    | Best For                                               |
| ------------------------- | ------------------------------------------------------ |
| **Trading API**           | Frontends, backends - handles routing and optimization |
| **Universal Router SDK**  | Direct contract interaction with full control          |
| **Direct Contract Calls** | Smart contract integrations                            |

## Prerequisites

This plugin assumes familiarity with viem basics. Install the **uniswap-viem** plugin for comprehensive viem/wagmi guidance:

```bash
claude plugin add @uniswap/uniswap-viem
```

## License

MIT
