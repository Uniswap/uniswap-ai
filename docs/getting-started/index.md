# Getting Started

Welcome to Uniswap AI - a collection of AI tools for building on the Uniswap protocol.

## What is Uniswap AI?

Uniswap AI provides Claude Code plugins and AI development tools specifically designed for the Uniswap ecosystem. It helps developers:

- **Create Uniswap V4 hooks** with AI-powered assistance
- **Design and test** hook implementations efficiently
- **Follow best practices** for security and gas optimization

## Prerequisites

- [Claude Code](https://claude.ai/code) for plugin usage
- Node.js 22.x for SDK development
- Familiarity with Uniswap V4 hooks architecture

## Installation Options

### Option 1: Claude Code Marketplace

The easiest way to get started is through the Claude Code marketplace:

```bash
# Add the uniswap-ai marketplace
/plugin marketplace add Uniswap/uniswap-ai

# Install the hooks plugin
/plugin install uniswap-hooks
```

### Option 2: npm Packages

For programmatic integration:

```bash
npm install @uniswap-ai/core
```

## Verify Installation

After installing the Claude Code plugin, verify it's working:

```text
/plugin list
```

You should see `uniswap-hooks` in the list of installed plugins.

## Next Steps

- [Quick Start](./quick-start) - Your first hook with AI assistance
- [Skills Reference](/skills/) - Available AI skills
- [Evals Guide](/evals/) - Test and evaluate AI outputs

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `packages/plugins/` | Claude Code plugins |
| `packages/sdk/` | TypeScript SDKs |
| `evals/` | AI tool evaluations |
| `docs/` | This documentation |

## Getting Help

- [GitHub Issues](https://github.com/Uniswap/uniswap-ai/issues) - Report bugs or request features
- [Uniswap Discord](https://discord.gg/uniswap) - Community support
