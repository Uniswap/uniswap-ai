---
title: Plugins Overview
order: 1
---

# Plugins Overview

Plugins are the primary distribution mechanism for Uniswap AI tools. Each plugin is a self-contained package that provides skills and agents for Claude Code.

## Available Plugins

| Plugin                               | Description                                | Skills                                           |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------ |
| [uniswap-hooks](./uniswap-hooks)     | Security-first Uniswap V4 hook development | v4-security-foundations, aggregator-hook-creator |
| [uniswap-cca](./uniswap-cca)         | CCA auction configuration and deployment   | configurator, deployer                           |
| [uniswap-trading](./uniswap-trading) | Uniswap swap integration                   | swap-integration                                 |
| [uniswap-viem](./uniswap-viem)       | EVM blockchain integration with viem/wagmi | viem-integration                                 |
| [uniswap-driver](./uniswap-driver)   | Swap and liquidity deep link planning      | swap-planner, liquidity-planner                  |

**Installation:**

```bash
/plugin marketplace add uniswap/uniswap-ai
```

## Plugin Architecture

### Structure

Each plugin follows this structure:

```text
plugin-name/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest
├── skills/                 # AI skills
│   └── skill-name/
│       ├── SKILL.md       # Skill definition
│       └── references/    # Supporting materials
├── agents/                 # Specialized agents (optional)
├── package.json           # Package metadata
├── project.json           # Nx configuration
└── README.md              # Documentation
```

### Plugin Manifest

The `plugin.json` file defines the plugin:

```json
{
  "name": "uniswap-hooks",
  "version": "1.3.0",
  "description": "AI-powered assistance for creating Uniswap V4 hooks",
  "author": {
    "name": "Uniswap Labs",
    "email": "ai-services@uniswap.org"
  },
  "license": "MIT",
  "skills": ["./skills/v4-security-foundations", "./skills/aggregator-hook-creator"]
}
```

## Components

### Skills

Skills are AI-powered capabilities defined in markdown:

```markdown
---
name: skill-name
description: What the skill does
license: MIT
metadata:
  author: uniswap
---

# Skill Name

Instructions for the AI on how to perform this skill...
```

See [Skills](/skills/) for available skills.

### Agents

Agents are specialized AI configurations defined as markdown files in the `agents/` directory. They provide expert-level assistance for specific domains:

```markdown
---
name: swap-integration-expert
description: Expert agent for complex swap integration questions
---

Instructions for the agent on how to handle specialized queries...
```

Not all plugins include agents. Currently, `uniswap-trading` and `uniswap-viem` provide specialized expert agents.

## Versioning

Plugins follow semantic versioning:

| Change                             | Version Bump  |
| ---------------------------------- | ------------- |
| Bug fixes                          | Patch (1.0.X) |
| New features (backward compatible) | Minor (1.X.0) |
| Breaking changes                   | Major (X.0.0) |

Version is tracked in `.claude-plugin/plugin.json`.

## Creating Plugins

See [Creating Plugins](/plugins/creating-plugins) for a detailed guide.

## Related

- [Skills](/skills/) - Available AI skills
- [Creating Plugins](/plugins/creating-plugins) - Plugin development guide
- [Contributing](/contributing/) - How to contribute
