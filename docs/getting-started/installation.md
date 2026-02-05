# Installation

Multiple installation options are available depending on your use case.

## Claude Code Plugin

### Via Marketplace

The recommended approach for Claude Code users:

```bash
# Add the marketplace
/plugin marketplace add uniswap/uniswap-ai

# Install specific plugin
/plugin install uniswap-hooks
```

### Via Git URL

For development or testing:

```bash
/plugin install https://github.com/uniswap/uniswap-ai.git
```

## npm Packages

For programmatic integration in your applications:

```bash
# Core SDK
npm install @uniswap-ai/core

# Or with yarn
yarn add @uniswap-ai/core

# Or with pnpm
pnpm add @uniswap-ai/core
```

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

| Requirement | Version |
| ----------- | ------- |
| Node.js     | 22.x    |
| npm         | 11.7.0  |
| Claude Code | Latest  |

### npm Version

This project requires npm 11.7.0 for OIDC trusted publishing:

```bash
npm install -g npm@11.7.0
npm --version  # Should output: 11.7.0
```

## Verifying Installation

### Verify Plugin Installation

After plugin installation:

```bash
# List installed plugins
/plugin list

# Show plugin details
/plugin info uniswap-hooks
```

### npm Package

After npm installation:

```typescript
import { version } from '@uniswap-ai/core';

console.log(`Using @uniswap-ai/core v${version}`);
```

## Troubleshooting

### Plugin Not Found

If the plugin doesn't appear after installation:

1. Refresh Claude Code: `/refresh`
2. Check marketplace: `/plugin marketplace list`
3. Try reinstalling: `/plugin uninstall uniswap-hooks && /plugin install uniswap-hooks`

### npm Installation Fails

If npm installation fails:

1. Check Node.js version: `node --version` (should be 22.x)
2. Check npm version: `npm --version` (should be 11.7.0)
3. Clear npm cache: `npm cache clean --force`
4. Try again: `npm install @uniswap-ai/core`
