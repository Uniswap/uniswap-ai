# CLAUDE.md - uniswap-trading Plugin

## Overview

This plugin provides comprehensive guidance for integrating Uniswap swaps into frontends, backends, and smart contracts. It supports the Trading API, Universal Router SDK, and direct smart contract integration.

## Plugin Components

### Skills (./skills/)

- **swap-integration**: Comprehensive guide for integrating Uniswap swaps via Trading API, Universal Router SDK, or direct smart contract calls. Covers frontend hooks, backend scripts, Solidity integrations, Permit2 patterns, and troubleshooting.

### Agents (./agents/)

- **swap-integration-expert**: Expert agent for complex Uniswap swap integration questions, Trading API debugging, Universal Router encoding, and Permit2 patterns.

## File Structure

```text
uniswap-trading/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── swap-integration-expert.md
├── skills/
│   └── swap-integration/
│       ├── swap-integration.md
│       └── SKILL.md -> swap-integration.md
├── project.json
├── package.json
├── CLAUDE.md
└── README.md
```

## Integration Methods

1. **Trading API** (Recommended for most use cases)

   - REST API at `https://trade-api.gateway.uniswap.org/v1`
   - Handles routing optimization automatically
   - 3-step flow: check_approval -> quote -> swap

2. **Universal Router SDK**

   - Direct SDK usage with `@uniswap/universal-router-sdk`
   - Full control over transaction construction
   - Command-based architecture

3. **Direct Smart Contract Integration**
   - Solidity contracts calling Universal Router
   - For on-chain integrations and DeFi composability

## Supported Chains

Mainnet (1), Optimism (10), Polygon (137), Arbitrum (42161), Base (8453), BNB (56), Blast (81457), Unichain (130)

## Related Plugins

- **uniswap-viem**: Foundational EVM blockchain integration using viem/wagmi (prerequisite knowledge)
- **uniswap-hooks**: Uniswap V4 hook development with security-first approach

## Key References

- Trading API: `https://trade-api.gateway.uniswap.org/v1`
- Universal Router: `github.com/Uniswap/universal-router`
- SDKs: `@uniswap/universal-router-sdk`, `@uniswap/v3-sdk`, `@uniswap/sdk-core`
- Permit2: Token approval infrastructure
