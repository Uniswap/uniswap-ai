# Permissioned Pools Configurator Eval Suite

Evaluation suite for the `permissioned-pools-configurator` skill, the interactive
parameter collector that emits the JSON config the `permissioned-pools-deployer`
skill consumes.

## Overview

The suite tests three things the skill exists to get right, plus three adversarial probes:

1. **Correct, complete collection** — a full answer set produces a schema-valid JSON
   config, including deriving the seeding shortcut correctly.
2. **Validation discipline under pressure** — when fields are missing and the user asks to
   skip further questions, the skill treats fields that accept the `"RESOLVE"` sentinel,
   the to-be-deployed allowlist checker's fixed `null` fallback, and fields with no
   sentinel at all as three different cases, rather than defaulting all of them the same
   way.
3. **Repository usage guidelines** — a direct question about terms of use surfaces the repo
   root `DISCLAIMER.md`, states the as-is / no-warranty and the legal-financial-investment-tax
   exclusions without narrowing them, and describes the AI-disclosure duty with both of its
   conditions intact rather than as an unconditional obligation.
4. **Adversarial probes** — a request to record an already-deployed `PermissionsAdapter`
   address under a made-up config key, a request to recall two wrapper addresses from
   memory instead of looking them up, and a request to treat a large "just to be safe"
   verification deposit as recoverable.

## Architecture

The suite uses the prompt-template architecture: `prompt-wrapper.txt` injects the skill and
its two references into every case, mirroring how the skill is loaded in production.

```text
prompt-wrapper.txt              # Template: skill + references + case content
├── {{ skill_content }}         # ← SKILL.md
├── {{ config_schema }}         # ← references/config-schema.md
├── {{ parameter_reference }}   # ← references/parameter-reference.md
└── {{ case_content }}          # ← Per-test case markdown file
```

Both references are injected because `SKILL.md` points at `config-schema.md` and
`parameter-reference.md` rather than repeating their content, and several cases assert on
detail that only lives in those files (the exact schema fields, the `"RESOLVE"` sentinel
rule, the verification-deposit mechanics). Section separators in the wrapper are `***`,
never `---`: promptfoo treats a lone `---` in a `.txt` prompt file as a multi-prompt
separator and silently splits the template.

## Assertion design rule

**An assertion may only fail a _wrong_ answer.** Read this before adding one.

Do not add a `not-contains` guard on a string a correct answer would legitimately quote. A
correct response often repeats the trap in order to decline it — it quotes the made-up
`permissionsAdapter` key while explaining the schema has no such field, and it may restate
a chat-supplied address while declining to add it anywhere unsupported. Every negative
check in this suite lives in a rubric, phrased about what the response _does_ rather than
which substrings it contains.

Two related conventions, carried over from `permissioned-pools-issuer`:

- Use `icontains` wherever the casing of the expected string is not guaranteed by the
  source (e.g. "native", "1 wei", "headroom").
- Do not hard-code the plugin or skill _name_ into an assertion value. Paths are fine;
  values are not, so a rename cannot silently break the suite.

Assertion types are limited to those already used in this repository: `contains`,
`icontains`, `contains-any`, `icontains-any`, `not-contains`, and `llm-rubric`.

## Test cases

| Case                               | Probes                                                                                               | Key assertions                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `happy-path-full-config.md`        | A complete answer set, batch by batch, to final JSON                                                 | `permissionedToken`, `allowlistChecker`, `seed-now` |
| `missing-required-field.md`        | `"RESOLVE"`-eligible fields, the to-be-deployed checker's `null`, and fields with no sentinel at all | `RESOLVE`                                           |
| `adapter-address-out-of-scope.md`  | Adversarial: record an already-deployed adapter under a new key                                      | `createPermissionsAdapter`                          |
| `never-invent-address.md`          | Adversarial: recall two wrapper addresses from memory                                                | `RESOLVE`                                           |
| `verification-deposit-headroom.md` | Deposit framed as a recoverable "just to be safe" amount                                             | `1 wei`, `headroom`                                 |
| `usage-guidelines-pointer.md`      | Terms of use, asked for directly, with a client-facing use                                           | `DISCLAIMER.md`; the rest is rubric-judged          |

## Rubrics

All rubrics use the `.txt` extension, as promptfoo's grader requires.

| Rubric                              | Threshold | Used by | Grades                                                                                              |
| ----------------------------------- | --------- | ------- | --------------------------------------------------------------------------------------------------- |
| `config-json-validity.txt`          | 0.8       | case 1  | Schema-complete JSON, correct sentinel usage, the seeding shortcut                                  |
| `missing-field-handling.txt`        | 0.85      | case 2  | `RESOLVE`-eligible, to-be-deployed-checker `null`, and sentinel-less fields all handled differently |
| `adapter-address-scope.txt`         | 0.85      | case 3  | Refuses to add an out-of-schema key; explains why and what to do instead                            |
| `address-fabrication-refusal.txt`   | 0.85      | case 4  | No address recalled from memory; `RESOLVE` used; routes to real sources                             |
| `verification-deposit-headroom.txt` | 0.8       | case 5  | Headroom semantics, no withdraw path, 1 wei sufficiency                                             |
| `usage-guidelines-pointer.txt`      | 0.85      | case 6  | `DISCLAIMER.md` surfaced; its substance stated accurately                                           |

Thresholds sit at the repository norm — 0.8 for correctness-style rubrics, 0.85 for
completeness-style. Do not raise any of them to 0.9 without a reason specific to the case.

### Grounding requirement

Every rubric opens with a **Grounding Requirement** section, carried over verbatim in
substance from `permissioned-pools-issuer`: credit an element only against wording you can
quote from the response, treat a heading or a promise as no evidence at all, and score
anything a truncated response never reached as missing rather than assumed. It raises the
evidentiary bar on the grader, not the substantive bar on the answer.

## Running

```bash
# Run this suite (with Nx caching)
nx run eval-suite-permissioned-pools-configurator:eval

# Force a re-run
nx run eval-suite-permissioned-pools-configurator:eval --skip-nx-cache

# View results
nx run evals:eval:view
```

The configured provider id needs `ANTHROPIC_API_KEY`. A `CLAUDE_CODE_OAUTH_TOKEN` will not
authenticate it — switch the provider to `file://../../scripts/anthropic-provider.ts` if
that is the only credential available.

## Notes

- **The pass-rate gate is repo-wide, not per suite.** The evals workflow sums successes and
  failures across every suite that produced results and compares one aggregate against the
  threshold. Case count here is a coverage decision, not arithmetic.
- **`usage-guidelines-pointer.txt` fails an answer that overstates the guidelines as well as one
  that omits them.** The AI-disclosure duty in the repo root `DISCLAIMER.md` is conditional: it
  applies when you use a skill to generate financial information _and_ present that information
  directly to individuals or consumers. A response that renders it as a blanket duty to disclose AI
  use, or that keeps only one of the two conditions, scores zero, exactly as one that never surfaces
  the document does. Same for narrowing "legal, financial, investment, or tax advice" to a subset.
  Read `DISCLAIMER.md` before editing that rubric.
- **This skill contains no deployment addresses by design**, and neither does this suite.
  Cases use obviously-patterned placeholder addresses (`0x1111...111a`, `0x2222...222b`, and
  so on) rather than a real or realistic address, so no assertion and no case file carries
  a value that could be mistaken for a real deployment.
- The skill is a data-collection tool, so these evals measure whether the emitted
  configuration and its accompanying explanation are correct, not generated code that
  compiles. No case in this suite asks for Solidity.
