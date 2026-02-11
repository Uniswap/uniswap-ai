# V4 Security Foundations Eval Suite

Evaluation suite for the `v4-security-foundations` skill, which provides security-first guidance for Uniswap V4 hook development.

## Overview

This suite tests the skill's ability to provide accurate, comprehensive security guidance across key V4 hook security domains:

1. **NoOp Rug Pull Attack Identification** - Understanding of the critical `beforeSwapReturnDelta` attack vector
2. **Permission Flags Risk Assessment** - Accurate risk categorization of hook permissions
3. **Delta Accounting Understanding** - Correct explanation of V4's credit/debit settlement system
4. **Access Control Patterns** - Recognition of the `msg.sender` trap and proper verification patterns
5. **Security Checklist Completeness** - Comprehensive coverage of pre-deployment security requirements

## Test Cases

| Case                                  | Description                                       | Key Assertions                                                    |
| ------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `noop-rug-pull-identification.md`     | Tests understanding of NoOp attacks               | Must identify beforeSwapReturnDelta, delta mechanism, PoolManager |
| `permission-flags-risk-assessment.md` | Tests risk categorization accuracy                | Must include CRITICAL/HIGH risk levels                            |
| `delta-accounting-understanding.md`   | Tests settlement system knowledge                 | Must explain settle, take/sync functions                          |
| `access-control-patterns.md`          | Tests access control vulnerability identification | Must explain poolManager, msg.sender trap                         |
| `security-checklist-completeness.md`  | Tests comprehensive security coverage             | Must cover reentrancy, access control                             |

## Rubrics

All rubrics use `.txt` extension as required by Promptfoo's grader.

| Rubric                           | Threshold | Purpose                                         |
| -------------------------------- | --------- | ----------------------------------------------- |
| `noop-attack-understanding.txt`  | 0.9       | Critical attack vector - high accuracy required |
| `risk-assessment-quality.txt`    | 0.85      | Risk categorization accuracy                    |
| `delta-accounting-accuracy.txt`  | 0.85      | Technical correctness of settlement explanation |
| `access-control-correctness.txt` | 0.85      | Vulnerability identification and patterns       |
| `checklist-completeness.txt`     | 0.8       | Breadth of security coverage                    |

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
