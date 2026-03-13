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

See the [official supported chains list](https://api-docs.uniswap.org/guides/supported_chains#supported-chains-for-swapping) for the current set of chains supported by the Trading API.

## Key References

- **Trading API**: `https://trade-api.gateway.uniswap.org/v1`
- **Universal Router**: [github.com/Uniswap/universal-router](https://github.com/Uniswap/universal-router)
- **SDKs**: `@uniswap/universal-router-sdk`, `@uniswap/v3-sdk`, `@uniswap/sdk-core`
- **Permit2**: Token approval infrastructure

## Related

- [Plugins Overview](/plugins/) - All available plugins
- [Uniswap Viem](/plugins/uniswap-viem) - Foundational EVM integration (prerequisite)
- [Uniswap Hooks](/plugins/uniswap-hooks) - v4 hook development
- [Skills](/skills/) - All available skills
