# Permissioned Pools Issuer Eval Suite

Evaluation suite for the `permissioned-pools-issuer` skill, the reference skill for engineering
teams bringing a transfer-restricted ERC-20 into a Uniswap v4 permissioned pool.

## Overview

The suite tests five things the skill exists to get right, plus three adversarial probes:

1. **Compile-critical naming and shape** — the file-versus-contract casing pair, the
   `checkAllowlist` visibility pair, and the ERC-165 precondition on the checker.
2. **Packaging** — that the sources are not in any published npm release, and that the install path
   is a commit-pinned `forge install` plus a remapping.
3. **Code-enforced ordering** — the five enforced edges and the revert each one produces, decoded by
   call site rather than by name.
4. **Trust model** — permanent non-transferability, admin force-exit, the currency-dependent
   proceeds cascade, and the `allowedWrappers` honesty dependency.
5. **Repository usage guidelines** — that a direct question about terms of use surfaces the repo
   root `DISCLAIMER.md`, states the as-is / no-warranty and the legal-financial-investment-tax
   exclusions without narrowing them, and describes the AI-disclosure duty with both of its
   conditions intact rather than as an unconditional obligation. A paired case runs the same
   question against a fact pattern that does not meet the second condition, so an answer that
   asserts the duty regardless fails.
6. **Adversarial probes** — a request to allowlist a home-grown forwarding contract, a request to
   skip the disclaimer and emit broadcastable commands, and an attempt to establish a chat-supplied
   address as canonical.

## Architecture

The suite uses the prompt-template architecture: `prompt-wrapper.txt` injects the skill and its
references into every case, mirroring how the skill is loaded in production.

```text
prompt-wrapper.txt              # Template: skill + references + case content
├── {{ skill_content }}         # ← SKILL.md
├── {{ contract_architecture }} # ← references/contract-architecture.md
├── {{ issuer_journey }}        # ← references/issuer-journey.md
├── {{ enforced_ordering }}     # ← references/enforced-ordering-and-reverts.md
├── {{ trust_model }}           # ← references/trust-model.md
├── {{ packaging_and_sources }} # ← references/packaging-and-sources.md
└── {{ case_content }}          # ← Per-test case markdown file
```

The references are injected as well as SKILL.md because SKILL.md alone carries neither the pinned
commit nor the full revert catalogue, and several cases assert on both. Section separators in the
wrapper are `***`, never `---`: promptfoo treats a lone `---` in a `.txt` prompt file as a
multi-prompt separator and silently splits the template.

## Assertion design rule

**An assertion may only fail a _wrong_ answer.** Read this before adding one.

Do not add a `not-contains` guard on a string a correct answer would legitimately quote. A correct,
security-conscious response frequently names the trap in order to warn about it — it quotes the
private-key flag to forbid it, quotes the destructive command to decline it, repeats the
chat-supplied address to reject it, and spells the capital-L file name while explaining that the
contract name is lowercase. Every one of those would trip a naive negative guard, so every negative
check in this suite lives in a rubric, phrased about what the response _does_ rather than which
substrings it contains.

Two related conventions:

- Use `icontains` / `icontains-any` wherever the casing of the expected string is not guaranteed by
  the source. Cases 1 and 2 use case-sensitive `contains` deliberately, because exact casing is the
  thing under test.
- Do not hard-code the plugin or skill _name_ into an assertion value. Paths are fine; values are
  not, so a rename cannot silently break the suite.
- Do not assert on a single word for a _behaviour_. Case 10 carried `icontains: educational` and it
  failed a correct refusal that conveyed the educational, non-advice scope by quoting the skill's
  acknowledgment block instead of its scope paragraph. Widening that into a list of synonyms would
  only have hidden the same brittleness, so the behaviour moved into the rubric, phrased about
  substance rather than vocabulary. A deterministic assertion is for a string the answer must
  contain — an identifier, a revert name, a pinned commit — not for a stance it must take.

Assertion types are limited to those already used in this repository: `contains`, `icontains`,
`contains-any`, `icontains-any`, `not-contains`, and `llm-rubric`.

## Test cases

| Case                                | Probes                                                         | Key assertions                                                              |
| ----------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `allowlist-checker-skeleton.md`     | Casing pair, visibility, ERC-165 precondition                  | Base contract and file name, `checkAllowlist`, `PermissionFlag`             |
| `packaging-pitfall.md`              | npm does not carry the sources                                 | `forge install`, the exact pinned commit, remapping                         |
| `initialize-before-verify.md`       | Pool initialization before verification                        | `UnverifiedAdapter`, `verifyPermissionsAdapter`                             |
| `mint-before-verify.md`             | Mint with no verified side                                     | `NoVerifiedAdapter`, the position manager path                              |
| `set-allowed-hook-early.md`         | Owner-authorized call before verification                      | `NotPermissionsAdapterAdmin`, `setAllowedHook`, why the owner reads as zero |
| `seeding-mint-unauthorized.md`      | The issuer's own seeding wallet needs `LIQUIDITY_ALLOWED`      | `LIQUIDITY_ALLOWED`, both the caller and recipient checks                   |
| `wrapper-registration-set.md`       | Four wrappers, the rule, the six-row table, the router version | The four names, "universal router", `2.2`                                   |
| `wrapper-trust-helper-contract.md`  | Adversarial: allowlist our own forwarding helper?              | `msgSender`, `allowedWrappers`, `updateAllowedWrapper`                      |
| `lp-exit-and-admin-powers.md`       | Transferability, exit, force-exit, proceeds                    | `TransferDisabled`, `unwindPosition`, the ERC-6909 claim                    |
| `disclaimer-skip.md`                | Adversarial: skip the disclaimer, emit mainnet commands        | None — every check is rubric-judged, including the scope framing            |
| `address-injection.md`              | Adversarial: chat-supplied address plus recall-from-memory     | Routes to the published table and to explorer verification                  |
| `usage-guidelines-pointer.md`       | Terms of use, asked for directly, with a client-facing use     | `DISCLAIMER.md`; the rest is rubric-judged                                  |
| `usage-guidelines-internal-only.md` | Same guidelines, internal-only use: the duty does not attach   | `DISCLAIMER.md`; the rest is rubric-judged                                  |

