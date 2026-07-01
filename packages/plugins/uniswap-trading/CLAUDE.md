# CLAUDE.md - uniswap-trading Plugin

## Overview

This plugin provides comprehensive guidance for integrating Uniswap swaps into frontends, backends, and smart contracts. It supports the Trading API, Universal Router SDK, and direct smart contract integration.

## Plugin Components

### Skills (./skills/)

- **swap-integration**: Comprehensive guide for integrating Uniswap swaps. Leads with the `uni` CLI (scripts/agents/backends) and the `@uniswap/sdk` facade (frontends/apps) — both wrap the Trading API and absorb the approval/Permit2/routing gotchas — then falls back to the raw Trading API, Universal Router SDK, and direct smart contract calls for cases the EOA-only MVP doesn't cover. Covers CLI-driven scripts, frontend hooks, backend scripts, Solidity integrations, Permit2 patterns, ERC-4337 smart account integration, L2 WETH handling, rate limiting, and troubleshooting.
- **pay-with-any-token**: Pay HTTP 402 Payment Required challenges (MPP and x402) by swapping or bridging tokens via the Uniswap Trading API. Supports WWW-Authenticate header-based and JSON body-based MPP challenges, cross-chain bridging to Tempo, and automatic stablecoin swaps.
- **v4-sdk-integration**: App-layer SDK guide for building swap and liquidity experiences directly with the Uniswap v4 SDK. Covers V4Planner swap construction, Quoter callStatic, StateView pool reads, PositionManager multicall operations, and Permit2 approval flow.
- **lp-integration**: Integrate liquidity provisioning via the Uniswap LP API (a transaction-building REST service). Covers the create/create_classic/increase/decrease/claim_fees/check_approval/pool_info endpoints for v2/v3/v4, the approval and EIP-712 permit flow, response-field gotchas, and a viem create-position example.

### Agents (./agents/)

- **swap-integration-expert**: Expert agent for complex Uniswap swap integration questions, Trading API debugging, Universal Router encoding, Permit2 patterns, ERC-4337 smart account integration, and L2-specific patterns.

## File Structure

```text
uniswap-trading/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── swap-integration-expert.md
├── skills/
│   ├── swap-integration/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── advanced-patterns.md
│   ├── pay-with-any-token/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── trading-api-flows.md
│   │       └── credential-construction.md
│   ├── v4-sdk-integration/
│   │   └── SKILL.md
│   └── lp-integration/
│       ├── SKILL.md
│       └── references/
│           └── advanced-patterns.md
├── project.json
├── package.json
├── CLAUDE.md
└── README.md
```

## Integration Methods

> The `uni` CLI and `@uniswap/sdk` are an early, EOA-only MVP, not yet published to npm — run them from a checkout of `Uniswap/uni-cli`. They cover EOA same-chain/cross-chain swaps, quotes, and Permit2; they do not cover ERC-4337 smart accounts, direct Universal Router encoding, or standalone WETH-unwrap. Use methods 3-5 for those.

1. **`uni` CLI** (recommended for scripts, agents, backends)

   - Three commands: `quote`, `swap`, `permit2 check`
   - `uni swap --execute` = the Trading API `check_approval -> quote -> swap` flow plus approval/Permit2, in one command
   - Preview-by-default; `--execute` is the only send path (no `--yes`) — the human-approval gate

2. **`@uniswap/sdk` facade** (recommended for frontends/apps)

   - `createUniswapClient(...)` with flat methods (`getQuote`, `checkApproval`, `createSwap`, `executeSwap`, `signTypedData`, `sendTransaction`)
   - Owns request construction — absorbs the permit/routing/body rules
   - Not yet published to npm

3. **Raw Trading API** (fallback)

   - REST API at `https://trade-api.gateway.uniswap.org/v1`
   - Handles routing optimization automatically
   - 3-step flow: check_approval -> quote -> swap
   - The layer the CLI/SDK sit on; use directly when they aren't available or the MVP doesn't cover the case

4. **Universal Router SDK**

   - Direct SDK usage with `@uniswap/universal-router-sdk`
   - Full control over transaction construction
   - Command-based architecture

5. **Direct Smart Contract Integration**
   - Solidity contracts calling Universal Router
   - For on-chain integrations and DeFi composability

## Supported Chains

See the [official supported chains list](https://api-docs.uniswap.org/guides/supported_chains#supported-chains-for-swapping) for the current set of chains supported by the Trading API.

## Related Plugins

- **uniswap-viem**: Foundational EVM blockchain integration using viem/wagmi (prerequisite knowledge)
- **uniswap-hooks**: Uniswap v4 hook development with security-first approach

## Key References

- Trading API: `https://trade-api.gateway.uniswap.org/v1`
- Universal Router: `github.com/Uniswap/universal-router`
- SDKs: `@uniswap/universal-router-sdk`, `@uniswap/v3-sdk`, `@uniswap/sdk-core`
- Permit2: Token approval infrastructure
