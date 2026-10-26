---
name: aggregator-hook-creator
description: Work with Uniswap v4 aggregator hooks, which wrap external liquidity (Curve, Fluid, Slipstream, Uniswap V2/V3 forks, LitePSM, Tempo, UniswapX) as v4 pools. Use when the user says "aggregator hook", "external liquidity in v4", "BaseAggregatorHook", "quote an aggregator hook pool", "pseudoTotalValueLocked", "wrap Curve or Slipstream in a v4 hook", or asks how a venue gets routed through the Uniswap API or Guidestar.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(forge:*), Bash(cast:*), Bash(curl:*), WebFetch, Task(subagent_type:Explore)
model: opus
license: MIT
metadata:
  author: uniswap
  version: '2.0.0'
  prerequisites: v4-security-foundations
---

# Aggregator Hooks

An aggregator hook is a v4 hook whose pool holds no liquidity of its own. Every swap is executed against an external venue, and the hook reports the result to the `PoolManager` through `beforeSwapReturnDelta`. Uniswap Labs maintains a set of them in [`Uniswap/v4-hooks-public`](https://github.com/Uniswap/v4-hooks-public/tree/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks) (MIT, with the AGPL-3.0-only files named under Required disclosures). All links in this skill point at commit `2264ac8b023011fdca8fd3422ada172dc10184e0`; check `main` for newer behavior before relying on a detail.

> **Security companion.** Complete `v4-security-foundations` first. An aggregator hook moves user funds through your contract and an external venue, so the delta, external-call, and reentrancy risks apply in full.

## Required disclosures

State these to the user whenever they plan to build, deploy, or fork aggregator-hook code:

1. **No published audit.** As of the pinned commit, no aggregator-hook audit report is published. The repo's audit table and `docs/audits/` cover other hooks only. Do not describe aggregator hooks as audited.
2. **License split.** [`ProtocolFees.sol`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/ProtocolFees.sol) and [`IFeeClassifiedHook`](https://github.com/Uniswap/protocol-fees/blob/656096fd382417c9eadc1f54cb45cdd3dd1bc362/src/interfaces/IFeeClassifiedHook.sol) (from `Uniswap/protocol-fees` at `656096f`) are `AGPL-3.0-only`, while the repo is MIT. `BaseAggregatorHook` inherits both, so a subclass is not MIT-only. Check license obligations before copying or subclassing, and never paste either file into an MIT project.
3. **Protocol fee goes to Uniswap's TokenJar.** A subclass of `BaseAggregatorHook` takes a protocol fee from the unspecified currency and sends it to the `tokenJar`, which the base resolves through `poolManager.protocolFeeController()`. A forked hook inherits that behavior.

## Pick your path

| You are...                                                             | Path                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An integrator or router using Uniswap's deployed aggregator hooks      | Call `quote` and `pseudoTotalValueLocked`, or let the Uniswap API route to them. See [integrator-guide.md](references/integrator-guide.md).                                                                                                 |
| A developer building your own aggregator hook                          | Follow the patterns in `BaseAggregatorHook`. See [base-aggregator-hook.md](references/base-aggregator-hook.md).                                                                                                                             |
| A venue that wants to be part of Uniswap's own set of aggregator hooks | The repo's README points contributors to `CONTRIBUTING.md`, and the aggregator README has an "Adding support for a new protocol" section. No public source says a PR for a new venue will be accepted. Use the "get in touch" form (below). |

No Uniswap source says outside developers should subclass `BaseAggregatorHook`, and none says they must. It is the pattern Uniswap's own hooks follow, so this skill describes it as a reference design, not as a Uniswap recommendation.

For a venue not yet in Uniswap's set, the public contact points are:

- Custom hook work with Uniswap Labs: [get in touch](https://developers.uniswap.org/uniswap-labs-hooks).
- Routing for a hook you deployed yourself: the [hook allowlist form](https://developers.uniswap.org/hook-allowlist). The review checks routing compatibility only; it is not a security audit or an endorsement ([Build with Us](https://developers.uniswap.org/docs/ecosystem/builder-support/build-with-us), [Hook routing](https://developers.uniswap.org/docs/protocols/v4/concepts/hook-routing)).

## How an aggregator hook works

```text
Router -> PoolManager.swap -> hook.beforeSwap
                                |- take swapper's input from PoolManager
                                |- call the external venue
                                |- settle the swapper's output to PoolManager
                                |- take the protocol fee to the TokenJar
                                '- return BeforeSwapDelta (specified cancels core, unspecified = output or input)
```

Facts verified in [`BaseAggregatorHook.sol`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/BaseAggregatorHook.sol):

- **Permissions:** `beforeSwap`, `beforeSwapReturnDelta`, `beforeInitialize`, `beforeAddLiquidity`. There is no `afterSwap`; volume comes from the `HookSwap` event.
- **No v4 liquidity:** `_beforeAddLiquidity` always reverts `LiquidityNotAllowed`. A swap does not touch v4 pool state, so this is a NoOp-style swap by design (see the NoOp section of `v4-security-foundations`).
- **Implementer surface:** override `_conductSwap`, `_rawQuote`, and `pseudoTotalValueLocked`.
- **Delta sign:** the specified-side delta is `int128(-params.amountSpecified)` to cancel the core swap. The unspecified side is `-amountOut` for exact-input and `+amountIn` for exact-output, adjusted by the protocol fee.
- **Slippage is the swapper's job.** The hook does not enforce a minimum output and has no TWAP or on-chain price comparison. `StableSwapAggregator` passes `min_dy = 0` to Curve with the comment that the router checks slippage. Anyone can call `PoolManager.swap` (v4-core `swap` is gated only by `onlyWhenUnlocked`), so a hook author cannot confirm that every path carries a limit; the swapper must set one. The V3 family also never forwards the caller's `sqrtPriceLimitX96`: [`UniswapV3Aggregator._conductSwap`](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/implementations/UniswapV3/UniswapV3Aggregator.sol) passes `MIN_SQRT_RATIO_ADJ` or `MAX_SQRT_RATIO_ADJ` to the external pool.
- **Routing is off-chain.** The hook always executes on its venue. Route choice and splitting happen in the router (Uniswap API or Guidestar), not in the hook.

## Venues Uniswap has implemented

See [implementations.md](references/implementations.md) for the per-venue table, deployment model (singleton vs one hook per venue pool), exact-output and native-ETH support, and the first-byte protocol ID scheme. Short version: Curve StableSwap and StableSwap-NG, Fluid DEX T1 and Lite, Tempo's stablecoin DEX, Uniswap V2 and V3 forks, Slipstream, PancakeSwap V3, MakerDAO LitePSM, and UniswapX orders. Protocol notes: [curve.md](references/protocols/curve.md), [aerodrome.md](references/protocols/aerodrome.md) (Slipstream).

## Workflow when building your own

1. Run `v4-security-foundations` and read the risk sections on external calls and `BeforeSwapDelta`.
2. Choose singleton or per-pool deployment by the venue's pool-to-PoolKey mapping.
3. Subclass `BaseAggregatorHook`, validate the venue in `_beforeInitialize`, and measure real output by balance difference.
4. Mine the hook address (permission bits plus the first-byte ID) and deploy with CREATE2.
5. Test: full unit coverage, forked tests against the real venue (including a USDT pool), and fuzz tests.
6. Get an independent audit before holding user funds. The repo's own rules are in [testing and deployment](references/base-aggregator-hook.md#testing-and-deployment).

If your hook needs custom accounting instead of external venues, use `v4-hook-generator` (OpenZeppelin base hooks) and keep this skill for the external-venue pattern.

## Common errors

| Error                                                                  | Meaning                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `PoolDoesNotExist`, `LiquidityNotAllowed`, `UnspecifiedAmountExceeded` | Base errors from `IAggregatorHook`. Adding v4 liquidity always reverts.        |
| `ExactOutputNotSupported`                                              | The venue cannot quote exact-output (StableSwap). Request exact-input.         |
| `NativeCurrencyNotSupported`                                           | V2/V3-family hooks reject native ETH. Use the wrapped token.                   |
| `UnauthorizedCallback`, `CallbackOutsideActiveSwap`                    | A V3-style swap callback came from the wrong sender or outside an active swap. |
| `PairAlreadyHasCanonicalPool`                                          | A second v4 pool was initialized for a venue pair that allows only one.        |

## References

- [Aggregator hooks source](https://github.com/Uniswap/v4-hooks-public/tree/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks) and its [README](https://github.com/Uniswap/v4-hooks-public/blob/2264ac8b023011fdca8fd3422ada172dc10184e0/src/aggregator-hooks/README.md)
- [Uniswap Labs hooks overview](https://developers.uniswap.org/docs/protocols/uniswap-labs-hooks)
- [v4 hooks concepts](https://developers.uniswap.org/docs/protocols/v4/concepts/hooks)
- [v4 security framework](https://developers.uniswap.org/docs/protocols/v4/security)
- [Aggregator Hooks are Now Live](https://blog.uniswap.org/aggregator-hooks-are-now-live) (launch announcement; this skill does not rely on its figures)
