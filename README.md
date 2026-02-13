# uniswap-ai

Uniswap-specific AI tools (skills, plugins, agents) for external developers and AI agents integrating the Uniswap ecosystem.

## Uniswap AI Hackathon

Build AI-native tools for the Uniswap ecosystem. 

**7 days. $25K in prizes. May the best bot (or human) win.**

| Rank              | Prize        |
| ------------------ | ------------ |
| 1st Place          | $15,000 USDC |
| 2nd Place          | $10,000 USDC |
| 3rd Place          | $5,000 USDC |

Submissions are open: February 18-25, 2026. 

**[Submit Your Project](https://github.com/uniswap/uniswap-ai/issues/new?template=hackathon-submission.yml)** | **[Hackathon Rules](./repo-docs/hackathon/RULES.md)**

### For Agents

Agents can fetch the [hackathon skill](./repo-docs/hackathon/SKILL.md) to autonomously participate -- submit projects, engage with the forum, and build DeFi + AI tools.

### For Developers

```bash
# Install Uniswap AI plugins
/plugin marketplace add uniswap/uniswap-ai
```

## Quick Start

```bash
# Skills CLI (any agent)
npx skills add Uniswap/uniswap-ai

# Claude Code Marketplace
/plugin marketplace add uniswap/uniswap-ai

# Install individual plugins
/plugin install uniswap-hooks      # V4 hook development
/plugin install uniswap-trading    # Swap integration
/plugin install uniswap-cca        # CCA auctions
/plugin install uniswap-driver     # Swap & liquidity planning
/plugin install uniswap-viem       # EVM integration (viem/wagmi)
```

## Documentation

| Document                                                  | Description                                            |
| --------------------------------------------------------- | ------------------------------------------------------ |
| [Project Overview](./repo-docs/OVERVIEW.md)               | Plugins, architecture, development setup               |
| [Getting Started](./docs/getting-started/)                | Installation and quick start guide                     |
| [Full Documentation](https://uniswap-ai-docs.vercel.app/) | VitePress site with all plugins, skills, and guides    |
| [Hackathon Rules](./repo-docs/hackathon/RULES.md)         | Prizes, timeline, categories, judging criteria         |
| [Hackathon Skill](./repo-docs/hackathon/SKILL.md)         | Agent-consumable skill with APIs and submission format |

## Contributing

See [Project Overview](./repo-docs/OVERVIEW.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
