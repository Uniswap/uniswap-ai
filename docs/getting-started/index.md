---
title: Introduction
order: 1
---

# Getting Started

Welcome to Uniswap AI - a collection of AI tools for building on the Uniswap protocol.

## What is Uniswap AI?

Uniswap AI provides Claude Code plugins and AI development tools specifically designed for the Uniswap ecosystem. It helps developers:

- **Create Uniswap v4 hooks** with security-first AI-powered assistance
- **Integrate Uniswap swaps** via Trading API, Universal Router, or smart contracts
- **Configure and deploy CCA auctions** for token distribution
- **Build on EVM blockchains** with viem and wagmi integration guides
- **Plan swaps and liquidity positions** with deep link generation

## Prerequisites

- [Claude Code](https://claude.ai/code) for plugin usage
- Node.js 22.x for local development
- Familiarity with the Uniswap protocol

## Installation

Install all plugins from the Claude Code Marketplace:

```bash
/plugin marketplace add uniswap/uniswap-ai
```

Or install individual plugins:

```bash
/plugin install uniswap-hooks      # V4 hook development
/plugin install uniswap-trading    # Swap integration
/plugin install uniswap-cca        # CCA auctions
/plugin install uniswap-driver     # Swap & liquidity planning
/plugin install uniswap-viem       # EVM integration (viem/wagmi)
```

See [Installation](./installation) for detailed instructions.

## Next Steps

- [Quick Start](./quick-start) - Your first hook with AI assistance
- [Skills Reference](/skills/) - Available AI skills
- [Evals Guide](/evals/) - Test and evaluate AI outputs

## Repository Structure

| Directory           | Purpose                              |
| ------------------- | ------------------------------------ |
| `packages/plugins/` | Claude Code plugins (5 plugins)      |
| `evals/`            | AI tool evaluations (Promptfoo)      |
| `docs/`             | This documentation (VitePress)       |
| `scripts/`          | Build and validation scripts         |
| `.github/`          | CI/CD workflows and reusable actions |

## Getting Help

- [GitHub Issues](https://github.com/uniswap/uniswap-ai/issues) - Report bugs or request features
- [Uniswap Discord](https://discord.gg/uniswap) - Community support
