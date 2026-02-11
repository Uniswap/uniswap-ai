# uniswap-hooks

AI-powered, security-first assistance for creating Uniswap V4 hooks.

## Overview

This Claude Code plugin provides skills for developing Uniswap V4 hooks with a strong emphasis on security. It covers aggregator hooks, custom fee hooks, and other advanced hook patterns—all built on a foundation of security best practices.

**Recommended Learning Path**: Complete `v4-security-foundations` before building specific hook types.

## Skills

### v4-security-foundations

Security-first guide for V4 hook development. Covers:

- Threat model framework (5 key threat areas)
- Permission flags risk matrix (all 14 flags)
- NoOp rug pull attack prevention
- Delta accounting fundamentals
- Access control and router verification patterns
- Pre-deployment audit checklist

**Usage:**

```text
/v4-security-foundations
```

Or ask about security:

```text
"What are the security risks of beforeSwapReturnDelta?"
"How do I prevent NoOp attacks in my V4 hook?"
```

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

### Via Skills CLI (Any Agent)

```bash
npx skills add Uniswap/uniswap-ai
```

### Via Claude Code Marketplace

```bash
/plugin marketplace add uniswap/uniswap-ai
/plugin install uniswap-hooks
```

## Requirements

- Claude Code with plugin support
- Familiarity with Uniswap V4 hooks architecture

## Resources

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [V4 Hooks Guide](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Hook Examples](https://github.com/Uniswap/v4-periphery/tree/main/src/lens)

## Acknowledgments

The `v4-security-foundations` skill draws inspiration from the community skill at [igoryuzo/uniswapV4-hooks-skill](https://github.com/igoryuzo/uniswapV4-hooks-skill) ([v4hooks.dev](https://www.v4hooks.dev)), which compiled security guidance from Certora/ABDK audit reports, NoOp exploit analysis, and 50+ production hook examples.

## License

MIT License - see [LICENSE](../../../LICENSE) for details.
