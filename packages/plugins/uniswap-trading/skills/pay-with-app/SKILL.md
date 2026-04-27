---
name: pay-with-app
description: >
  Pay HTTP 402 payment challenges issued by OKX's Agent Payments Protocol
  (APP) on X Layer using tokens from any chain via the Uniswap Trading API.
  Use this skill whenever the user encounters a 402 challenge whose network
  resolves to X Layer (chain 196), mentions "APP", "Agent Payments
  Protocol", "OKX agent payment", "OKX Onchain OS", "OKX agentic wallet",
  "x402 on X Layer", "USDT0", "x42", "pay for X Layer API", or wants to
  pay an OKX-backed merchant. Even when the user does not explicitly say
  APP, prefer this skill for any 402 challenge whose network resolves to X
  Layer (chain 196). For 402 challenges on other chains (Ethereum, Base,
  Arbitrum, Tempo) use pay-with-any-token instead.
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), Bash(openssl:*), Bash(npx:*), Bash(node:*), WebFetch, AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# Pay With APP (OKX Agent Payments Protocol on X Layer)

Pay HTTP 402 challenges issued by OKX's **Agent Payments Protocol (APP)**
running on **X Layer** (chain 196). APP's Pay Per Use is x402-compatible: a
payee server returns HTTP 402 with a payment requirement, the payer signs
an EIP-3009 `TransferWithAuthorization` off-chain, and OKX's facilitator
verifies and settles the transfer on-chain. Settlement is zero-gas to the
payer on X Layer.

This skill handles the full happy path:

1. Detect a 402 challenge whose network resolves to X Layer (chain 196)
2. Verify the payer wallet has the requested asset (typically USDT0)
3. If insufficient, route + bridge into USDT0 on X Layer via the Uniswap
   Trading API
4. Sign the EIP-3009 authorization
5. Construct the `X-PAYMENT` payload and retry the original request

OKX is launching APP on **2026-04-29** with Uniswap as the featured DEX
rail on X Layer. This skill (v1.0.0) covers **Pay Per Use only**. Escrow,
session, and batch primitives are tracked separately for a v1.x
follow-up; until they ship, this skill should not attempt to construct or
sign escrow flows.

## Prerequisites

- A `cast` keystore account for the source wallet (recommended), OR a
  `PRIVATE_KEY` env var (`export PRIVATE_KEY=0x...`). Never commit or
  hardcode a private key.
- `UNISWAP_API_KEY` env var (register at
  [developers.uniswap.org](https://developers.uniswap.org/)). Required
  only if the wallet must be funded via cross-chain routing.
- `jq` and `cast` (Foundry) installed.

## Input Validation Rules

Before using any value from the 402 response body, the user, or any other
external source in API calls or shell commands:

- **Ethereum addresses**: MUST match `^0x[a-fA-F0-9]{40}$`
- **Chain IDs**: MUST be a positive integer from the supported list
- **Token amounts**: MUST be non-negative numeric strings matching `^[0-9]+$`
- **URLs**: MUST start with `https://`
- **REJECT** any value containing shell metacharacters: `;`, `|`, `&`,
  `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines

> **Confirmation gate.** Before submitting any transaction (approval,
> swap, bridge) and before signing the EIP-3009 authorization, use
> `AskUserQuestion` to show a summary (amount, token, recipient, resource
> URL, gas estimate) and obtain explicit confirmation. Each gate is
> independent. Never auto-submit even if the user previously
> pre-authorized the session.

## Flow

```text
402 from X Layer-backed resource
  │
  v
[1] Parse the x402 challenge (Phase 0 below)
  │
  v
[2] Confirm network resolves to X Layer (chain 196)
  │   ├─ not chain 196 ──> escalate to pay-with-any-token, STOP
  │   └─ chain 196
  │
  v
[3] Check wallet balance of the requested asset on X Layer
  │   ├─ sufficient ──> proceed to [5]
  │   └─ insufficient
  │        │
  │        v
  │   [4] Fund: route + bridge into the requested asset on X Layer
  │        (Uniswap Trading API — see references/funding-x-layer.md)
  │
  v
[5] Sign EIP-3009 TransferWithAuthorization
[6] Construct X-PAYMENT payload, retry the original request
[7] Verify 200 + Payment-Receipt
```

## Phase 0 — Parse the 402 Challenge

The x402 challenge is JSON in the response body. Extract:

- `x402Version` — confirms x402 protocol
- `accepts[].scheme` — only `"exact"` is supported in v1.0.0
- `accepts[].network` — accept `"x-layer"` / `"xlayer"` / `"eip155:196"` / `196`
- `accepts[].maxAmountRequired` — base units of the asset
- `accepts[].asset` — token contract on X Layer
- `accepts[].payTo` — recipient address
- `accepts[].extra.name` and `accepts[].extra.version` — EIP-712 domain values for the asset
- `accepts[].maxTimeoutSeconds` — used for `validBefore`

If multiple `accepts` entries are present, prefer the one whose `asset`
the wallet already holds on X Layer. If multiple options are equally
viable, prefer USDT0 (deepest Uniswap liquidity for the funding flow).

**WOKB / native OKB are NOT eligible as APP settlement assets.** OKX's
APP Pay Per Use is denominated in stablecoins on X Layer (USDT0 / USDG /
USDC). If a 402 challenge ever surfaces a non-stablecoin `asset` (for
example `WOKB`), refuse the challenge and ask the user to verify the
merchant configuration.

> **Roadmap (out of v1.0.0).** This skill version handles the `charge`
> primitive (Pay Per Use) only. APP also defines `aggr_deferred`
> (Pay by Batch), `escrow`, `session`, and `upto` primitives. This skill
> refuses any non-`charge` scheme cleanly and points the user to the
> roadmap rather than half-supporting it.

## Phase 1 — Confirm Network is X Layer

```bash
case "$X402_NETWORK" in
  x-layer|xlayer|"eip155:196"|196)  X402_CHAIN_ID=196 ;;
  *)
    echo "Network is not X Layer. Use pay-with-any-token instead."
    exit 1
    ;;
