---
title: Aggregator Hook Creator
order: 5
---

# Aggregator Hook Creator

Work with Uniswap v4 aggregator hooks: hooks whose pools hold no liquidity of their own and execute every swap on an external venue such as Curve, Fluid, Slipstream, or a Uniswap V2/V3 fork. Uniswap Labs maintains a set of them in [`Uniswap/v4-hooks-public`](https://github.com/Uniswap/v4-hooks-public/tree/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks).

## Invocation

```text
/aggregator-hook-creator
```

Or describe what you want:

```text
"How do I quote an aggregator hook pool?"
"Implement an aggregator hook for a Curve-style pool following BaseAggregatorHook"
"Why does the Curve aggregator hook pass min_dy = 0?"
```

## Disclosures

- **No published audit.** As of the pinned commit, no aggregator-hook audit report is published.
- **License split.** `ProtocolFees.sol` is AGPL-3.0-only, while the repository is MIT. `BaseAggregatorHook` inherits it.
- **Protocol fee.** Subclassing `BaseAggregatorHook` sends the protocol fee to Uniswap's TokenJar, resolved through `poolManager.protocolFeeController()`.

## Three paths

| You are...                                       | Start with                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| An integrator or router using the deployed hooks | `quote` and `pseudoTotalValueLocked`, or the Uniswap API and the Guidestar routing beta                                                        |
| A developer building your own aggregator hook    | The patterns in `BaseAggregatorHook`                                                                                                           |
| A venue that wants to be in Uniswap's own set    | [Get in touch](https://developers.uniswap.org/uniswap-labs-hooks) and the [hook allowlist form](https://developers.uniswap.org/hook-allowlist) |

No public Uniswap source recommends that outside developers subclass `BaseAggregatorHook`, or invites outside pull requests for new venues. The skill treats it as a reference design.

## How it works

1. The router calls `PoolManager.swap`, which calls the hook's `beforeSwap`.
2. The hook takes the swapper's input, calls the external venue, and settles the output to the `PoolManager`.
3. It returns a `BeforeSwapDelta` whose specified side cancels the core swap, so no v4 liquidity is used.

The base enables `beforeSwap`, `beforeSwapReturnDelta`, `beforeInitialize`, and `beforeAddLiquidity`. It never enables `afterSwap`, and adding liquidity always reverts. Slippage is checked by the router, not the hook, and route choice happens off-chain.

## What the skill covers

- Hook permissions, delta signs, and settlement patterns
- Pool registration, venue validation, and callback safety
- Singleton versus per-venue-pool deployment
- Quoting, TVL polling, and API routing for integrators
- The per-venue implementation table and first-byte protocol IDs
- Testing and deployment requirements from the repository

## Related Resources

- [Uniswap Hooks Plugin](/plugins/uniswap-hooks) - Parent plugin
- [v4 Security Foundations](/skills/v4-security-foundations) - Required companion skill
- [v4 Hook Generator](/skills/v4-hook-generator) - For custom-accounting hooks using OpenZeppelin base hooks
- [Aggregator hooks README](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/README.md)
- [Guidestar Routing Beta](https://developers.uniswap.org/docs/changelog/active-notifications/guidestar-routing-beta)
- [v4 Security Framework](https://developers.uniswap.org/docs/protocols/v4/security)
