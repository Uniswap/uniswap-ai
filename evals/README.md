# AI Tool Evaluations

Evals are to AI tools what tests are to traditional code. This framework uses [Promptfoo](https://github.com/promptfoo/promptfoo) for declarative, CI-integrated evaluations of skills and plugins.

## Philosophy

### Why Evals Matter

Traditional software tests verify deterministic behavior: given input X, expect output Y. AI tools are probabilistic - the same prompt might produce different (but equally valid) outputs. Evals bridge this gap by:

1. **Defining expected behaviors** rather than exact outputs
2. **Measuring quality across multiple dimensions** (accuracy, completeness, safety)
3. **Detecting regressions** when prompts or models change
4. **Comparing performance** across different LLM backends

### Eval vs Test

| Aspect         | Traditional Test   | AI Eval                      |
| -------------- | ------------------ | ---------------------------- |
| Output         | Exact match        | Semantic similarity          |
| Pass/Fail      | Binary             | Scored (0-1)                 |
| Determinism    | Always same result | Statistical confidence       |
| What's Checked | Correctness        | Quality, safety, helpfulness |

## Structure

```text
evals/
├── promptfoo.yaml          # Root config with default providers
├── README.md               # This file
├── framework/
│   └── types.ts            # TypeScript types (for programmatic use)
├── rubrics/                # Shared evaluation rubrics
│   └── security-checklist.md
├── scripts/
│   └── anthropic-provider.ts  # Custom provider for OAuth support
├── suites/
│   └── <skill-name>/
│       ├── promptfoo.yaml  # Suite-specific config
│       ├── cases/          # Test case prompts (markdown)
│       │   └── *.md
│       └── rubrics/        # Skill-specific rubrics
│           └── *.md
└── templates/              # Templates for new suites
    └── suite/
```

## Running Evals

```bash
# Run a specific suite
nx run evals:eval --suite=aggregator-hook-creator

# Run all suites
nx run evals:eval:all

# View results in browser
nx run evals:eval:view

# Clear eval cache
nx run evals:eval:cache-clear
```

### Authentication

Evals support two authentication methods:

```bash
# Option 1: Direct Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Option 2: Claude Code OAuth token
export CLAUDE_CODE_OAUTH_TOKEN=<token>
```

## Writing Evals

### 1. Create a Test Case

Create a markdown file in `suites/<skill>/cases/`:

```markdown
# Basic Swap Hook

Create a simple hook that logs swap events.

## Context

- Pool: ETH/USDC
- Chain: Ethereum mainnet
- No custom fees required

## Requirements

1. Implement `afterSwap` callback
2. Emit an event with swap details
3. No state changes needed
```

### 2. Define Rubrics

Create rubric files in `suites/<skill>/rubrics/`:

**correctness.md:**

```markdown
# Correctness Rubric

Evaluate whether the generated code correctly implements the requirements.

## Required Elements

1. Inherits from BaseHook
2. Implements getHookPermissions()
3. Sets afterSwap to true
4. Emits event in afterSwap callback

## Scoring

- 4/4 elements: 1.0
- 3/4 elements: 0.75
- 2/4 elements: 0.5
- 1/4 elements: 0.25
- 0/4 elements: 0.0
```

### 3. Configure the Suite

Create `promptfoo.yaml`:

```yaml
description: 'My Skill Evaluation'

prompts:
  - file://cases/basic.md

providers:
  - id: anthropic:claude-sonnet-4-20250514
    config:
      temperature: 0

tests:
  - vars:
      scenario: basic
    assert:
      - type: llm-rubric
        value: file://rubrics/correctness.md
        threshold: 0.8
        provider: anthropic:claude-sonnet-4-20250514
      - type: contains
        value: 'BaseHook'
```

## Assertion Types

### LLM Rubrics (Qualitative)

Use for subjective evaluation:

```yaml
- type: llm-rubric
  value: file://rubrics/correctness.md
  threshold: 0.8
```

### Deterministic Checks

Use for required patterns:

```yaml
# Must contain
- type: contains
  value: 'getHookPermissions'

# Must not contain
- type: not-contains
  value: 'selfdestruct'

# Regex match
- type: regex
  value: 'function\\s+beforeSwap'
```

## Evaluation Criteria

### Accuracy (0-1)

Does the output correctly implement the requested functionality?

### Completeness (0-1)

Does the output include all required elements?

### Safety (0-1)

Does the output avoid security vulnerabilities and follow best practices?

For smart contract code, this should always have a threshold of 1.0 (non-negotiable).

## CI Integration

Evals run automatically on PRs that modify:

- `packages/plugins/**`
- `evals/**`

Pass rate must be ≥85% for PR to pass. Results include:

- Per-suite pass/fail counts
- Inference cost tracking
- PR comment with summary

## Creating New Eval Suites

1. Copy `templates/suite/` to `suites/<skill-name>/`
2. Rename `.template` files (remove `.template` extension)
3. Replace `{{SKILL_NAME}}` placeholders
4. Add test cases in `cases/` directory
5. Define rubrics in `rubrics/` directory
6. Update `promptfoo.yaml` with your prompts and assertions

## Best Practices

1. **Focus on outputs, not paths**: Don't check for specific steps, check that the result is correct
2. **Start with real failures**: Build evals from actual issues found in usage
3. **Test the edges**: Include cases that stress the skill's capabilities
4. **Use deterministic checks first**: `contains`/`not-contains` are faster and cheaper than LLM rubrics
5. **Set appropriate thresholds**: Security = 1.0, correctness ≥ 0.8, completeness ≥ 0.85
6. **Review transcripts**: Regularly read eval outputs to validate rubric quality

## Troubleshooting

### Eval not finding config

Ensure `promptfoo.yaml` exists in the suite directory.

### Authentication errors

Set either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` environment variable.

### Rubric scoring seems off

Review the rubric instructions - LLM judges need clear scoring guidelines.

### Cost concerns

- Use `claude-sonnet-4` instead of `claude-opus-4` for routine evals
- Use deterministic assertions where possible
- Run specific suites instead of all suites during development