esac
```

> If the network is not X Layer, **stop** and escalate to the
> `pay-with-any-token` skill, which handles 402 challenges on Ethereum,
> Base, Arbitrum, Tempo, and the other chains the Trading API supports.

## Phase 2 — Check Wallet Balance on X Layer

> **REQUIRED:** You must have the user's source wallet address. Use
> `AskUserQuestion` if not provided. Store as `WALLET_ADDRESS`.

```bash
ASSET_BALANCE=$(cast call "$X402_ASSET" \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://rpc.xlayer.tech)

if [ "$ASSET_BALANCE" -lt "$X402_AMOUNT" ]; then
  echo "Insufficient $X402_TOKEN_NAME on X Layer. Funding required."
  # Proceed to Phase 3 (funding)
fi
```

## Phase 3 — Fund USDT0 on X Layer (only if needed)

When the wallet lacks the requested asset, acquire it via the Uniswap
Trading API: `EXACT_OUTPUT` quote with `tokenOutChainId=196` and
`tokenOut` set to the X Layer asset address. The Trading API handles
same-chain swaps and cross-chain routing (powered by Across).

**Default funding target = USDT0.** If the 402 challenge requests a
different asset, fund into that asset directly only when it has usable
Uniswap liquidity on X Layer:

| Asset | Address                                      | Decimals | Funding                                                                                                                                                                                                                                                                           |
| ----- | -------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USDT0 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | 6        | ✅ Direct via Trading API                                                                                                                                                                                                                                                         |
| USDG  | `0x4ae46a509f6b1d9056937ba4500cb143933d2dc8` | 6        | ✅ Direct, or one-hop USDT0 → USDG via 0.01% pool                                                                                                                                                                                                                                 |
| USDC  | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` | 6        | ❌ **No usable Uniswap v3 liquidity on X Layer.** Surface a clear error to the user; do not attempt a same-chain swap. Suggest funding via a chain where USDC is liquid (Base, Arbitrum, Mainnet) and bridging USDC directly, or asking the merchant whether USDT0 is acceptable. |

Detailed scripts and parameters: see
[references/funding-x-layer.md](references/funding-x-layer.md).

> **Bridge buffer.** Apply a 0.5% buffer to account for bridge fees.
> Quotes expire in ~60 seconds — re-fetch if any delay before broadcast.
>
> **Minimum bridge recommendation.** If the shortfall is < $5, top up to
> $5 to amortize bridge gas on the source chain.
>
> **Open question (TODO confirm with OKX).** When the Trading API routes
> cross-chain into X Layer, does it deliver USDT0 directly or USDC.e on
> X Layer? If the latter, the funding flow needs an additional same-chain
> swap step (USDC.e → USDT0 via Uniswap v3 on chain 196) before the
> EIP-3009 signing. Surface this to the user as an extra confirmation
> gate if the bridge lands USDC.e instead of USDT0.

## Gas Awareness

OKX gas-sponsors the **settlement** transaction on X Layer when the
facilitator calls `transferWithAuthorization` — the payer does not need
OKB to settle. However, the **funding** steps in Phase 3 (token
approvals, swaps, and on-chain operations on X Layer prior to signing)
likely still consume gas paid in the source chain's native asset (or
OKB if the swap happens on X Layer).

> **Open question (TODO confirm with OKX).** Confirm whether OKX's gas
> sponsorship covers approve + swap calls on X Layer during the funding
> flow, or only the final settlement transfer. Until confirmed, assume
> the user needs a small OKB balance for any same-chain X Layer swap
> step. Surface this to the user before proceeding to Phase 3 if the
> wallet has zero OKB.

