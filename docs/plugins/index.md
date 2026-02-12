---
title: Plugins Overview
order: 1
---

# Plugins Overview

Plugins are the primary distribution mechanism for Uniswap AI tools. Each plugin is a self-contained package that provides skills, agents, and commands for Claude Code.

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
/install https://github.com/Uniswap/uniswap-ai/tree/main/packages/plugins/<plugin-name>
```

## Plugin Architecture

### Structure

Each plugin follows this structure:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest
├── skills/                 # AI skills
│   └── skill-name/
│       ├── SKILL.md       # Skill definition
│       └── references/    # Supporting materials
├── agents/                 # Specialized agents
├── commands/               # Slash commands
├── hooks/                  # Event hooks
├── package.json           # Package metadata
├── project.json           # Nx configuration
└── README.md              # Documentation
```

### Plugin Manifest

The `plugin.json` file defines the plugin:

```json
{
  "name": "Plugin Name",
  "version": "1.0.0",
  "description": "Plugin description",
  "skills": ["skill-name"],
  "agents": ["agent-name"],
  "commands": ["command-name"]
}
```

## Components

### Skills

Skills are AI-powered capabilities defined in markdown:

```markdown
---
name: skill-name
description: What the skill does
invocation: /skill-name
---

# Skill Name

Instructions for the AI on how to perform this skill...
```

See [Skills](/skills/) for available skills.

### Agents

Agents are specialized AI configurations:

```yaml
name: agent-name
description: Agent purpose
model: claude-3-5-sonnet
tools:
  - tool1
  - tool2
```

### Commands

Commands are slash commands that trigger actions:

```typescript
export const command = {
  name: 'command-name',
  description: 'What the command does',
  execute: async (args) => {
    // Command implementation
  },
};
```

## Versioning

Plugins follow semantic versioning:

| Change                             | Version Bump  |
| ---------------------------------- | ------------- |
| Bug fixes                          | Patch (1.0.X) |
| New features (backward compatible) | Minor (1.X.0) |
| Breaking changes                   | Major (X.0.0) |

Version is tracked in:

- `package.json` version field
- `.claude-plugin/plugin.json` version field

## Creating Plugins

See [Creating Plugins](/plugins/creating-plugins) for a detailed guide.

## Related

- [Skills](/skills/) - Available AI skills
- [Creating Plugins](/plugins/creating-plugins) - Plugin development guide
- [Contributing](/contributing/) - How to contribute