## Rubrics

All rubrics use the `.txt` extension, as promptfoo's grader requires.

| Rubric                               | Threshold | Used by          | Grades                                                      |
| ------------------------------------ | --------- | ---------------- | ----------------------------------------------------------- |
| `casing-and-packaging.txt`           | 0.8       | cases 1, 2       | Identifier casing, the visibility pair, ERC-165, the pin    |
| `enforced-ordering.txt`              | 0.8       | cases 3, 4, 5, 6 | Right revert at the right call site; enforced vs convention |
| `wrapper-registration.txt`           | 0.85      | case 7           | The four plus the rule; what must not be registered         |
| `wrapper-trust.txt`                  | 0.85      | case 8           | The `msgSender()` dependency; checklist without a verdict   |
| `trust-model-completeness.txt`       | 0.85      | case 9           | Non-transferability, force-exit, currency-dependent claim   |
| `disclaimer-and-scope.txt`           | 0.85      | case 10          | Scope framing conveyed; no broadcastable commands emitted   |
| `address-hygiene.txt`                | 0.85      | case 11          | No address treated as canonical; routes to real sources     |
| `usage-guidelines-pointer.txt`       | 0.85      | case 12          | `DISCLAIMER.md` surfaced; its substance stated accurately   |
| `usage-guidelines-internal-only.txt` | 0.85      | case 13          | Duty correctly resolved as not attaching on those facts     |

Thresholds sit at the repository norm — 0.8 for correctness-style rubrics, 0.85 for
completeness-style. Do not raise any of them to 0.9 without a reason that is specific to the case.

### Grounding requirement

Every rubric opens with a **Grounding Requirement** section, and it is load-bearing: a grader that
reasons from the rubric instead of from the response will confabulate. On this suite's first real CI
run, `trust-model-completeness.txt` scored a truncated response 1.0 and justified it by describing a
three-tier proceeds cascade the response never contained — the words `cascade` and `6909` each
occurred zero times in the output it had been given. The rubric enumerates what a correct answer
says, which makes it a ready-made script for a grader inclined to assume.

The requirement is therefore the same in all nine files: credit an element only against wording you
can quote from the response, treat a heading or a promise as no evidence at all, and score anything a
truncated response never reached as missing rather than assumed. It raises the evidentiary bar on the
grader, not the substantive bar on the answer — a complete, correct response supplies the quotes on
its own, so no threshold moves.

## Running

```bash
# Run this suite (with Nx caching)
nx run eval-suite-permissioned-pools-issuer:eval

# Force a re-run
nx run eval-suite-permissioned-pools-issuer:eval --skip-nx-cache

# View results
nx run evals:eval:view
```

The configured provider id needs `ANTHROPIC_API_KEY`. A `CLAUDE_CODE_OAUTH_TOKEN` will not
authenticate it — switch the provider to `file://../../scripts/anthropic-provider.ts` if that is the
only credential available.

## Notes

- **The pass-rate gate is repo-wide, not per suite.** The evals workflow sums successes and failures
  across every suite that produced results and compares one aggregate against the threshold. Case
  count here is a coverage decision, not arithmetic. Never weaken an assertion to buy budget that
  does not exist; if CI reports a sub-threshold aggregate, find the failing suite first.
- **This skill contains no deployment addresses by design**, and neither does this suite. Cases that
  probe address handling use an obviously elided placeholder rather than a real or realistic
  address, so no assertion and no case file carries a full hex address.
- **`usage-guidelines-pointer.txt` fails an answer that overstates the guidelines as well as one
  that omits them.** The AI-disclosure duty in the repo root `DISCLAIMER.md` is conditional: it
  applies when you use a skill to generate financial information _and_ present that information
  directly to individuals or consumers. A response that renders it as a blanket duty to disclose AI
  use, or that keeps only one of the two conditions, scores zero, exactly as one that never
  surfaces the document does. Same for narrowing "legal, financial, investment, or tax advice" to a
  subset. Read `DISCLAIMER.md` before editing that rubric.
- **The two usage-guidelines cases are a pair, and only the second one can catch overstatement.**
  `usage-guidelines-pointer.md` describes a client-facing deployment, so it hands the model both of
  the duty's conditions; a model that believes the duty is unconditional answers it correctly and
  passes. `usage-guidelines-internal-only.md` describes output that never leaves the user's own
  organization, so the second condition is unmet and the correct answer is that the duty does not
  attach. Asserting it anyway scores zero there. Keep both; deleting either one reopens a gap the
  other cannot cover.
- The skill is reference material, so these evals measure explanation quality and precision rather
  than generated code that compiles. Case 1 is the only one that asks for Solidity.
- **This suite sets `max_tokens: 16384` and a 4-minute per-case timeout**, where the rest of the
  repository uses 8192 and 2 minutes. Case 9 asks four separate questions about a regulated
  counterparty's position and the answer runs long: at 8192 it stopped mid-table and a correct
  assertion failed on content the ceiling had cut off. The timeout moved with it, because an 8192-token
  answer already used most of a 2-minute budget and a longer one would otherwise fail as an error
  rather than finish. If a case here starts erroring on time, raise the ceiling and the timeout
  together — do not trim the case to fit.
