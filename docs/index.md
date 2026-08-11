---
layout: home

hero:
  name: Uniswap AI
  text: AI tools for building on Uniswap
  tagline: Skills, plugins, and agents for the Uniswap ecosystem
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/uniswap/uniswap-ai

features:
  - icon: 🪝
    title: v4 Hook Development
    details: Security-first Uniswap v4 hook creation with audit checklists, vulnerability analysis, and best practices.
  - icon: 💱
    title: Swap Integration
    details: Integrate Uniswap swaps via Trading API, Universal Router SDK, or direct smart contract calls.
  - icon: 🏦
    title: CCA Auctions
    details: Configure and deploy Continuous Clearing Auction smart contracts for fair token distribution.
  - icon: 🔗
    title: EVM Integration
    details: Foundational blockchain integration using viem and wagmi for reading, writing, and interacting with smart contracts.
  - icon: 🤖
    title: Trading Tools
    details: Automated, asset-agnostic trading tools (DCA, index baskets, copy-trading) that delegate execution to existing Uniswap skills.
---

## Quick Installation

### Claude Code Marketplace

```bash
/plugin marketplace add uniswap/uniswap-ai
```

### Install Individual Plugins

```bash
/plugin install uniswap-hooks          # v4 hook development
/plugin install uniswap-trading        # Swap integration
/plugin install uniswap-cca            # CCA auctions
/plugin install uniswap-driver         # Swap & liquidity planning
/plugin install uniswap-viem           # EVM integration (viem/wagmi)
/plugin install uniswap-trading-tools  # Automated trading tools (DCA, index, copy-trade)
```

## Featured Skills

### v4 Security Foundations

Security-first guide for Uniswap v4 hook development covering threat models, permission flags, and audit checklists.

```text
/v4-security-foundations
```

### Swap Integration

Integrate Uniswap swaps into your application using the Trading API, Universal Router SDK, or direct smart contract calls.

```text
/swap-integration
```

### DCA Bot

Dollar-cost average into a token on a schedule — set the amount and cadence, and it buys for you within spend caps and a confirmation step by default.

```text
/dca-bot
```

### CCA Configurator

Configure Continuous Clearing Auction parameters for fair and transparent token distribution.

```text
/configurator
```

### Swap Planner

Plan token swaps and generate deep links to execute directly in the Uniswap interface.

```text
/swap-planner
```

## Resources

- [Uniswap API Documentation](https://api-docs.uniswap.org/introduction)
- [Uniswap v4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [v4 Hooks Guide](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Claude Code](https://claude.ai/code)
