---
title: Swap Integration
order: 6
---

# Swap Integration

Integrate Uniswap swaps into frontends, backends, and smart contracts using the Trading API, Universal Router SDK, or direct contract calls.

## Invocation

```text
/swap-integration
```

Or describe your requirements naturally:

```text
Help me add Uniswap swap functionality to my Next.js app
```

## What It Does

This skill helps you:

- **Choose the right integration method**: Trading API, Universal Router SDK, or direct smart contract calls
- **Build swap flows**: Frontend React hooks, backend Node.js scripts, and Solidity integrations
- **Handle Permit2**: Signature-based approvals, legacy approvals, and the rules for including permit data
- **Avoid common pitfalls**: Null field handling, swap request body format, pre-broadcast validation, and L2 WETH handling

## Quick Decision Guide

| Building...                    | Use This Method               |
| ------------------------------ | ----------------------------- |
| Frontend with React/Next.js    | Trading API                   |
| Backend script or bot          | Trading API                   |
| Smart contract integration     | Universal Router direct calls |
| Need full control over routing | Universal Router SDK          |

## Integration Methods

### Trading API (Recommended)

REST API with a 3-step flow: `check_approval` -> `quote` -> `swap`. Handles routing optimization automatically across all Uniswap protocol versions.

### Universal Router SDK

Direct SDK usage with `@uniswap/universal-router-sdk` for full control over transaction construction, including manual command building with `RoutePlanner`.

### Smart Contract Integration

On-chain Solidity contracts calling the Universal Router's `execute()` function with encoded commands for DeFi composability.

## Routing Types

| Type     | Description                             | Chains                             |
| -------- | --------------------------------------- | ---------------------------------- |
| CLASSIC  | Standard AMM swap through Uniswap pools | All supported chains               |
| DUTCH_V2 | UniswapX Dutch auction V2               | Ethereum, Arbitrum, Base, Unichain |
| PRIORITY | MEV-protected priority order            | Base, Unichain                     |
| WRAP     | ETH to WETH conversion                  | All                                |
| UNWRAP   | WETH to ETH conversion                  | All                                |

Additional types include DUTCH_V3, DUTCH_LIMIT, LIMIT_ORDER, BRIDGE, and QUICKROUTE.

## Key Topics Covered

- Trading API reference with request/response examples
- Universal Router command encoding and SDK patterns
- Permit2 integration (SignatureTransfer and AllowanceTransfer modes)
- UniswapX auction types by chain (Exclusive Dutch, Open Dutch, Priority Gas)
- ERC-4337 smart account integration
- Rate limiting and retry strategies
- Contract addresses for all supported chains

## Related Resources

- [Uniswap Trading Plugin](/plugins/uniswap-trading) - Parent plugin
- [viem Integration](/skills/viem-integration) - Prerequisite EVM blockchain setup
- [Universal Router GitHub](https://github.com/Uniswap/universal-router) - Source code
- [Uniswap Docs](https://docs.uniswap.org) - Official documentation
- [Uniswap API Docs](https://api-docs.uniswap.org/introduction) - Official API documentation
