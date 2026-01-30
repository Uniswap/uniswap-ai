# Skills

Skills are AI-powered capabilities that help you build on Uniswap. Each skill is designed for a specific task and can be invoked directly or contextually.

## Available Skills

### uniswap-hooks Plugin

| Skill | Description | Invocation |
|-------|-------------|------------|
| [Aggregator Hook Creator](./aggregator-hook-creator) | Create hooks that aggregate liquidity | `/aggregator-hook-creator` |

## Using Skills

### Direct Invocation

Use the slash command to invoke a skill directly:

```text
/aggregator-hook-creator
```

### Contextual Activation

Skills also activate contextually when you describe what you want:

```text
Create a hook that routes swaps through multiple liquidity sources
```

Claude will recognize this relates to aggregator hooks and apply the relevant skill.

## Skill Structure

Each skill includes:

- **Description**: When the skill activates
- **Model**: Which Claude model to use (opus, sonnet, haiku)
- **Allowed Tools**: What tools the skill can use
- **Instructions**: Detailed guidance for the task

## Contributing Skills

To add a new skill:

1. Create a directory under `packages/plugins/<plugin>/skills/<skill-name>/`
2. Add a `SKILL.md` file with frontmatter and instructions
3. Update the plugin's `plugin.json` to include the skill
4. Add an eval suite under `evals/suites/<skill-name>/`

See the [Plugin Development Guide](https://github.com/Uniswap/uniswap-ai/blob/main/docs/contributing.md) for details.
