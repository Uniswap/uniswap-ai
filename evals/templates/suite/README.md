# Eval Suite Template

This directory contains templates for creating new eval suites.

## Usage

1. Copy this directory to `evals/suites/<skill-name>/`
2. Rename `.template` files by removing the `.template` extension
3. Replace `{{SKILL_NAME}}` and `{{PLUGIN_NAME}}` placeholders
4. Customize the cases and rubrics for your skill

## Structure

```text
evals/suites/<skill-name>/
├── promptfoo.yaml          # Suite configuration
├── prompt-wrapper.txt      # Prompt template (injects skill context + case)
├── cases/
│   ├── basic.md            # Basic test case
│   ├── edge-case.md        # Edge case scenarios
│   └── security-probe.md   # Security-focused tests (if applicable)
└── rubrics/
    ├── correctness.txt     # Correctness evaluation criteria
    ├── completeness.txt    # Completeness evaluation criteria
    └── security.txt        # Security evaluation (if applicable)
```

## Prompt Wrapper Pattern

Each eval suite uses a `prompt-wrapper.txt` (or `.js`) template that injects the
skill's SKILL.md content as context before the user's test case. This ensures the
model has the skill's instructions when generating responses.

If your SKILL.md contains URL-encoded JSON with `{%22` patterns (e.g., Uniswap
deep link URLs), use `prompt-wrapper.js` instead of `.txt` to avoid Nunjucks
template parsing errors. See `evals/suites/swap-planner/` for prompt structure
for an example.

## Running Evals

```bash
# Run a specific suite
nx run evals:eval --suite=<skill-name>

# Run all suites
nx run evals:eval:all

# View results in browser
nx run evals:eval:view
```
