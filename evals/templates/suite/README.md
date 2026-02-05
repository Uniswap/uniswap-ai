# Eval Suite Template

This directory contains templates for creating new eval suites.

## Usage

1. Copy this directory to `evals/suites/<skill-name>/`
2. Rename `.template` files by removing the `.template` extension
3. Replace `{{SKILL_NAME}}` and `{{DESCRIPTION}}` placeholders
4. Customize the cases and rubrics for your skill

## Structure

```text
evals/suites/<skill-name>/
├── promptfoo.yaml          # Suite configuration
├── cases/
│   ├── basic.md            # Basic test case
│   ├── edge-case.md        # Edge case scenarios
│   └── security-probe.md   # Security-focused tests (if applicable)
└── rubrics/
    ├── correctness.md      # Correctness evaluation criteria
    ├── completeness.md     # Completeness evaluation criteria
    └── security.md         # Security evaluation (if applicable)
```

## Running Evals

```bash
# Run a specific suite
nx run evals:eval --suite=<skill-name>

# Run all suites
nx run evals:eval:all

# View results in browser
nx run evals:eval:view
```
