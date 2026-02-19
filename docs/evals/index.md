---
title: Overview
order: 1
---

# Evals

Evals are to AI tools what tests are to traditional code. This framework provides a structured approach to evaluating the quality and reliability of AI-powered skills.

## Why Evals Matter

Traditional software tests verify deterministic behavior. AI tools are probabilistic - the same prompt might produce different (but equally valid) outputs. Evals bridge this gap by:

- **Defining expected behaviors** rather than exact outputs
- **Measuring quality across dimensions** (accuracy, completeness, safety)
- **Detecting regressions** when prompts or models change
- **Comparing performance** across different LLM backends

## Quick Start

### Running Evals

```bash
# Run all evals
npx nx run evals:run

# Run specific suite
npx nx run evals:run --suite=v4-security-foundations

# Dry run (show what would be evaluated)
npx nx run evals:run --dry-run
```

### Writing Evals

1. Create a test case in `evals/suites/<skill>/cases/`
2. Define expected behaviors in `evals/suites/<skill>/expected/`
3. Configure the suite in `eval.config.ts`

## Evaluation Dimensions

| Dimension        | Description                       | Score |
| ---------------- | --------------------------------- | ----- |
| **Accuracy**     | Correctly implements requirements | 0-1   |
| **Completeness** | Includes all required elements    | 0-1   |
| **Safety**       | No security vulnerabilities       | 0-1   |
| **Helpfulness**  | Well-documented and clear         | 0-1   |

## Suite Structure

```text
evals/suites/<skill-name>/
├── eval.config.ts      # Configuration
├── cases/              # Test prompts
│   └── basic-case.md
└── expected/           # Expected behaviors
    └── basic-case.md
```

## Next Steps

- [Writing Evals](./writing-evals) - Create your own eval cases
- [Running Evals](./running-evals) - Execute and interpret results
