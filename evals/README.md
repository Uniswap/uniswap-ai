# AI Tool Evaluations

Evals are to AI tools what tests are to traditional code. This framework provides a structured approach to evaluating the quality and reliability of AI-powered skills and plugins.

## Philosophy

### Why Evals Matter

Traditional software tests verify deterministic behavior: given input X, expect output Y. AI tools are probabilistic - the same prompt might produce different (but equally valid) outputs. Evals bridge this gap by:

1. **Defining expected behaviors** rather than exact outputs
2. **Measuring quality across multiple dimensions** (accuracy, helpfulness, safety)
3. **Detecting regressions** when prompts or models change
4. **Comparing performance** across different LLM backends

### Eval vs Test

| Aspect | Traditional Test | AI Eval |
|--------|------------------|---------|
| Output | Exact match | Semantic similarity |
| Pass/Fail | Binary | Scored (0-1) |
| Determinism | Always same result | Statistical confidence |
| What's Checked | Correctness | Quality, safety, helpfulness |

## Structure

```text
evals/
├── README.md              # This file
├── framework/
│   ├── runner.ts          # Eval execution harness
│   ├── types.ts           # TypeScript types
│   └── reporters/         # Output formatters
│       └── console.ts     # Console reporter
└── suites/
    └── <skill-name>/
        ├── eval.config.ts # Test configuration
        ├── cases/         # Test case prompts
        │   └── *.md       # Individual test cases
        └── expected/      # Expected behaviors
            └── *.md       # Expected output patterns
```

## Running Evals

```bash
# Run all evals
npx nx run evals:run

# Run specific suite
npx nx run evals:run --suite=aggregator-hook-creator

# Run with specific model
npx nx run evals:run --model=claude-sonnet-4

# Dry run (show what would be evaluated)
npx nx run evals:run --dry-run
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

### 2. Define Expected Behaviors

Create a corresponding file in `suites/<skill>/expected/`:

```markdown
# Expected Behaviors

## Must Include

- [ ] Inherits from BaseHook
- [ ] Implements getHookPermissions()
- [ ] Sets afterSwap to true
- [ ] Emits event in afterSwap callback

## Should Include

- [ ] Uses appropriate data types
- [ ] Includes NatSpec comments
- [ ] Follows Solidity style guide

## Must Not Include

- [ ] Unnecessary callbacks enabled
- [ ] Mutable state
- [ ] External calls
```

### 3. Configure the Suite

Create `eval.config.ts`:

```typescript
import { EvalConfig } from '../../framework/types';

export const config: EvalConfig = {
  name: 'aggregator-hook-creator',
  skill: 'aggregator-hook-creator',
  models: ['claude-sonnet-4', 'claude-opus-4'],
  timeout: 60000,
  retries: 2,
  thresholds: {
    accuracy: 0.8,
    completeness: 0.9,
    safety: 1.0,
  },
};
```

## Evaluation Criteria

### Accuracy (0-1)

Does the output correctly implement the requested functionality?

### Completeness (0-1)

Does the output include all required elements?

### Safety (0-1)

Does the output avoid security vulnerabilities and follow best practices?

### Helpfulness (0-1)

Is the output well-documented and easy to understand?

## CI Integration

Evals run automatically on PRs that modify skills:

```yaml
# .github/workflows/ci-pr-checks.yml
- name: Run evals
  run: npx nx run evals:run --affected
```

## Multi-Model Support

Evals can be run against multiple LLM backends to:

1. Compare quality across models
2. Ensure prompts work universally
3. Identify model-specific issues

Configure in `eval.config.ts`:

```typescript
models: ['claude-sonnet-4', 'gpt-4', 'gemini-pro'],
```

## Reporting

Results are output in multiple formats:

- **Console**: Human-readable summary
- **JSON**: Machine-readable for CI
- **Markdown**: PR comment summaries

## Best Practices

1. **Test the edges**: Include cases that stress the skill's capabilities
2. **Version your evals**: Track changes alongside skill changes
3. **Set appropriate thresholds**: Different skills need different standards
4. **Document failures**: When evals fail, document why in the case file
5. **Review periodically**: Evals should evolve with the skill
