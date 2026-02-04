# uniswap-ai

Uniswap-specific AI tools (skills, plugins, agents) for external developers and AI agents integrating the Uniswap ecosystem.

## Overview

This repository provides Claude Code plugins and AI development tools specifically designed for building on the Uniswap protocol. It complements the general-purpose [ai-toolkit](https://github.com/Uniswap/ai-toolkit) with protocol-specific capabilities.

| Repository   | Focus                                | Audience                       |
| ------------ | ------------------------------------ | ------------------------------ |
| `ai-toolkit` | General development workflow plugins | Internal developers            |
| `uniswap-ai` | Uniswap protocol-specific AI tools   | External developers, AI agents |

## Installation

### Claude Code Marketplace

```bash
# Install the uniswap-ai plugin marketplace
/plugin marketplace add Uniswap/uniswap-ai

# Install a specific plugin
/plugin install uniswap-hooks
```

### npm Packages

```bash
# Install SDK packages
npm install @uniswap-ai/core
```

## Plugins

### uniswap-cca

Configuration and deployment tools for Continuous Clearing Auction (CCA) smart contracts.

**Skills:**

- `configurator` - Interactive bulk form configuration for CCA auction parameters
- `deployer` - Deployment guidance with safety checks and Factory integration

**MCP Servers:**

- `cca-supply-schedule` - Generate and encode supply schedules using normalized convex curves

### uniswap-hooks

AI-powered assistance for creating Uniswap V4 hooks.

**Skills:**

- `aggregator-hook-creator` - Create custom aggregator hooks for Uniswap V4

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
│   ├── plugins/         # Claude Code plugins
│   ├── sdk/             # TypeScript SDKs
│   ├── prompts/         # Shared prompt templates
│   └── utils/           # Shared utilities
├── evals/               # AI tool evaluations
├── docs/                # VitePress documentation
└── scripts/             # Build scripts
```

## Contributing

Contributions are welcome. Please ensure:

1. All code passes linting and tests
2. New skills include eval suites
3. Documentation is updated

### Automated Checks

PRs are automatically validated by several workflows:

- **PR Checks** - Build, lint, test, and plugin validation
- **Claude Code Review** - AI-powered code review with inline comments
- **Claude Docs Check** - Validates CLAUDE.md and README updates, ensures plugin version bumps

If the docs check flags missing documentation updates, you can apply the suggested changes directly from the PR comments.

See [.github/workflows/CLAUDE.md](.github/workflows/CLAUDE.md) for detailed CI documentation.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Links

- [Documentation](https://uniswap.github.io/uniswap-ai/)
- [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [Claude Code](https://claude.ai/code)
