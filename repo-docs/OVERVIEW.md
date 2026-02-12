# Uniswap AI

Uniswap-specific AI tools (skills, plugins, agents) for external developers and AI agents integrating the Uniswap ecosystem.

## Overview

This repository provides Claude Code plugins and AI development tools specifically designed for building on the Uniswap protocol. It complements the general-purpose [ai-toolkit](https://github.com/Uniswap/ai-toolkit) with protocol-specific capabilities.

| Repository   | Focus                                | Audience                       |
| ------------ | ------------------------------------ | ------------------------------ |
| `ai-toolkit` | General development workflow plugins | Internal developers            |
| `uniswap-ai` | Uniswap protocol-specific AI tools   | External developers, AI agents |

## Installation

### Skills CLI (Any Agent)

```bash
# Install all Uniswap AI skills via the skills.sh CLI
npx skills add Uniswap/uniswap-ai
```

### Claude Code Marketplace

```bash
# Install the uniswap-ai plugin marketplace
/plugin marketplace add uniswap/uniswap-ai

# Install a specific plugin
/plugin install uniswap-hooks
```

## Plugins

### uniswap-hooks

AI-powered, security-first assistance for creating Uniswap V4 hooks.

**Skills:** `v4-security-foundations`, `aggregator-hook-creator`

### uniswap-trading

Integrate Uniswap swaps via Trading API, Universal Router SDK, or direct smart contract calls.

**Skills:** `swap-integration`

### uniswap-cca

Configure and deploy Continuous Clearing Auction (CCA) smart contracts for token distribution.

**Skills:** `configurator`, `deployer` | **MCP Servers:** `cca-supply-schedule`

### uniswap-driver

Plan Uniswap swaps and liquidity positions with deep link generation for the Uniswap interface.

**Skills:** `swap-planner`, `liquidity-planner`

### uniswap-viem

Foundational EVM blockchain integration using viem and wagmi.

**Skills:** `viem-integration`

## Agent-Agnostic Design

All tools in this repository are designed to work with any LLM coding agent, not just Claude Code:

- **AGENTS.md** symlinks to CLAUDE.md for cross-agent compatibility
- Prompts are written to work across different models
- Skills are structured as markdown that any agent can interpret

## Documentation

- [Getting Started](./docs/getting-started/index.md)
- [Skills Reference](./docs/skills/index.md)
- [Evals Guide](./docs/evals/index.md)

## Development

### Prerequisites

- Node.js 22.x
- npm 11.7.0

### Setup

```bash
# Install dependencies
npm install

# Build all packages
npx nx run-many -t build

# Run tests
npx nx run-many -t test

# Run linting
npx nx run-many -t lint
```

### Project Structure

```text
uniswap-ai/
├── packages/
│   └── plugins/         # Claude Code plugins (skills live here)
├── evals/               # AI tool evaluations (Promptfoo)
├── docs/                # VitePress documentation
├── repo-docs/           # Standalone documents (hackathon, overview)
└── scripts/             # Build and validation scripts
```

## Contributing

Contributions are welcome. Please ensure:

1. All code passes linting and tests
2. New skills include eval suites
3. Documentation is updated

### Automated Checks

PRs are automatically validated by several workflows:

- **PR Checks** - Build, lint, test, documentation prose linting, and plugin validation
- **Claude Code Review** - AI-powered code review with inline comments
- **Claude Docs Check** - Validates CLAUDE.md and README updates, ensures plugin version bumps

If the docs check flags missing documentation updates, you can apply the suggested changes directly from the PR comments.

See [.github/workflows/CLAUDE.md](.github/workflows/CLAUDE.md) for detailed CI documentation.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Links

- [Documentation](https://uniswap-ai-docs.vercel.app/)
- [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [Claude Code](https://claude.ai/code)
