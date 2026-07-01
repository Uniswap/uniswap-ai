# uniswap-trading-tools

AI skills for automated trading tools on Uniswap. The skills are asset-agnostic (crypto-native tokens and tokenized RWAs) and chain-agnostic: operators select a target-chain template that supplies deployment-specific values.

## Overview

uniswap-trading-tools is a thin strategy layer over Uniswap. It does not reimplement swap execution: each skill delegates execution to existing uniswap-ai skills (`swap-integration`, `v4-sdk-integration`, `viem-integration`) and reuses Uniswap infrastructure. The net-new logic is strategy, scheduling, state, and guardrails.

## Skills

Added incrementally across a 3-PR stack; all three skills (`dca-bot`, `index-bot`, `copy-trade`) are available.

### dca-bot

Dollar-cost-average a fixed amount into a token on a schedule, optionally only when a condition holds.

### index-bot

Build a weighted basket of assets, buy it in one pass, and rebalance on a cadence.

### copy-trade

Watch a target wallet and mirror its trades, bounded by guardrails (chain filter, asset match, position size).

## Execution

All execution uses the Uniswap Trading API path of `swap-integration`. Operators choose an execution mode: `confirm` (default, approve every transaction) or `autonomous` (within spend caps, an allowlist, a dry-run, and a kill switch). See `references/execution-model.md`.

## Target-chain templates

Each skill reads the selected target-chain template for implementation-specific values: `chainId`, chain name, RPC / read path, deployed Uniswap contracts, tradable token source, funding constraints, market-data availability, transfer-restriction caveats.

The reference template is `references/robinhood-chain.md`.

## Installation

```bash
/plugin marketplace add Uniswap/uniswap-ai
/plugin install uniswap-trading-tools
```

## Restrictions and Disclaimers

Skills handle transfer-restriction reverts, respect template-provided market-hours guidance for RWAs, and surface the disclaimers in the repo root `DISCLAIMER.md`. See `references/execution-model.md`.
