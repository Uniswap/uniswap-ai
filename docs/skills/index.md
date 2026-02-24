---
title: Overview
order: 1
---

# Skills

Skills are AI-powered capabilities that help you build on Uniswap. Each skill is designed for a specific task and can be invoked directly or contextually.

## Available Skills

### uniswap-hooks Plugin

| Skill                                                | Description                                  | Invocation                 |
| ---------------------------------------------------- | -------------------------------------------- | -------------------------- |
| [V4 Security Foundations](./v4-security-foundations) | Security-first guide for v4 hook development | `/v4-security-foundations` |

### uniswap-cca Plugin

| Skill                          | Description                                     | Invocation      |
| ------------------------------ | ----------------------------------------------- | --------------- |
| [Configurator](./configurator) | Interactive CCA auction parameter configuration | `/configurator` |
| [Deployer](./deployer)         | CCA contract deployment via Factory pattern     | `/deployer`     |

### uniswap-trading Plugin

| Skill                                  | Description                                                                   | Invocation          |
| -------------------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| [Swap Integration](./swap-integration) | Integrate Uniswap swaps via Trading API, Universal Router, or smart contracts | `/swap-integration` |

### uniswap-viem Plugin

| Skill                                  | Description                                     | Invocation          |
| -------------------------------------- | ----------------------------------------------- | ------------------- |
| [viem Integration](./viem-integration) | EVM blockchain integration using viem and wagmi | `/viem-integration` |

### uniswap-driver Plugin

| Skill                          | Description                                | Invocation      |
| ------------------------------ | ------------------------------------------ | --------------- |
| [Swap Planner](./swap-planner) | Plan token swaps with deep link generation | `/swap-planner` |

## Using Skills

### Direct Invocation

Use the slash command to invoke a skill directly:

```text
/v4-security-foundations
```

### Contextual Activation

Skills also activate contextually when you describe what you want:

```text
What are the security risks of beforeSwapReturnDelta?
```

Claude will recognize this relates to v4 hook security and apply the relevant skill.

## Skill Structure

Each skill is a `SKILL.md` markdown file with YAML frontmatter and detailed instructions:

- **Frontmatter**: Name, description, license, and metadata
- **Instructions**: Step-by-step guidance for the AI agent
- **References**: Supporting materials in a `references/` subdirectory (optional)

## Contributing Skills

To add a new skill:

1. Create a directory under `packages/plugins/<plugin>/skills/<skill-name>/`
2. Add a `SKILL.md` file with frontmatter and instructions
3. Update the plugin's `plugin.json` to include the skill
4. Add an eval suite under `evals/suites/<skill-name>/`

See the [CLAUDE.md](https://github.com/uniswap/uniswap-ai/blob/main/CLAUDE.md) for plugin architecture details.
