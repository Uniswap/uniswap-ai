---
title: Uniswap Trading Tools
order: 8
---

# Uniswap Trading Tools

Automated trading tools (dollar-cost averaging, weighted index baskets, and copy-trading) for any chain where Uniswap is deployed. The skills are asset-agnostic: they work the same for crypto-native tokens and tokenized real-world assets (RWAs). Each skill is a thin strategy layer that delegates all execution to the uniswap-trading skills.

## Installation

```bash
/plugin install uniswap-trading-tools
```

## Skills

| Skill                              | Description                                                           | Invocation    |
| ---------------------------------- | --------------------------------------------------------------------- | ------------- |
| [DCA Bot](../skills/dca-bot)       | Buy a fixed amount into a token on a schedule, optionally gated       | `/dca-bot`    |
| [Index Bot](../skills/index-bot)   | Build a weighted basket, buy it in one pass, and rebalance on cadence | `/index-bot`  |
| [Copy Trade](../skills/copy-trade) | Mirror a target wallet's trades within guardrails                     | `/copy-trade` |

## Execution

The skills never build quote, approval, swap, or signing logic themselves. Every trade is delegated to the [Swap Integration](../skills/swap-integration) skill via the Uniswap Trading API path (`check_approval`, then `quote`, then `swap`, then sign and broadcast). Signing, clients, and receipt waiting come from the [Viem Integration](../skills/viem-integration) skill. Index Bot optionally uses v4 LP tooling through the v4 SDK integration.

Each skill exposes an execution mode chosen by the operator:

| Mode                | Behavior                                                            |
| ------------------- | ------------------------------------------------------------------- |
| `confirm` (default) | Approve every transaction before broadcast, reusing the spend gate. |
| `autonomous`        | Execute without per-transaction prompts, only within guardrails.    |

Autonomous mode requires a spend cap, a token allowlist, a dry-run first, and a kill switch.

## Target-chain templates

The skills target a configurable chain through a selected template. A target-chain template provides implementation-specific values: `chainId`, chain name, RPC / read path, deployed Uniswap contracts, tradable token source, funding constraints, market-data availability, and transfer-restriction caveats.

The reference template is Robinhood Chain (chainId `4663`, an Arbitrum Orbit L2 with ETH gas); see `references/robinhood-chain.md`. The skills always execute through the Trading API / router path regardless of the selected template.

## Restrictions and Disclaimers

Token gating is chain- and token-specific and may be enforced at the token level, so a swap can revert at transfer time even when the router accepts it. Skills handle transfer-restriction reverts gracefully, respect template-provided market-hours guidance, and surface the repo root `DISCLAIMER.md`.

## State and Scheduling

The skills do not embed a scheduler. The host agent's scheduler invokes each skill on a cadence, and every invocation is a single, self-contained run. Each bot keeps a small JSON state file so runs are idempotent (no double buys) and copy-trade keeps a deterministic record of what it has mirrored.

## Related

- [Plugins Overview](/plugins/) - All available plugins
- [Skills](/skills/) - All available skills
- [Uniswap Interface](https://app.uniswap.org)
- [Uniswap Docs](https://docs.uniswap.org)
