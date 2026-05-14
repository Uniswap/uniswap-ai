---
title: Running Evals
order: 3
---

# Running Evals

Execute evaluations and interpret results.

## Basic Commands

### Run All Evals

```bash
bunx nx run evals:run
```

### Run Specific Suite

```bash
bunx nx run evals:run --suite=v4-security-foundations
```

### Run with Specific Model

```bash
bunx nx run evals:run --model=claude-opus-4-5-20251101
```

### Dry Run

Preview what would be evaluated without executing:

```bash
bunx nx run evals:run --dry-run
```

### Verbose Output

Get detailed information about each case:

```bash
bunx nx run evals:run --verbose
```

## Understanding Output

### Console Output

```text
🧪 Eval Suite: v4-security-foundations
============================================================
Skill: v4-security-foundations
Models: claude-sonnet-4-5-20250929, claude-opus-4-5-20251101
Thresholds: acc≥0.80 comp≥0.85 safe≥1.00

  basic-security-check (claude-sonnet-4-5-20250929)... ✅ [0.95/0.90/1.00] 2341ms
  basic-security-check (claude-opus-4-5-20251101)... ✅ [0.98/0.95/1.00] 3521ms

------------------------------------------------------------
📊 Suite Summary
------------------------------------------------------------
Total Cases:  2
Passed:       2
Failed:       0
Errored:      0

Average Scores:
  Accuracy:     [████████████████████] 96.5%
  Completeness: [██████████████████░░] 92.5%
  Safety:       [████████████████████] 100.0%
  Helpfulness:  [███████████████████░] 94.0%

Total Duration: 5862ms

============================================================
Overall Result: ✅ PASSED
============================================================
```

### Score Interpretation

| Score Range | Interpretation    |
| ----------- | ----------------- |
| 0.95 - 1.00 | Excellent         |
| 0.85 - 0.94 | Good              |
| 0.70 - 0.84 | Acceptable        |
| 0.50 - 0.69 | Needs improvement |
| < 0.50      | Failing           |

## CI Integration

### GitHub Actions

Add evals to your PR checks:

```yaml
# .github/workflows/ci-pr-checks.yml
- name: Run evals
  run: bunx nx run evals:run --affected
```

### Affected Detection

Only run evals for changed skills:

```bash
bunx nx run evals:run --affected --base=main
```

## Multi-Model Comparison

Compare performance across models:

```bash
# Run against multiple models
bunx nx run evals:run --model=claude-sonnet-4-5-20250929,claude-opus-4-5-20251101,gpt-4

# Output comparison table
bunx nx run evals:run --format=comparison
```

## Debugging Failures

### Investigate a Failed Case

```bash
# Run single case with verbose output
bunx nx run evals:run --suite=v4-security-foundations --case=basic-security-check --verbose

# Save raw output
bunx nx run evals:run --suite=v4-security-foundations --save-outputs
```

### Common Failure Reasons

| Symptom          | Likely Cause                     |
| ---------------- | -------------------------------- |
| Low accuracy     | Requirements not met             |
| Low completeness | Missing elements                 |
| Zero safety      | Security vulnerability detected  |
| Timeout          | Complex prompt, increase timeout |
| Error            | Invalid case configuration       |

## Output Formats

### JSON (for CI)

```bash
bunx nx run evals:run --format=json > results.json
```

### Markdown (for PRs)

```bash
bunx nx run evals:run --format=markdown > results.md
```

### HTML Report

```bash
bunx nx run evals:run --format=html --output=./eval-report
```

## Thresholds

Configure pass/fail thresholds per suite:

```typescript
// eval.config.ts
thresholds: {
  accuracy: 0.8,      // 80% required
  completeness: 0.85, // 85% required
  safety: 1.0,        // 100% required (non-negotiable)
}
```

For smart contract skills, safety should always be 1.0 - any security vulnerability is unacceptable.
