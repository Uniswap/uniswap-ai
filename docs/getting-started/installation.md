---
title: Installation
order: 2
---

# Installation

Multiple installation options are available depending on your use case.

## Claude Code Plugin

### Via Marketplace

Install all plugins from the Claude Code Marketplace:

```bash
/plugin marketplace add uniswap/uniswap-ai
```

### Install Individual Plugins

```bash
/plugin install uniswap-hooks      # V4 hook development
/plugin install uniswap-trading    # Swap integration
/plugin install uniswap-cca        # CCA auctions
/plugin install uniswap-driver     # Swap & liquidity planning
/plugin install uniswap-viem       # EVM integration (viem/wagmi)
```

## Development Setup

To contribute or develop locally:

```bash
# Clone the repository
git clone https://github.com/uniswap/uniswap-ai.git
cd uniswap-ai

# Install dependencies (uses bun.lock + bunfig.toml minimumReleaseAge defense)
bun install

# Build all packages
bunx nx run-many -t build

# Run tests
bunx nx run-many -t test
```

## System Requirements

| Requirement | Version | Purpose           |
| ----------- | ------- | ----------------- |
| Claude Code | Latest  | Plugin runtime    |
| Node.js     | 22.x    | Local development |
| Bun         | 1.3.13+ | Local development |

### Bun (for contributors)

Local development uses [Bun](https://bun.sh) as the package manager. The
repo's `bunfig.toml` enforces `minimumReleaseAge = 259200` (3 days) as a
supply-chain defense — newly-published package versions are filtered out
during install.

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash
bun --version
```

## Verifying Installation

After plugin installation, the plugin's skills should be available as slash commands. For example, after installing `uniswap-hooks`:

```text
/v4-security-foundations
```

## Troubleshooting

### Plugin Not Found

If skills don't appear after installation:

1. Verify the plugin was installed successfully
2. Try reinstalling with `/plugin install <plugin-name>`
3. Check that Claude Code is up to date
