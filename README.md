# uniswap-ai

Uniswap-specific AI tools (skills, plugins, agents) for developers and AI agents integrating the Uniswap ecosystem.

## Quick Start

```bash
# Skills CLI (any agent)
npx skills add Uniswap/uniswap-ai

# Claude Code Marketplace
/plugin marketplace add uniswap/uniswap-ai

# Install individual plugins
/plugin install uniswap-hooks      # v4 hook development
/plugin install uniswap-trading    # Swap integration
/plugin install uniswap-cca        # CCA auctions
/plugin install uniswap-driver     # Swap & liquidity planning
/plugin install uniswap-viem       # EVM integration (viem/wagmi)
```

## Documentation

| Document                                             | Description                                         |
| ---------------------------------------------------- | --------------------------------------------------- |
| [Project Overview](./docs/OVERVIEW.md)               | Plugins, architecture, development setup            |
| [Getting Started](./docs/getting-started/)           | Installation and quick start guide                  |
| [Full Documentation](https://ul-ai-docs.vercel.app/) | VitePress site with all plugins, skills, and guides |

## Contributing

See [Project Overview](./docs/OVERVIEW.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