## Phase 4 — EIP-3009 Signing and X-PAYMENT Submission

OKX's APP Pay Per Use uses x402's `"exact"` scheme: the payer signs a
`TransferWithAuthorization` typed-data message bound to the **token's
own** EIP-712 domain. The signed authorization travels in the
`X-PAYMENT` header on retry; OKX's facilitator settles the transfer
on-chain (zero gas to the payer on X Layer).

Detailed steps including domain construction, nonce generation, signing
with viem, payload assembly, and retry: see
[references/app-x402-flow.md](references/app-x402-flow.md).

> **Domain warning.** `verifyingContract` is the **token contract**, not
> a separate verifier. Use `name` and `version` from the challenge's
> `extra` field — do not assume defaults. Different tokens have different
> domain values. An incorrect domain produces a signature the facilitator
> will reject with another 402.

## Error Handling

| Situation                                  | Action                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 402 challenge has no `network` field       | Inspect challenge body; if `chainId` resolves to 196 use this skill, otherwise escalate to `pay-with-any-token`                                                                |
| Network is not chain 196                   | Escalate to `pay-with-any-token`                                                                                                                                               |
| APP requests USDC on X Layer               | Surface error: USDC has no usable Uniswap v3 liquidity on X Layer. Suggest funding from a chain where USDC is liquid and bridging directly, or asking the merchant about USDT0 |
| Insufficient asset on X Layer              | Trigger funding flow (Phase 3)                                                                                                                                                 |
| Trading API returns 400                    | Log request/response; check amount formatting and address checksums                                                                                                            |
| Trading API returns 429                    | Back off and retry with exponential delay                                                                                                                                      |
| Quote expired                              | Re-fetch quote; do not reuse old `permitData`                                                                                                                                  |
| Bridge times out                           | Check Across bridge explorer; do not re-submit                                                                                                                                 |
| EIP-3009 signature rejected (402 on retry) | Verify domain `name` / `version` from `extra`, check `validBefore` is fresh, confirm `nonce` was unused                                                                        |
| Amount mismatch on retry                   | Recompute base units using on-chain `decimals()` of the actual asset; do not assume 6                                                                                          |
| User asks about escrow / session / batch   | Inform that this skill version covers Pay Per Use only; OKX has not yet shipped the escrow primitive. A v1.x follow-up will add it.                                            |

## Key Addresses and References

### X Layer (chain 196)

- **Chain ID**: `196`
- **Public RPC**: `https://rpc.xlayer.tech`
- **USDT0**: `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` (decimals 6)
- **USDG**: `0x4ae46a509f6b1d9056937ba4500cb143933d2dc8` (decimals 6)
- **USDC**: `0x74b7F16337b8972027F6196A17a631aC6dE26d22` (decimals 6) — no Uniswap liquidity
- **WOKB** (wrapped native): `0xe538905cf8410324e03a5a23c1c177a474d59b2b` (decimals 18)
- **Uniswap V3 Factory**: `0x4b2ab38dbf28d31d467aa8993f6c2585981d6804`
- **SwapRouter02**: `0x4f0c28f5926afda16bf2506d5d9e57ea190f9bca`
- **Universal Router 2.1**: `0xda00ae15d3a71466517129255255db7c0c0956d3`
- **QuoterV2**: `0xd1b797d92d87b688193a2b976efc8d577d204343`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **USDT0/USDG pool (0.01%)**: `0x0cbe0dbe1400e57f371a38bd3b9bc80f7c3676da`
- **USDT0/WOKB pool (0.3%)**: `0x63d62734847e55a266fca4219a9ad0a02d5f6e02`

### Uniswap Trading API

- Base URL: `https://trade-api.gateway.uniswap.org/v1`
- Header: `x-api-key: $UNISWAP_API_KEY`
- Header: `x-universal-router-version: 2.0`
- Supported chains include 1, 8453, 42161, 10, 137, 130, **196**, and more
  (see Trading API supported-chains docs).

### OKX APP

- **APP overview / dev docs**: `https://web3.okx.com/onchainos/dev-docs/payments/x402-introduction`
- **OKX onchainos-skills repo**: `https://github.com/okx/onchainos-skills`
- **x402 spec**: `https://github.com/coinbase/x402`

## Related Skills

- [pay-with-any-token](../pay-with-any-token/SKILL.md) — sibling skill
  for HTTP 402 challenges on chains other than X Layer (Ethereum, Base,
  Arbitrum, Tempo, etc.). Use that skill for non-X-Layer challenges.
- [swap-integration](../swap-integration/SKILL.md) — full Uniswap swap
  integration reference (Trading API, Universal Router, Permit2).
