# Execution model

How uniswap-trading-tools skills execute trades. The rule: skills never build swap, quote, approval, or signing logic themselves. They delegate.

## Always use the Trading API path

All execution goes through the Uniswap Trading API path documented in the `swap-integration` skill (uniswap-trading): `check_approval` then `quote` then `swap`, then sign and broadcast via viem. Pass the target chain id and that chain's router / token addresses from the selected target-chain template.

Why the Trading API and not raw on-chain calls: target-chain templates may have RPC, signing, or raw-transaction constraints. Skills always execute through the Trading API / router path regardless of chain, so router-compatible constraints should not block them.

## ETH / WETH normalization

Most Uniswap pools hold WETH, so a pool `Swap` log always references WETH. A native-ETH leg of a swap is a router wrap/unwrap step, not an ERC-20 transfer event. Skills must therefore:

- Treat ETH and WETH as **equivalent** for allowlist checks and asset matching. A leader buying ETH and a copy of that buy denominated in WETH are the same asset.
- Leave the execution form (native ETH vs WETH) for each swap to the `swap-integration` Trading API path. Trading API takes `0x0000000000000000000000000000000000000000` as the native token address and will perform WRAP / UNWRAP as needed. Skills do not decide whether a leg settles in native ETH or WETH.

This is the rule the copy-trade skill cites when matching a leader's ETH activity against a WETH pool log.

## Funding

Skills do not own funding. The selected target-chain template describes how the operator funds the agent wallet and whether any bridge, on-ramp, or auto-funding path exists. On insufficient token balance or insufficient gas, skills **skip the action and report it**; they never attempt to auto-fund, top up, or move funds onto the chain unless that behavior is explicitly provided outside the skill.

## Equity market hours

RWAs may have off-hours liquidity limits, so skills should know whether equity markets are open. The selected target-chain template provides the authoritative source or fallback for regular-hours windows, timezone, exchange calendar, and holiday set.

## Execution mode

Every skill exposes an execution mode chosen by the operator who runs the agent:

| Mode                | Behavior                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `confirm` (default) | Ask the user to approve every transaction before broadcast. Reuses the swap-integration spend gate. |
| `autonomous`        | Execute without per-transaction prompts, only within guardrails.                                    |

Autonomous mode requires all of: a spend cap (per run and per period), a token allowlist, a dry-run first, and a kill switch. Default to `confirm`. This mirrors the session-key / spend-permission model used by agent wallets.

## Operator guardrail collection

Before a skill runs with real funds, it must read configured guardrails and ask the operator for any missing spend caps. Use `AskUserQuestion` when available, or collect the same values through conversation.

Every skill needs:

- **Per-run spend cap**: the maximum notional the skill may spend in one invocation.
- **Per-period spend cap**: the maximum notional the skill may spend across the configured cadence period.

Copy-trade also needs:

- **Per-mirror spend cap**: the maximum notional for any single mirrored leader intent.

Caps must include the funding token or denomination used for comparison. If a required cap is missing, do not enter `autonomous` mode. In `confirm` mode, still ask for the caps during setup; if the operator declines to set them, rely on the per-transaction confirmation gate and report that autonomous mode remains unavailable.

## Data and pricing

All execution-related data comes from Uniswap, never from venue-specific APIs:

- **Prices and quotes**: use the Uniswap Trading API `/quote` (via `swap-integration`) or, for on-chain reads, `V4Quoter` and `StateView` (via `v4-sdk-integration`). Uniswap quotes are the source of truth for sizing, valuation, and price conditions.
- **Token resolution**: resolve symbols to addresses from the selected target-chain template and its token source. Do not maintain a local registry.
- **Discovery and market data helpers**: reuse the `swap-planner` data-provider patterns (uniswap-driver) when broader token data is needed.

Do not call venue-specific APIs or non-Uniswap price feeds for execution data. If a strategy condition needs market data Uniswap does not expose (for example historical OHLC candles), treat that data source as unavailable rather than introducing an external dependency.

## Restrictions and Disclaimers

Some real world assets (RWAs) may enforce transfer restrictions at the token level, so a swap can revert at transfer time even when the router accepts it. Skills must:

1. Handle transfer-restriction reverts gracefully and report them.
2. Not assume a pool-level or router-level allowlist exists.
3. Surface the disclaimers in the repo root `DISCLAIMER.md`.
4. Respect equity market hours; some RWAs may have off-hours liquidity limits.
