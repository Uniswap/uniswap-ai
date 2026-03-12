---
title: Pay With Tokens
order: 10
---

# Pay With Tokens

Fulfill HTTP 402 Payment Required challenges by acquiring and routing tokens
using the Uniswap Trading API. Supports the Machine Payments Protocol (MPP)
with the Tempo payment method.

## Invocation

```text
/pay-with-tokens
```

Or describe your situation naturally:

```text
I got a 402 from an API and need to pay using my tokens
```

## What It Does

This skill helps you:

- **Parse 402 challenges**: Extract payment parameters from MPP/Tempo challenge
  bodies
- **Plan the payment path**: Determine whether to swap, bridge, or both based on
  what tokens you hold and where
- **Execute swaps**: Use the Uniswap Trading API with exact-output quotes to
  acquire the precise token amount required
- **Bridge cross-chain**: Guide you through bridging USDC-e from Base or
  Ethereum to the Tempo network
- **Submit payment credentials**: Construct and submit MPP payment credentials to
  fulfill the challenge

## When to Use This Skill

Use `pay-with-tokens` when:

- You receive an **HTTP 402 Payment Required** response from an API
- The API uses **MPP (Machine Payments Protocol)** with a Tempo payment method
- You want to pay with tokens you already hold — the skill handles swap + bridge automatically

This skill is **not** needed for regular token swaps. Use the [swap-integration](/skills/swap-integration) skill for general-purpose swaps.

## Protocol Support

| Protocol | Version | Status      |
| -------- | ------- | ----------- |
| MPP      | v1      | Supported   |
| x402     | -       | Coming soon |

> **Note on x402**: The [x402 protocol](https://x402.org) is an alternative HTTP 402 payment standard. Support is planned in a future release. If your API uses x402 headers, this skill will not handle them yet.

## Prerequisites

- **Uniswap API key**: Register at [developers.uniswap.org](https://developers.uniswap.org/) and set as `UNISWAP_API_KEY` in your environment
- **Funded wallet**: ERC-20 tokens on any Uniswap-supported chain (Ethereum, Base, Arbitrum, Optimism, Polygon, Unichain)
- **Wallet address**: Your wallet address (the skill will ask if not provided)
- **jq**: Command-line JSON processor (install via `brew install jq` or `apt install jq`) — used by the skill to safely construct API requests

## Supported Source Chains

The Uniswap Trading API supports the following source chains for swaps:

| Chain        | Chain ID |
| ------------ | -------- |
| Ethereum     | 1        |
| Base         | 8453     |
| Arbitrum One | 42161    |
| Optimism     | 10       |
| Polygon      | 137      |
| Unichain     | 130      |

Payment destination is always the **Tempo network** (see [Tempo documentation](https://docs.tempo.finance) for chain ID).

## Main Workflow

1. **Detect** — Identify the 402 challenge and parse the payment method
   (MPP/Tempo)
2. **Balance check** — Identify available tokens across chains
3. **Path selection** — Choose the optimal route (on-chain swap, cross-chain
   bridge, or direct payment)
4. **Acquire** — Swap to the bridge asset (USDC-e) using the Trading API with
   `EXACT_OUTPUT`
5. **Bridge** — Move assets to the Tempo network if needed
6. **Pay** — Swap to the required TIP-20 token on Tempo and submit the MPP
   credential
7. **Verify** — Confirm the 200 response and receipt

## Related Resources

- [Uniswap Trading Plugin](/plugins/uniswap-trading) - Parent plugin
- [Swap Integration](/skills/swap-integration) - Full Trading API swap reference
- [Machine Payments Protocol](https://mpp.dev) - MPP specification and SDK
- [Tempo Documentation](https://docs.tempo.finance) - Tempo network bridge and chain info
- [Uniswap Trading API Docs](https://api-docs.uniswap.org/introduction) - Official API documentation
- [Permit2 Documentation](https://docs.uniswap.org/contracts/permit2/overview) - Token approval signing
