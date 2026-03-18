---
title: Pay With Tokens
order: 10
---

# Pay With Tokens

Use the Tempo CLI to call paid APIs with automatic 402 payment handling. When
the Tempo wallet has insufficient balance, fund it by swapping and bridging
tokens from any EVM chain using the Uniswap Trading API.

## Invocation

```text
/pay-with-any-token
```

Or describe your situation naturally:

```text
I got a 402 from an API and need to pay using my tokens
```

## What It Does

This skill helps you:

- **Call paid APIs**: Use the Tempo CLI (`tempo request`) to discover and call
  MPP-enabled services with automatic payment handling
- **Fund your Tempo wallet**: When the wallet lacks funds, swap and bridge
  tokens from any EVM chain to the Tempo wallet using the Uniswap Trading API
- **Handle x402 payments**: Sign EIP-3009 authorizations for x402 protocol
  challenges (separate from the Tempo CLI flow)
- **Validate inputs**: Reject malicious 402 challenges with shell injection
  patterns before processing

## When to Use This Skill

Use `pay-with-any-token` when:

- You receive an **HTTP 402 Payment Required** response from an API
- The API uses **MPP (Machine Payments Protocol)** with a Tempo payment method
- You want to **discover and call paid APIs** using the Tempo CLI
- You want to pay with tokens you already hold — the skill handles swap +
  bridge automatically
- You encounter an **x402** payment challenge

This skill is **not** needed for regular token swaps. Use the
[swap-integration](/skills/swap-integration) skill for general-purpose swaps.

## Protocol Support

| Protocol | Version | Handler        |
| -------- | ------- | -------------- |
| MPP      | v1      | Tempo CLI      |
| x402     | v1      | Manual signing |

## Prerequisites

- **Tempo CLI**: Installed via `curl -fsSL https://tempo.xyz/install` and
  logged in with `tempo wallet login`
- **Uniswap API key**: Register at
  [developers.uniswap.org](https://developers.uniswap.org/) and set as
  `UNISWAP_API_KEY` (only needed for wallet funding)
- **Funded wallet**: ERC-20 tokens on any Uniswap-supported chain (for funding)
- **jq**: Command-line JSON processor (`brew install jq` or `apt install jq`)

## Supported Source Chains (for wallet funding)

| Chain        | Chain ID |
| ------------ | -------- |
| Ethereum     | 1        |
| Base         | 8453     |
| Arbitrum One | 42161    |
| Optimism     | 10       |
| Polygon      | 137      |
| Unichain     | 130      |

Payment destination is always the **Tempo network** (chain ID `4217`).

## Main Workflow

1. **Setup** — Install Tempo CLI, login, verify wallet
2. **Discover** — Find paid services via `tempo wallet -t services`
3. **Request** — Call the API with `tempo request`
4. **402 triggered** — Tempo CLI detects insufficient balance
5. **Fund** — Swap source tokens to USDC, bridge to Tempo wallet address
6. **Retry** — `tempo request` retries with funded wallet
7. **Verify** — Confirm 200 response and service result

## Related Resources

- [Uniswap Trading Plugin](/plugins/uniswap-trading) - Parent plugin
- [Swap Integration](/skills/swap-integration) - Full Trading API swap reference
- [Machine Payments Protocol](https://mpp.dev) - MPP specification and SDK
- [Tempo CLI](https://tempo.xyz) - Tempo CLI installation and usage
- [Tempo Documentation](https://mainnet.docs.tempo.xyz) - Tempo network docs
- [Uniswap Trading API Docs](https://api-docs.uniswap.org/introduction) - Official API documentation
