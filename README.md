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

## Featured Skills

| Skill                | Plugin          | Description                                                        |
| -------------------- | --------------- | ------------------------------------------------------------------ |
| `swap-integration`   | uniswap-trading | Integrate Uniswap swaps via Trading API, Universal Router, or SDKs |
| `pay-with-any-token` | uniswap-trading | Pay HTTP 402 challenges (MPP/x402) using tokens via Uniswap swaps  |
| `uniswap-v4-hooks`   | uniswap-hooks   | Secure Uniswap v4 hook development assistant                       |

## Documentation

| Document                                   | Description                              |
| ------------------------------------------ | ---------------------------------------- |
| [Project Overview](./docs/OVERVIEW.md)     | Plugins, architecture, development setup |
| [Getting Started](./docs/getting-started/) | Installation and quick start guide       |

## Contributing

See [Project Overview](./docs/OVERVIEW.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Legal Disclaimer

See [Usage Guidelines](./DISCLAIMER.md) for important information about intended use and financial information disclaimers.