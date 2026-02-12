---
title: Uniswap Trading
order: 5
---

# Uniswap Trading

Integrate Uniswap swaps via Trading API, Universal Router SDK, or direct smart contract calls.

## Installation

```bash
/plugin install uniswap-trading
```

## Skills

| Skill                                          | Description                                       | Invocation          |
| ---------------------------------------------- | ------------------------------------------------- | ------------------- |
| [Swap Integration](../skills/swap-integration) | Comprehensive guide for integrating Uniswap swaps | `/swap-integration` |

## Agents

| Agent                   | Description                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| swap-integration-expert | Expert agent for complex swap integration questions, Trading API debugging, Universal Router encoding, and Permit2 patterns |

## Integration Methods

| Method                    | Best For              | Description                                                                            |
| ------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| **Trading API**           | Most use cases        | REST API with automatic routing optimization. 3-step flow: check_approval, quote, swap |
| **Universal Router SDK**  | Full control          | Direct SDK usage with `@uniswap/universal-router-sdk`. Command-based architecture      |
| **Direct Smart Contract** | On-chain integrations | Solidity contracts calling Universal Router for DeFi composability                     |

## Supported Chains

Ethereum (1), Optimism (10), BNB (56), Unichain (130), Polygon (137), X Layer (196), zkSync (324), World Chain (480), Soneium (1868), Base (8453), Arbitrum (42161), Celo (42220), Avalanche (43114), Blast (81457), Zora (7777777), Monad (143)

## Key References

- **Trading API**: `https://trade-api.gateway.uniswap.org/v1`
- **Universal Router**: [github.com/Uniswap/universal-router](https://github.com/Uniswap/universal-router)
- **SDKs**: `@uniswap/universal-router-sdk`, `@uniswap/v3-sdk`, `@uniswap/sdk-core`
- **Permit2**: Token approval infrastructure

## Related

- [Plugins Overview](/plugins/) - All available plugins
- [Uniswap Viem](/plugins/uniswap-viem) - Foundational EVM integration (prerequisite)
- [Uniswap Hooks](/plugins/uniswap-hooks) - V4 hook development
- [Skills](/skills/) - All available skills
