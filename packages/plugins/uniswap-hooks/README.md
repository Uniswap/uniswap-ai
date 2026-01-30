# uniswap-hooks

AI-powered assistance for creating Uniswap V4 hooks.

## Overview

This Claude Code plugin provides skills for developing Uniswap V4 hooks, including aggregator hooks, custom fee hooks, and other advanced hook patterns.

## Skills

### aggregator-hook-creator

Create custom aggregator hooks for Uniswap V4 that route through multiple liquidity sources.

**Usage:**

```text
/aggregator-hook-creator
```

Or describe what you want:

```text
"Create a hook that aggregates liquidity from Uniswap V4 and an external DEX"
```

## Installation

### Via Claude Code Marketplace

```bash
/plugin marketplace add Uniswap/uniswap-ai
/plugin install uniswap-hooks
```

## Requirements

- Claude Code with plugin support
- Familiarity with Uniswap V4 hooks architecture

## Resources

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [V4 Hooks Guide](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Hook Examples](https://github.com/Uniswap/v4-periphery/tree/main/src/lens)

## License

MIT License - see [LICENSE](../../../LICENSE) for details.
