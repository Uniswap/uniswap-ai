# CI/CD Workflows

This directory contains GitHub Actions workflows for the uniswap-ai repository. The workflows are designed to validate PRs, automate code reviews, and publish packages.

## Workflow Overview

| Workflow                                            | Trigger              | Purpose                                      |
| --------------------------------------------------- | -------------------- | -------------------------------------------- |
| [PR Checks](#pr-checks)                             | PR events            | Build, lint, test, validate plugins & skills |
| [Check PR Title](#check-pr-title)                   | PR events            | Enforce conventional commit format           |
| [Generate Documentation](#generate-documentation)   | Push to main, manual | Auto-generate API documentation              |
| [Publish Packages](#publish-packages)               | Push to main, manual | Publish npm packages                         |
| [Evals](#evals)                                     | PR events, manual    | LLM evaluation of AI skills                  |
| [GitHub Actions Analysis](#github-actions-analysis) | Push to main, PRs    | Security analysis & syntax validation        |

## Workflows

### PR Checks

**File:** `ci-pr-checks.yml`

Core CI validation workflow that runs on all PRs:

- Validates `bun.lock` is in sync via `bun install --frozen-lockfile`
- Builds affected packages with Nx
- Runs linting and formatting checks
- Lints documentation prose in `docs/` with Vale
- Executes test suites with coverage
- Validates plugin configurations
- Validates skills (frontmatter, consistency with plugin.json)
- Validates documentation pages exist for all plugins and skills

Automated PRs (dependabot, releases) may skip certain checks.

### Check PR Title

**File:** `ci-check-pr-title.yml`

Enforces conventional commit format for PR titles using [semantic-pull-request](https://github.com/amannn/action-semantic-pull-request). Requires scope (e.g., `feat(hooks):`, `fix(ci):`).

### Generate Documentation

**File:** `generate-docs.yml`

Automatically generates API documentation using TypeDoc:

- Triggers on push to main when TypeScript files in `evals/framework/**` or `packages/**` change
- Also accepts `typedoc.json` changes and manual workflow_dispatch triggers
- Runs `bunx nx run docs:generate-api-docs` to generate documentation
- Auto-commits generated docs to `docs/api/**` with `[skip ci]` flag
- Skips execution if commit message starts with `docs: auto-generate` to prevent loops
- Uses concurrency controls to prevent overlapping doc generation

### Deploy Documentation

Documentation is deployed via [Vercel](https://vercel.com) (not GitHub Actions). Vercel's GitHub integration automatically:

- Deploys to production on push to `main` when `docs/` changes
- Creates preview deployments for every PR
- Build command: `bunx nx run docs:build`

Configuration is in `vercel.json` at the repo root.

### Publish Packages

**File:** `publish-packages.yml`

Handles npm package publishing:

- **Auto mode** (push to main): Detects affected packages, publishes with `latest` tag
- **Force mode** (manual): Publishes specified packages with `next` tag and prerelease versions

### Evals

**File:** `evals.yml`

LLM-based evaluation of AI skills using [Promptfoo](https://github.com/promptfoo/promptfoo):

- Runs on PRs that modify `packages/plugins/**`, `evals/**`, or `evals.yml`
- **Per-suite Nx projects**: Each eval suite is its own Nx project (`eval-suite-<name>`) with `implicitDependencies` on its corresponding plugin and the `evals` project
- Uses `nx affected -t eval` to run only suites whose plugin or eval dependencies changed
- **Selection ignores lockfiles.** On a PR the workflow computes the changed-file list itself (`git diff origin/$BASE_REF...HEAD`, with `BASE_REF` similarly shape-validated to `SUITE_INPUT`, though its pattern additionally allows `.` and `/`), drops root lockfiles (`bun.lock`, `bun.lockb`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`), and passes what remains to Nx as `--files=` on **both** `nx show projects --affected` and `nx affected`. Nx otherwise treats any lockfile edit as invalidating every project, so a six-line workspace registration selected all 16 suites and exhausted the provider rate limit on [#121](https://github.com/Uniswap/uniswap-ai/pull/121). No suite declares a lockfile as an input, so the cache already treated lockfile edits as irrelevant; this makes selection agree with the inputs the suites declare. Trade-off: a dependency-only bump no longer triggers evals. Changes under `evals/**` still do, and `workflow_dispatch` still runs everything.
- **Both commands share one file list.** If selection and execution derived their file sets separately they could disagree, and the `SUITES_RAN < SELECTED_COUNT` guard would then fail the job over a suite that was never meant to run.
- **An _unexpected_ zero-suite selection fails loudly.** An unresolvable base ref, a failed `git diff`, a changed path containing a comma (which Nx's comma-separated `--files` cannot represent), or a crashing Nx probe all abort with `::error::`, because an empty list is otherwise indistinguishable from "nothing to test" and would green the eval job on every PR. The one zero-suite path that is _deliberately_ a silent green is a lockfile-only PR (dependabot shape): nothing any suite declares as an input changed, so there is genuinely nothing to run.
- Selection is filtered in this workflow rather than via Nx's own `pluginsConfig["@nx/js"].projectsAffectedByDependencyUpdates`. That knob would work, but it changes affected-selection for **every** target in the workspace (build, lint, typecheck), whereas the bug is confined to the eval job. Narrower blast radius was the deliberate choice.
- A change to `evals.yml` alone selects **no** suites, since no suite declares the workflow as an input. Verify changes to this selection logic against a PR that also touches a skill.
- Nx compares suite inputs (config, cases, rubrics, skill files, and shared eval infra) against its cache
- If inputs haven't changed, Nx restores the cached `results.json` without making LLM API calls
- **Persistent Nx cache**: Uses split `cache/restore` + `cache/save` (with `if: always()`) so cache is preserved even when the job fails
- Aggregates pass/fail across affected suites; requires ≥85% pass rate
- Manual trigger supports: specific suite (`nx run eval-suite-<name>:eval`), skip cache, multi-model mode

**Node version:** promptfoo refuses to start on a runtime outside its `engines`
range (`^20.20.0 || >=22.22.0`), so `vars.NODE_VERSION` has to stay at or above
that floor (see [Repository Variables](#repository-variables)).

**better-sqlite3 native binding:** installs use `--ignore-scripts` so a PR cannot
get code execution out of this repo's own `prepare` script in a job that holds
`ANTHROPIC_API_KEY`. That flag also suppresses builds for packages bun would
otherwise trust by default, so promptfoo's `better-sqlite3` dependency arrives
without its compiled binding and promptfoo dies in `getDb()` during startup. A
`Build better-sqlite3 native binding` step builds that single package after
install, which keeps `--ignore-scripts` in place. Removing the flag instead would
fix the binding and reopen the script-execution hole, so prefer the targeted
build.

Both of the above are smoke-tested by a `Verify promptfoo can run on this Node`
preflight that runs `promptfoo --version` before any suite is dispatched.
promptfoo's startup touches both the runtime check and the database, so this one
cheap command fails the job immediately instead of letting the same abort repeat
once per suite deep inside the Nx log.

**Errored cases are gated separately from the pass rate.** promptfoo counts a case
that never produced a verdict (rate limit, provider outage, broken suite config)
as an `error`, not a `failure`. Errors land in neither side of the
`successes / (successes + failures)` pass rate, so a suite where every case errors
contributes `0` to both and drops out of the denominator completely. A full
15-suite run hit exactly this: 31 rate-limited cases across three suites reported
an 89.86% pass rate and a green job. The workflow now sums errors, shows them in
the summary table, and fails on any non-zero count, so an incomplete measurement
can never read as a good one. Rate-limit errors are the most likely cause when
running many suites at once; re-run rather than lowering the threshold.

**Distinguishing "no suites ran" from "every suite crashed":** the Nx invocation
is deliberately `|| true`, because promptfoo also exits non-zero for ordinary
assertion failures, which the ≥85% pass-rate threshold is what gates. That means
Nx's exit code cannot tell a crash from a low score. So the workflow enumerates
the suites Nx will select (`nx show projects`) before running them, and fails if
any selected suite produced no `results.json`. A suite that wrote no output died
before it could be scored, which is an infrastructure failure rather than a low
score. Without that comparison, a run where every suite crashed looks exactly
like a run where no suite was affected, and the job reports success.

### GitHub Actions Analysis

**File:** `zizmor.yml`

Validates GitHub Actions workflows for security and syntax correctness:

- **zizmor**: Static security analysis using [zizmor](https://github.com/zizmorcore/zizmor) — scans for template injection, credential leakage, permission scope issues
- **actionlint**: Syntax validation using [actionlint](https://github.com/rhysd/actionlint) — catches YAML syntax errors, invalid event types, type errors, and expression issues
- Runs on push to main and all PRs
- Reports findings as GitHub annotations on PRs

## Required Secrets

| Secret                            | Purpose                            | Required By                     |
| --------------------------------- | ---------------------------------- | ------------------------------- |
| `ANTHROPIC_API_KEY`               | Anthropic API authentication       | Evals                           |
| `CLAUDE_CODE_OAUTH_TOKEN`         | Claude AI authentication           | Evals                           |
| `WORKFLOW_PAT`                    | Push commits/tags, branch creation | Generate Documentation, Publish |
| `SERVICE_ACCOUNT_GPG_PRIVATE_KEY` | Signing commits/tags               | Publish                         |

npm publish authentication uses **Trusted Publishing (OIDC)** via `id-token: write` —
no `NPM_TOKEN` / `NODE_AUTH_TOKEN` secret is required. Configure a Trusted Publisher
on npmjs.com mapping each package to `publish-packages.yml` and the `Production`
environment before its first publish.

## Repository Variables

| Variable       | Purpose                                                 |
| -------------- | ------------------------------------------------------- |
| `NODE_VERSION` | Node.js version for CI (22.x)                           |
| `NPM_VERSION`  | npm version for the publish job (11.7.0+, OIDC support) |
| `BUN_VERSION`  | Bun version for CI (defaults to 1.4.4)                  |

Only `NODE_VERSION` and `NPM_VERSION` are actually **set** on the repo today
(`22.23.4` and `11.7.0`). `BUN_VERSION` falls through to its in-file default, which is therefore
load-bearing rather than decorative.

`NODE_VERSION` must stay at or above the floor promptfoo declares in its
`engines` field (`^20.20.0 || >=22.22.0`). It sat at `22.21.1` for a stretch, one
patch under the floor, which aborted every eval suite at startup while the Evals
workflow still reported success. It reads `22.23.4` as of 2026-10-23. Raising
this variable above the floor keeps all jobs compatible with promptfoo's runtime
requirements. The preflight step below fails loudly on any future drift.

## Security

All workflows follow security best practices:

- External actions are pinned to specific commit SHAs
- [Bullfrog](https://github.com/bullfrogsec/bullfrog) security scanning on all jobs
- Concurrency groups prevent duplicate runs
- Minimal required permissions per job
