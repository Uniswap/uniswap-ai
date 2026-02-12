---
title: Installation
order: 2
---

# Installation

Multiple installation options are available depending on your use case.

## Claude Code Plugin

### Via Git URL

Install any plugin directly in Claude Code:

```bash
/install https://github.com/Uniswap/uniswap-ai/tree/main/packages/plugins/<plugin-name>
```

Available plugins:

| Plugin            | Description                            |
| ----------------- | -------------------------------------- |
| `uniswap-hooks`   | Uniswap V4 hook development            |
| `uniswap-cca`     | CCA auction configuration & deployment |
| `uniswap-trading` | Uniswap swap integration               |
| `uniswap-viem`    | EVM blockchain integration (viem)      |
| `uniswap-driver`  | Swap & liquidity deep link planning    |

## Development Setup

To contribute or develop locally:

```bash
# Clone the repository
git clone https://github.com/uniswap/uniswap-ai.git
cd uniswap-ai

# Install dependencies
npm install

# Build all packages
npx nx run-many -t build

# Run tests
npx nx run-many -t test
```

## System Requirements

| Requirement | Version | Purpose           |
| ----------- | ------- | ----------------- |
| Claude Code | Latest  | Plugin runtime    |
| Node.js     | 22.x    | Local development |
| npm         | 11.7.0+ | Local development |

### npm Version (for contributors)

Local development requires npm 11.7.0+:

```bash
npm install -g npm@latest
npm --version  # Should output: 11.7.0 or higher
```

## Verifying Installation

After plugin installation, the plugin's skills should be available as slash commands. For example, after installing `uniswap-hooks`:

```text
/v4-security-foundations
/aggregator-hook-creator
```

## Troubleshooting

### Plugin Not Found

If skills don't appear after installation:

1. Verify the plugin was installed successfully
2. Try reinstalling with the full Git URL
3. Check that Claude Code is up to date
