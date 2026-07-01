---
title: Swap Integration
order: 6
---

# Swap Integration

Integrate Uniswap swaps into scripts, agents, frontends, and smart contracts — driving the `uni` CLI, the `@uniswap/sdk` facade, the raw Trading API, or the Universal Router SDK / direct contract calls.

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

- **Choose the right integration method**: the `uni` CLI, the `@uniswap/sdk` facade, the raw Trading API, the Universal Router SDK, or direct smart contract calls
- **Build swap flows**: CLI-driven scripts/agents, frontend React hooks, backend Node.js scripts, and Solidity integrations
- **Handle Permit2**: the CLI and SDK do it automatically; the raw path covers signature-based/legacy approvals and permit-data rules by hand
- **Avoid common pitfalls**: null field handling, swap request body format, pre-broadcast validation, and L2 WETH handling — mostly absorbed by the CLI/SDK

## MVP status

The `uni` CLI and `@uniswap/sdk` are an early, **EOA-only** MVP and are **not yet published to npm** — you run them from a checkout of [`Uniswap/uni-cli`](https://github.com/Uniswap/uni-cli). They cover same-chain and cross-chain swaps, quotes, and Permit2 inspection for EOAs. They do **not** cover ERC-4337 smart accounts, direct Universal Router encoding, or standalone WETH-unwrap helpers — use the lower-level methods for those.

## Quick Decision Guide

| Building...                                         | Use This Method             |
| --------------------------------------------------- | --------------------------- |
| A script, agent, bot, or CLI-driven backend         | `uni` CLI                   |
| A frontend / Node app (typed calls, not fetch)      | `@uniswap/sdk` facade       |
| A stack that can't run the CLI or import the SDK    | Raw Trading API             |
| Full control over routing / manual command building | Universal Router SDK        |
| On-chain / Solidity integration                     | Smart contract direct calls |
| ERC-4337 smart account with a bundler               | Raw Trading API + bundler   |

## Integration Methods

### `uni` CLI (recommended for scripts, agents, backends)

Drive swaps with three commands (`quote`, `swap`, `permit2 check`). `uni swap --execute` collapses the whole Trading API flow (`check_approval` -> `quote` -> `swap`) plus approval and Permit2 signing into one command. Preview-by-default: a swap only sends with `--execute` (there is no `--yes`), which is the built-in human-approval gate.

### `@uniswap/sdk` facade (recommended for frontends/apps)

Typed `createUniswapClient(...)` with flat methods (`getQuote`, `checkApproval`, `createSwap`, `executeSwap`, `signTypedData`, `sendTransaction`). Owns request construction so you don't reproduce the permit/routing/body rules. Not yet published to npm.

### Raw Trading API (fallback)

REST API with a 3-step flow: `check_approval` -> `quote` -> `swap`. The layer the CLI and SDK sit on. Use directly when you can't run the CLI or import the SDK, or for cases the EOA-only MVP doesn't cover.

### Universal Router SDK

Direct SDK usage with `@uniswap/universal-router-sdk` for full control over transaction construction, including manual command building with `RoutePlanner`. Not driven by the CLI/SDK.

### Smart Contract Integration

On-chain Solidity contracts calling the Universal Router's `execute()` function with encoded commands for DeFi composability. Not driven by the CLI/SDK.

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
