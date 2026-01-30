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
      link: https://github.com/Uniswap/uniswap-ai

features:
  - icon: 🪝
    title: Hook Creator Skills
    details: AI-powered assistance for creating Uniswap V4 hooks, including aggregator hooks, custom fee hooks, and more.
  - icon: 🤖
    title: Agent Agnostic
    details: Designed to work with any LLM coding agent, not just Claude Code. Use with GPT-4, Gemini, and others.
  - icon: 📊
    title: Eval Framework
    details: Comprehensive evaluation framework to test AI tools for accuracy, completeness, and security.
  - icon: 🛠️
    title: Developer SDKs
    details: TypeScript SDKs for integrating Uniswap AI capabilities into your own applications.
---

## Quick Installation

### Claude Code Marketplace

```bash
/plugin marketplace add Uniswap/uniswap-ai
/plugin install uniswap-hooks
```

### npm Packages

```bash
npm install @uniswap-ai/core
```

## Featured Skills

### Aggregator Hook Creator

Create custom aggregator hooks for Uniswap V4 that route through multiple liquidity sources.

```text
/aggregator-hook-creator
```

Or describe what you want:

```text
"Create a hook that compares prices across V4 pools and external DEXs"
```

## Resources

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [V4 Hooks Guide](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Claude Code](https://claude.ai/code)
