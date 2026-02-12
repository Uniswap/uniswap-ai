---
title: Creating Plugins
order: 2
---

# Creating Plugins

This guide walks through creating a new plugin for Uniswap AI.

## Prerequisites

- Familiarity with the [monorepo structure](/architecture/monorepo-structure)
- Understanding of [skills](/skills/) and evals
- Development environment set up per [Contributing Guide](/contributing/)

## Step 1: Create Plugin Structure

```bash
# Create plugin directory
mkdir -p packages/plugins/my-plugin/.claude-plugin
mkdir -p packages/plugins/my-plugin/skills
```

## Step 2: Create Plugin Manifest

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "Description of what your plugin does",
  "author": {
    "name": "Your Name",
    "email": "your-email@example.com"
  },
  "license": "MIT",
  "skills": []
}
```

## Step 3: Create Package Configuration

Create `package.json`:

```json
{
  "name": "@uniswap/my-plugin",
  "version": "0.1.0",
  "private": true,
  "description": "My Uniswap AI plugin",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Uniswap/uniswap-ai.git",
    "directory": "packages/plugins/my-plugin"
  }
}
```

Create `project.json` for Nx:

```json
{
  "name": "my-plugin",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "library",
  "targets": {}
}
```

## Step 4: Create a Skill

Create `skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Brief description of the skill
license: MIT
metadata:
  author: uniswap
---

# My Skill

## Overview

Describe what this skill does and when to use it.

## Instructions

Provide detailed instructions for the AI on how to perform this skill.

### Step 1: Gather Information

Ask the user for necessary context...

### Step 2: Perform Action

Based on the information, do the following...

## Examples

### Example 1: Basic Usage

User: "I want to do X"

The AI should respond by...

## References

- [Relevant Documentation](https://example.com)
```

Update `plugin.json` to include the skill:

```json
{
  "skills": ["./skills/my-skill"]
}
```

## Step 5: Create Eval Suite

Every skill needs an evaluation suite:

```bash
mkdir -p evals/suites/my-skill/cases
mkdir -p evals/suites/my-skill/rubrics
```

Create `evals/suites/my-skill/prompt-wrapper.txt`:

```text
You are an AI assistant with the following skill loaded. Follow its instructions
precisely when responding to the user's request.

{{ skill_content }}

---

User request:

{{ case_content }}
```

Create `evals/suites/my-skill/promptfoo.yaml`:

```yaml
# yaml-language-server: $schema=https://promptfoo.dev/config-schema.json
description: 'My Skill Evaluation'

prompts:
  - file://prompt-wrapper.txt

providers:
  - id: anthropic:claude-sonnet-4-5-20250929
    config:
      temperature: 0
      max_tokens: 4096

defaultTest:
  options:
    timeout: 120000
  vars:
    skill_content: file://../../../packages/plugins/my-plugin/skills/my-skill/SKILL.md

tests:
  - vars:
      case_content: file://cases/basic.md
    assert:
      - type: llm-rubric
        value: file://rubrics/correctness.txt
        threshold: 0.8
        provider: anthropic:claude-sonnet-4-5-20250929
```

Create a test case in `evals/suites/my-skill/cases/basic.md` and rubrics in `evals/suites/my-skill/rubrics/`. See [Writing Evals](/evals/writing-evals) for detailed guidance.

## Step 6: Create README

Create `README.md`:

```markdown
# My Plugin

Description of what the plugin provides.

## Installation

\`\`\`bash
/plugin install my-plugin
\`\`\`

## Skills

### /my-skill

Description of the skill.

## Usage

Examples of how to use the plugin.
```

## Step 7: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./packages/plugins/my-plugin",
      "description": "Description of what your plugin does"
    }
  ]
}
```

## Step 8: Validate

Run plugin validation:

```bash
node scripts/validate-plugin.cjs packages/plugins/my-plugin
```

## Testing Your Plugin

### Local Testing

1. Install the plugin locally in Claude Code
2. Test each skill manually
3. Verify expected behavior

### Running Evals

```bash
# Run your skill's evals
npx nx run evals:eval --suite=my-skill
```

## Best Practices

### Skill Design

- Keep skills focused on a single task
- Provide clear, step-by-step instructions
- Include examples for common use cases
- Reference external documentation when needed

### Agent-Agnostic Design

- Write prompts that work across different LLMs
- Avoid model-specific features unless necessary
- Use standard markdown formatting
- Document any model-specific requirements

### Documentation

- Keep README.md up to date
- Document all skills and their invocations
- Include usage examples
- Link to relevant resources

## Troubleshooting

### Plugin Validation Fails

Check that:

- `plugin.json` is valid JSON
- All referenced skills/agents exist
- Version numbers match between files

### Eval Coverage Check Fails

Ensure:

- Eval suite exists in `evals/suites/`
- `promptfoo.yaml` is properly configured
- At least one test case exists

## Related

- [Plugins Overview](/plugins/) - Plugin architecture
- [Writing Evals](/evals/writing-evals) - Creating evaluations
- [Contributing](/contributing/) - Contribution guidelines
