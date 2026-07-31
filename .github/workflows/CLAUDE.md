# CI/CD Workflows

This directory contains GitHub Actions workflows for the uniswap-ai repository. The workflows are designed to validate PRs, automate code reviews, and publish packages.

## Workflow Overview

| Workflow                                                           | Trigger              | Purpose                                      |
| ------------------------------------------------------------------ | -------------------- | -------------------------------------------- |
| [PR Checks](#pr-checks)                                            | PR events            | Build, lint, test, validate plugins & skills |
| [Check PR Title](#check-pr-title)                                  | PR events            | Enforce conventional commit format           |
| [Claude Code Review](#claude-code-review)                          | PR events, comments, manual | AI-powered code review via `@uniswap/review-cli` |
| [Claude Docs Check](#claude-docs-check)                            | PR events            | Validate documentation updates               |
| [Generate PR Title & Description](#generate-pr-title--description) | PR events            | Auto-generate PR metadata                    |
| [Generate Documentation](#generate-documentation)                  | Push to main, manual | Auto-generate API documentation              |
| [Publish Packages](#publish-packages)                              | Push to main, manual | Publish npm packages                         |
| [Evals](#evals)                                                    | PR events, manual    | LLM evaluation of AI skills                  |
| [GitHub Actions Analysis](#github-actions-analysis)                | Push to main, PRs    | Security analysis & syntax validation        |

## Workflows

### PR Checks

**File:** `ci-pr-checks.yml`

Core CI validation workflow that runs on all PRs:

- Validates `bun.lock` is in sync via `bun install --frozen-lockfile`
- Builds affected packages with Nx
- Runs linting and formatting checks
- Lints documentation prose with Vale (non-blocking)
- Executes test suites with coverage
- Validates plugin configurations
- Validates skills (frontmatter, consistency with plugin.json)
- Validates documentation pages exist for all plugins and skills

Automated PRs (dependabot, releases) may skip certain checks.

### Check PR Title

**File:** `ci-check-pr-title.yml`

Enforces conventional commit format for PR titles using [semantic-pull-request](https://github.com/amannn/action-semantic-pull-request). Requires scope (e.g., `feat(hooks):`, `fix(ci):`).

### Claude Code Review

**File:** `claude-code-review.yml`

AI-powered code review using
[`@uniswap/review-cli`](https://github.com/Uniswap/internal-tools/tree/main/packages/review-cli),
the same reviewer running in `Uniswap/backend`, `Uniswap/universe`, and
`Uniswap/tjar`. Previously this workflow called the `Uniswap/ai-toolkit`
reusable workflow `_claude-code-review.yml`; that dependency is gone.

- Provides formal GitHub reviews (APPROVE/REQUEST_CHANGES/COMMENT)
- Posts inline comments on specific lines
- Auto-resolves fixed issues on subsequent reviews, and never auto-resolves
  a thread a human has replied in
- Three-level change detection (tree SHA → patch ID → hunk digest), so a
  pure rebase re-reviews nothing

**Two jobs.** `triage` is the gate: it installs the CLI with no repo
content on disk, reads the review policy from the **default branch**, and
decides whether to run. `review` then checks out the PR head and runs the
reviewers. Splitting them is what keeps PR-author-controlled content from
influencing either dependency resolution or the gating decision.

**Configuration lives in the repo, as data:**

| File | |
|---|---|
| `.claude/review.yml` | policy — model, budgets, skip rules, reviewer staffing |
| `.claude/review-context.md` | engineering context the reviewers read before reviewing |

Reviewer agents and the review methodology ship inside the CLI and are
deliberately **not** vendored here.

**Automated PRs** are classified by the shared
`.github/actions/check-automated-pr` composite action — the same one
`ci-pr-checks.yml` and `ci-check-pr-title.yml` use, so there is one
definition. Automated PRs are skipped except `deps`, which are reviewed so
`auto-merge-dependabot` has a review result to gate on. Consequently
`.claude/review.yml` sets `skip.branch_prefixes: []`, `skip.authors: []`,
and `skip.drafts: false`: the CLI's own defaults would otherwise skip
every bot-authored PR (including `claude[bot]`, which opens most PRs here)
and every Dependabot PR, silently disabling auto-merge.

**Triggering a new review:**

- Add a comment containing `@request-claude-review` (top-level or inline).
  Restricted to OWNER / MEMBER / COLLABORATOR — the review job holds an
  LLM credential, so an outside contributor must not be able to start it.
- Use workflow_dispatch: `gh workflow run "Claude Code Review" -f pr_number=123`
  (`force_review` defaults true, which skips change detection)

### Claude Docs Check

**File:** `claude-docs-check.yml`

Validates that PR documentation is properly updated:

- Checks CLAUDE.md files are updated when code in their scope changes
- Verifies README.md files reflect current state
- Ensures plugin versions are bumped when plugin code changes

Uses a shared reusable workflow.

### Generate PR Title & Description

**File:** `generate-pr-title-description.yml`

Auto-generates PR titles and descriptions using Claude:

- Creates conventional commit-style titles based on repository patterns
- Generates comprehensive descriptions from merged PR templates
- Skips rebases using patch-ID detection

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

| Secret                            | Purpose                            | Required By                                 |
| --------------------------------- | ---------------------------------- | ------------------------------------------- |
| `ANTHROPIC_API_KEY`               | Anthropic API authentication       | Evals                                       |
| `CLAUDE_CODE_OAUTH_TOKEN`         | Claude AI authentication           | Code Review, Docs Check, PR Metadata, Evals |
| `WORKFLOW_PAT`                    | Push commits/tags, branch creation | Docs Check, PR Metadata, Publish            |
| `SERVICE_ACCOUNT_GPG_PRIVATE_KEY` | Signing commits/tags               | Publish                                     |

Code Review no longer needs `WORKFLOW_PAT`: it pushes nothing, and the
built-in `GITHUB_TOKEN` covers both posting the review and pulling
`@uniswap/review-cli` from GitHub Packages. It accepts either
`CLAUDE_CODE_OAUTH_TOKEN` (preferred) or `ANTHROPIC_API_KEY` and fails with
an explicit error if neither is set.

`@uniswap/review-cli` is published **only** to GitHub Packages, so this
repo needs read access granted on the package itself: `Uniswap/internal-tools`
→ Packages → `review-cli` → Package settings → Manage Actions access → add
`Uniswap/uniswap-ai`. Without that grant the install step 403s. This is a
per-repo grant and is not something a workflow file can confer.

npm publish authentication uses **Trusted Publishing (OIDC)** via `id-token: write` —
no `NPM_TOKEN` / `NODE_AUTH_TOKEN` secret is required. Configure a Trusted Publisher
on npmjs.com mapping each package to `publish-packages.yml` and the `Production`
environment before its first publish.

## Repository Variables

| Variable              | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `NODE_VERSION`        | Node.js version for CI (22.x)                                  |
| `NPM_VERSION`         | npm version for the publish job (11.7.0+, OIDC support)        |
| `BUN_VERSION`         | Bun version for CI (defaults to 1.3.13)                        |
| `REVIEW_CLI_VERSION`  | `@uniswap/review-cli` pin for Code Review (defaults to 1.10.1) |
| `CLAUDE_CODE_VERSION` | Claude Code binary pin for Code Review (defaults to 2.1.212)   |

Only `NODE_VERSION` and `NPM_VERSION` are actually **set** on the repo today
(`22.22.2` and `11.7.0`). The other three fall through to the in-file
defaults, which are therefore load-bearing rather than decorative. Setting
`REVIEW_CLI_VERSION` is the way to roll the reviewer forward without a
commit.

`NODE_VERSION` must stay at or above the floor promptfoo declares in its
`engines` field (`^20.20.0 || >=22.22.0`). It sat at `22.21.1` for a stretch, one
patch under the floor, which aborted every eval suite at startup while the Evals
workflow still reported success. It reads `22.22.2` as of 2026-07-31. Raising
this variable above the floor keeps all jobs compatible with promptfoo's runtime
requirements. The preflight step below fails loudly on any future drift.

## Security

All workflows follow security best practices:

- External actions are pinned to specific commit SHAs
- [Bullfrog](https://github.com/bullfrogsec/bullfrog) security scanning on all jobs
- Concurrency groups prevent duplicate runs
- Minimal required permissions per job

## Shared Workflows

Two workflows still call reusable workflows from `Uniswap/ai-toolkit`:

- `_claude-docs-check.yml` - Documentation validation
- `_generate-pr-metadata.yml` - PR title/description generation

Code Review no longer does. It runs `@uniswap/review-cli` directly, so the
review logic is a versioned package pin (`REVIEW_CLI_VERSION`) rather than a
reusable-workflow SHA that has to be bumped by PR. Migrating PR metadata to
the sibling `describe-cli` is a separate change; note `ci-check-pr-title.yml`
has a `workflow_run` trigger keyed to the exact workflow name
`Claude: Generate PR Title & Description`, so renaming or removing that
workflow silently stops the title check's second trigger path from firing.
