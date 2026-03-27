# V4 Hook Generator Eval Suite

Evaluation suite for the `v4-hook-generator` skill, which guides agents through generating
Uniswap v4 hook contracts via the OpenZeppelin Contracts Wizard MCP tool.

## Overview

This suite tests the skill's ability to provide accurate, actionable hook generation guidance
across four key areas:

1. **Hook Type Selection** — Choosing the correct base hook type from the 14-row decision table
   given a user's stated goal (e.g., dynamic fees, MEV protection, limit orders)
2. **MCP Tool Call Generation** — Producing a valid, complete MCP JSON object with all required
   fields populated correctly for a given use case
3. **Permission Configuration** — Selecting the minimal set of permissions for a `beforeSwap`
   hook and explaining the address encoding implication
4. **Shares and Access Control** — Explaining the ERC20/ERC6909/ERC1155/false shares options and
   the ownable/roles/managed access control options with correct trade-offs

## Architecture

This suite uses a **prompt template architecture** to mirror how skills are loaded in production.
A single `prompt-wrapper.txt` template injects the skill content into each test case via Promptfoo
variable substitution.

```text
prompt-wrapper.txt        # Template: skill + case content
├── {{ skill_content }}   # ← SKILL.md (loaded via defaultTest.vars)
└── {{ case_content }}    # ← Per-test case markdown file
```

**Why this matters:** In production, the skill's SKILL.md is loaded into the agent's context
alongside the user's request. This template replicates that context structure, making evals more
realistic than standalone prompts that lack skill context.

The `defaultTest.vars` in `promptfoo.yaml` sets the shared `skill_content` variable once, while
each test overrides `case_content` with its specific prompt file.

## Test Cases

| Case                           | Description                                            | Key Assertions                                             |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------- |
| `hook-type-selection.md`       | Select correct hook type for dynamic LP fees           | Must name a valid hook type from the decision table        |
| `mcp-tool-call-generation.md`  | Generate a complete MCP JSON for a MEV protection hook | Must include `"hook"`, `"permissions"`, `"access"` fields  |
| `permission-configuration.md`  | Configure minimal permissions for beforeSwap logic     | Must mention `beforeSwap` and address encoding / HookMiner |
| `shares-and-access-control.md` | Explain shares and access control options              | Must cover ERC20/ERC6909/ERC1155 and ownable/roles/managed |

## Rubrics

All rubrics use `.txt` extension as required by Promptfoo's grader.

| Rubric                           | Threshold | Purpose                                                   |
| -------------------------------- | --------- | --------------------------------------------------------- |
| `hook-type-accuracy.txt`         | 0.9       | Correct hook type selection — wrong type = wrong output   |
| `mcp-schema-correctness.txt`     | 0.9       | MCP JSON must be valid and all required fields present    |
| `configuration-completeness.txt` | 0.85      | All 6 decision checklist items addressed in configuration |

## Running

```bash
# Run this suite (with Nx caching)
nx run eval-suite-v4-hook-generator:eval

# Run this suite (skip cache)
nx run eval-suite-v4-hook-generator:eval --skip-nx-cache

# View results
nx run evals:eval:view
```

## Notes

- This skill is code-generation focused, so evals test configuration accuracy and schema
  correctness rather than prose quality alone
- Hook type accuracy has the highest threshold (0.9) — selecting the wrong base type leads to
  fundamentally incorrect generated code
- The MCP schema correctness threshold is also 0.9 — the generated JSON must be immediately
  usable without manual correction
- Security cross-reference: test cases check that the skill correctly reminds the agent to invoke
  `v4-security-foundations` before deployment
