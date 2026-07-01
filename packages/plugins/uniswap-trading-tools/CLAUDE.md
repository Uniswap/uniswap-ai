# CLAUDE.md - uniswap-trading-tools Plugin

## Overview

uniswap-trading-tools provides AI skills for automated trading tools on Uniswap. The skills are asset-agnostic: they work identically for crypto-native tokens and tokenized real-world assets (RWAs). Chain-agnostic: the operator targets any chain where Uniswap is deployed and the Trading API has coverage by selecting a target-chain template. Robinhood Chain (chainId 4663) is the reference template, not a required assumption for generic skill behavior.

The plugin ships three strategy skills (added incrementally across a 3-PR stack):

- **dca-bot**: dollar-cost-average a fixed amount into a token on a schedule, optionally only when a condition holds.
- **index-bot**: build a weighted basket of assets, buy it in one pass, and rebalance on a cadence.
- **copy-trade**: watch a target wallet and mirror its trades, bounded by guardrails.

## Design principle: delegate, do not reimplement

These skills are a thin strategy layer. They MUST NOT reimplement swap execution, quoting, approvals, or signing. They delegate to existing uniswap-ai skills and reuse Uniswap infrastructure:

| Concern                           | Delegated to         | Plugin          |
| --------------------------------- | -------------------- | --------------- |
| Swap execution (Trading API path) | `swap-integration`   | uniswap-trading |
| Liquidity / LP execution          | `v4-sdk-integration` | uniswap-trading |
| Accounts, signing, event watching | `viem-integration`   | uniswap-viem    |

Each skill declares these as `prerequisites` in its frontmatter. The only net-new logic is strategy (cadence, weights, mirroring), the shared scheduler/state pattern, guardrails, and RWA data wiring.

## Execution model

Execution always goes through the Uniswap Trading API path of `swap-integration`. Target-chain templates may document RPC, indexing, funding, or market-data constraints; skills still execute through the Trading API / router path regardless of chain. Operators choose an execution mode, `confirm` (default) or `autonomous`. See `references/execution-model.md`.

Skills do not own funding. Read the selected template for funding constraints; on insufficient balance or gas the skills skip the action and report it rather than topping up or moving funds onto the chain.

## Target-chain templates

Read the selected target-chain template before acting. A template provides chain id, chain name, RPC / read path, deployed Uniswap contracts, tradable token source, funding constraints, market-data availability, transfer-restriction caveats. The reference Robinhood Chain template is `references/robinhood-chain.md`.

## Restrictions and Disclaimers

RWA gating is template-specific and may be enforced at the token level (transfer-restricted ERC-20s). Skills must handle transfer-restriction reverts defensively, respect template-provided equity market-hours guidance, and surface the financial disclaimers in the repo root `DISCLAIMER.md`. See `references/execution-model.md`.

## Structure

```text
uniswap-trading-tools/
├── .claude-plugin/plugin.json
├── package.json
├── project.json
├── CLAUDE.md
├── AGENTS.md -> CLAUDE.md
├── README.md
├── references/
│   ├── robinhood-chain.md
│   ├── execution-model.md
│   └── strategy-state.md
└── skills/
    ├── dca-bot/SKILL.md
    ├── index-bot/SKILL.md
    └── copy-trade/SKILL.md
```

## Adding or changing skills

Follow the repo conventions in the root `CLAUDE.md`: SKILL.md frontmatter (`name`, `description`, `license`, `metadata.author`), the `plugin.json` skills array, doc pages under `docs/`, and an eval suite under `evals/suites/<skill>/`. The frontmatter `name` must match the skill directory name.
