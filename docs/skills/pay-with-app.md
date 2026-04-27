---
title: Pay With APP
order: 11
---

# Pay With APP (OKX Agent Payments Protocol on X Layer)

Pay HTTP 402 challenges issued by OKX's Agent Payments Protocol (APP)
running on X Layer (chain 196), with the Uniswap Trading API providing
the cross-chain funding rail. Settlement is zero-gas to the payer on X
Layer.

## Invocation

```text
/pay-with-app
```

Or describe the situation naturally:

```text
I got a 402 from an X Layer-backed API and need to pay it
```

## What It Does

This skill helps you:

- **Detect APP / x402 challenges on X Layer** and confirm the network
  resolves to chain 196 before doing anything else
- **Verify the payer wallet's asset balance on X Layer** for the asset
  the merchant requested
- **Fund the wallet** with the requested asset (typically USDT0) by
  routing and bridging via the Uniswap Trading API
- **Sign the EIP-3009 `TransferWithAuthorization`** using the token's
  own EIP-712 domain (taken from the challenge's `extra` field)
- **Submit the X-PAYMENT header** and surface the receipt or rejection
  reason to the user

## When to Use This Skill

Use `pay-with-app` when:

- You receive an HTTP 402 Payment Required response and the challenge's
  `network` resolves to X Layer (chain 196)
- The API or merchant mentions OKX, APP, Agent Payments Protocol,
  Onchain OS, x402 on X Layer, USDT0, or X Layer
- The challenge uses the x402 `exact` scheme (OKX: "Pay Per Use" /
  "Instant Payment")
- You want to pay an OKX-backed merchant from any token on any chain
  the Uniswap Trading API supports

For 402 challenges on chains other than X Layer (Ethereum, Base,
Arbitrum, Tempo, etc.), use [pay-with-any-token](./pay-with-any-token).

## Scope (v1.0.0)

This version supports the x402 `exact` scheme only. Other primitives
(escrow, session, batch) are out of scope for v1.0.0 regardless of
facilitator support.

| Primitive                                                     | Status            |
| ------------------------------------------------------------- | ----------------- |
| Pay Per Use (OKX: Instant Payment), single 402, settle inline | ✅ Supported      |
| Escrow (open, fund, release, dispute)                         | ⏳ v1.x follow-up |
| Session payments                                              | ⏳ v1.x follow-up |
| Pay by Batch (OKX: Batch Payment)                             | ⏳ v1.x follow-up |

## Prerequisites

- A `cast` keystore account or `PRIVATE_KEY` env var (never commit a
  private key)
- `UNISWAP_API_KEY` env var (register at
  [developers.uniswap.org](https://developers.uniswap.org/)). Needed
  only for cross-chain funding.
- `jq` and `cast` (Foundry) installed

## Funding Targets on X Layer

| Asset | Address                                      | Funding                                                                                                                                                                                    |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| USDT0 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | ✅ default (deepest Uniswap v3 liquidity on X Layer)                                                                                                                                       |
| USDG  | `0x4ae46a509F6b1D9056937BA4500cb143933D2dc8` | ✅ direct, or one-hop USDT0 to USDG                                                                                                                                                        |
| USDC  | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` | ❌ no reliable Uniswap v3 routing on X Layer (pools exist but liquidity is thin and Trading API does not consistently return routes); bridge USDC directly from a chain where it is liquid |

## Main Workflow

1. **Parse** the x402 challenge body
2. **Verify** the network resolves to X Layer (chain 196); otherwise
   escalate to `pay-with-any-token`
3. **Check** wallet balance of the requested asset on X Layer
4. **Fund** if insufficient: route and bridge via the Trading API into
   the requested asset (default USDT0)
5. **Sign** the EIP-3009 `TransferWithAuthorization` using the token's
   own EIP-712 domain
6. **Retry** with `X-PAYMENT` header and verify the 200 + receipt

## Confirmation Gates

Before any approval, swap, bridge, or signing step the skill prompts
the user via `AskUserQuestion` with a payment summary (amount, token,
recipient, resource URL, gas estimate). No transaction or signature is
auto-submitted.

## Best Practices

- **Bridge buffer**: apply 0.5% to absorb bridge fees and avoid
  off-by-fee shortfalls
- **Minimum bridge size**: if the shortfall is less than $5, top up to
  $5 to amortize source-chain gas
- **Quote expiry**: re-fetch the Trading API quote if more than ~60
  seconds elapse before broadcast
- **Two-attempt cap on retry**: if the payment is rejected with 402
  twice, surface the facilitator's exact rejection reason rather than
  retrying further

## Related Resources

- [Uniswap Trading Plugin](/plugins/uniswap-trading): parent plugin
- [Pay With Tokens](./pay-with-any-token): sibling skill for HTTP 402
  challenges on chains other than X Layer
- [Swap Integration](./swap-integration): full Trading API swap reference
- [OKX Onchain OS Payment docs](https://web3.okx.com/onchainos/dev-docs/payments/x402-introduction)
- [OKX onchainos-skills repo](https://github.com/okx/onchainos-skills)
- [x402 spec](https://github.com/coinbase/x402)
