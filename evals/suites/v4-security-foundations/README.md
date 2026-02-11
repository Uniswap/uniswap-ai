# V4 Security Foundations Eval Suite

Evaluation suite for the `v4-security-foundations` skill, which provides security-first guidance for Uniswap V4 hook development.

## Overview

This suite tests the skill's ability to provide accurate, comprehensive security guidance across key V4 hook security domains:

1. **NoOp Rug Pull Attack Identification** - Understanding of the critical `beforeSwapReturnDelta` attack vector
2. **Permission Flags Risk Assessment** - Accurate risk categorization of hook permissions
3. **Delta Accounting Understanding** - Correct explanation of V4's credit/debit settlement system
4. **Access Control Patterns** - Recognition of the `msg.sender` trap and proper verification patterns
5. **Security Checklist Completeness** - Comprehensive coverage of pre-deployment security requirements
6. **Combined Vulnerability Code Review** - Multi-vulnerability detection across reentrancy, access control, and delta accounting
7. **Delta Accounting Edge Cases** - Boundary conditions, overflow handling, and safe casting in delta operations

## Architecture

This suite uses a **prompt template architecture** to mirror how skills are loaded in production. Instead of standalone test case prompts, a single `prompt-wrapper.txt` template injects skill content and reference materials into each test case via Promptfoo variable substitution.

```text
prompt-wrapper.txt          # Template: skill + references + case content
├── {{ skill_content }}     # ← SKILL.md (loaded via defaultTest.vars)
├── {{ vulnerabilities_catalog }}  # ← vulnerabilities-catalog.md
├── {{ audit_checklist }}   # ← audit-checklist.md
└── {{ case_content }}      # ← Per-test case markdown file
```

**Why this matters:** In production, the skill's SKILL.md and reference materials are loaded into the agent's context alongside the user's request. This template replicates that context structure, making evals more realistic than standalone prompts that lack skill context.

The `defaultTest.vars` in `promptfoo.yaml` sets shared variables (skill content, reference materials) once, while each test case overrides `case_content` with its specific prompt file.

## Test Cases

| Case                                    | Description                                       | Key Assertions                                                    |
| --------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `noop-rug-pull-identification.md`       | Tests understanding of NoOp attacks               | Must identify beforeSwapReturnDelta, delta mechanism, PoolManager |
| `permission-flags-risk-assessment.md`   | Tests risk categorization accuracy                | Must include CRITICAL/HIGH risk levels                            |
| `delta-accounting-understanding.md`     | Tests settlement system knowledge                 | Must explain settle, take/sync functions                          |
| `access-control-patterns.md`            | Tests access control vulnerability identification | Must explain poolManager, msg.sender trap                         |
| `security-checklist-completeness.md`    | Tests comprehensive security coverage             | Must cover reentrancy, access control                             |
| `combined-vulnerability-code-review.md` | Tests multi-vulnerability detection in code       | Must identify reentrancy, access control, and delta issues        |
| `delta-accounting-edge-cases.md`        | Tests boundary and overflow handling              | Must discuss int128, overflow/bounds, validation                  |

## Rubrics

All rubrics use `.txt` extension as required by Promptfoo's grader.

| Rubric                                 | Threshold | Purpose                                         |
| -------------------------------------- | --------- | ----------------------------------------------- |
| `noop-attack-understanding.txt`        | 0.9       | Critical attack vector - high accuracy required |
| `risk-assessment-quality.txt`          | 0.85      | Risk categorization accuracy                    |
| `delta-accounting-accuracy.txt`        | 0.85      | Technical correctness of settlement explanation |
| `access-control-correctness.txt`       | 0.85      | Vulnerability identification and patterns       |
| `checklist-completeness.txt`           | 0.8       | Breadth of security coverage                    |
| `combined-vulnerability-detection.txt` | 0.85      | Multi-vulnerability identification in code      |
| `delta-edge-case-handling.txt`         | 0.85      | Boundary conditions and safe casting            |

## Running

```bash
# Run this suite
nx run evals:eval --suite=v4-security-foundations

# View results
nx run evals:eval:view
```

## Notes

- This skill is documentation-focused, so evals test advice quality rather than code generation
- Security accuracy is critical - the skill helps developers avoid fund-loss vulnerabilities
- All thresholds are set high due to the security-critical nature of the guidance
