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

## Protocol Support

| Protocol | Version | Status      |
| -------- | ------- | ----------- |
| MPP      | v1      | Supported   |
| x402     | -       | Coming soon |

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
- [Machine Payments Protocol](https://mpp.dev) - MPP specification
- [Uniswap API Docs](https://api-docs.uniswap.org/introduction) - Official API
  documentation
