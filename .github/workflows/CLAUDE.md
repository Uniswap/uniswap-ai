# CI/CD Workflows

This directory contains GitHub Actions workflows for the uniswap-ai repository. The workflows are designed to validate PRs, automate code reviews, and publish packages.

## Workflow Overview

| Workflow                                                           | Trigger                     | Purpose                                          |
| ------------------------------------------------------------------ | --------------------------- | ------------------------------------------------ |
| [PR Checks](#pr-checks)                                            | PR events                   | Build, lint, test, validate plugins & skills     |
| [Check PR Title](#check-pr-title)                                  | PR events                   | Enforce conventional commit format               |
| [Claude Code Review](#claude-code-review)                          | PR events, comments, manual | AI-powered code review via `@uniswap/review-cli` |
| [Claude Docs Check](#claude-docs-check)                            | PR events                   | Validate documentation updates                   |
| [Generate PR Title & Description](#generate-pr-title--description) | PR events                   | Auto-generate PR metadata                        |
| [Generate Documentation](#generate-documentation)                  | Push to main, manual        | Auto-generate API documentation                  |
| [Publish Packages](#publish-packages)                              | Push to main, manual        | Publish npm packages                             |
| [Evals](#evals)                                                    | PR events, manual           | LLM evaluation of AI skills                      |
| [GitHub Actions Analysis](#github-actions-analysis)                | Push to main, PRs           | Security analysis & syntax validation            |

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

| File                        |                                                         |
| --------------------------- | ------------------------------------------------------- |
| `.claude/review.yml`        | policy — model, budgets, skip rules, reviewer staffing  |
| `.claude/review-context.md` | engineering context the reviewers read before reviewing |

Reviewer agents and the review methodology ship inside the CLI and are
deliberately **not** vendored here.

**Automated PRs** are classified by the shared
`.github/actions/check-automated-pr` composite action — the same one
`ci-pr-checks.yml` and `ci-check-pr-title.yml` use, so there is one
definition. Automated PRs are skipped except `deps`.

`.claude/review.yml` sets `skip.branch_prefixes: []`, `skip.authors: []`,
and `skip.drafts: false` because the CLI's own defaults
(`authors: ['*[bot]']`, `drafts: true`, and the `dependabot/` / `renovate/`
branch prefixes) would otherwise drop any bot-authored or draft PR outright.
This repo does get `claude[bot]` PRs and does want its drafts reviewed, so
those defaults are wrong here — though bot-authored PRs are a minority
(2 of the last 30 as of 2026-08-03; most are human-authored).

**There is no Dependabot auto-merge.** An `auto-merge-dependabot` job used
to live in `claude-code-review.yml` and was removed, because it could not
run and its gate was wrong. If you ever want it back, two things have to be
true that were not:

- **Dependabot has to actually produce PRs here.** This repo has only
  `bun.lock`, and Dependabot's `bun` ecosystem supports version updates but
  **not** security updates. Enabling `automated-security-fixes` gains
  nothing for these dependencies; version updates need a
  `.github/dependabot.yml` with `package-ecosystem: bun`.
- **The gate has to test the verdict, not the exit code.** The removed job
  gated on `needs.review.result == 'success'`, which means the review job
  did not crash — not that the review approved. A `REQUEST_CHANGES` verdict
  still leaves the job result `success`, so as written it would have
  auto-merged a PR the reviewer objected to.

Dependabot alerts are already enabled, so vulnerable dependencies surface
today; they just get bumped by hand.

**Triggering a new review:**

- Add a comment containing `@request-claude-review` (top-level or inline).
  Restricted to OWNER / MEMBER / COLLABORATOR — the review job holds an
  LLM credential, so an outside contributor must not be able to start it.
- Use workflow_dispatch: `gh workflow run "Claude Code Review" -f pr_number=123`
  (`force_review` defaults true, which skips change detection)

**Cancellation, and the three terminal states.** A push to a PR cancels the
review already in flight for it, because reviewing code a newer push has
already replaced spends budget on a stale answer. One concurrency group covers
every trigger type, so a push can cancel a review a human just asked for by
comment. That is deliberate: splitting the group per trigger would let two
reviews run concurrently against the same sticky comment, and serialization is
worth more.

`cancel-in-progress` only fires for events that will actually produce a
replacement review, so it mirrors the first clause of the `triage` gate rather
than testing `github.event_name` alone:

```yaml
cancel-in-progress: >-
  ${{ github.event_name == 'pull_request'
  && github.event.pull_request.head.repo.fork == false
  && (github.event.pull_request.draft == false
  || github.event.action == 'ready_for_review'
  || github.event.pull_request.user.login == 'claude[bot]') }}
```

Note this is **not** a bare `draft == false`, because this repo does review
`claude[bot]` drafts. If you change the gate, change this predicate to match, or
a push will start cancelling reviews that nothing replaces.

A run therefore ends in one of **three** states, not two, and the finalization
steps report each differently:

| State              | Gate           | Trigger comment | Threaded reply      |
| ------------------ | -------------- | --------------- | ------------------- |
| review completed   | `!cancelled()` | 👀 → 👍         | ✅ **Reviewed**     |
| review job errored | `!cancelled()` | 👀 → 👎         | ⚠ **Review failed** |
| run cancelled      | `cancelled()`  | 👀 kept         | ⏹ **Cancelled**     |

Cancellation is detected with the `cancelled()` status-check function, not by
comparing `job.status` in bash. `job.status` is documented to be one of
`success` / `failure` / `cancelled`, but nothing specifies that it interpolates
to `cancelled` for a step of the job currently being cancelled, so a bash
comparison against it would be an unverified assumption.

**If you triggered a review by comment and it was cancelled**, your 👀 stays
(the request was superseded, not rejected) and the threaded reply says so. On a
push supersede the newer run picks it up automatically. On a manual cancel from
the Actions UI, nothing follows, so comment `@request-claude-review` again. Two
known rough edges on the manual-cancel path:

- The sticky summary comment still shows its "Review running" placeholder. This
  needs a CLI change and is tracked in
  [Uniswap/internal-tools#155](https://github.com/Uniswap/internal-tools/issues/155).
- If the run is cancelled while still **queued**, no job is allocated, so no
  finalization step runs at all. Harmless, because `triage` never ran either, so
  there is no 👀 or reply to leave stale.

### Claude Docs Check

**File:** `claude-docs-check.yml`

Validates that PR documentation is properly updated:

- Checks CLAUDE.md files are updated when code in their scope changes
- Verifies README.md files reflect current state
- Ensures plugin versions are bumped when plugin code changes

Uses a shared reusable workflow.

**Skipping this job blocks the PR — it does not just skip a check.**
`docs-check / docs-check` is a required status check in the `main` ruleset,
and that two-part context name exists only because this job calls a
reusable workflow. A job that calls a reusable workflow reports one check
per job _inside_ that workflow, prefixed by the caller's job id. Skip the
caller and there are no inner jobs, so GitHub reports a single check named
`docs-check` — a name nothing requires — and the required
`docs-check / docs-check` context never reports at all. GitHub treats a
required context that never reports as still-pending, so
`mergeable_state` stays `blocked` forever with no failing check to point
at. This is the opposite of the usual case, where a skipped required job
reports `skipped` under its own required name and satisfies the rule.

PR [#121](https://github.com/Uniswap/uniswap-ai/pull/121) sat in exactly
that state: `docs-check` reported `skipped`, `docs-check / docs-check`
never appeared, and the PR could not be merged.

**Bot gating uses the numeric account id, not the login.** The job's `if:`
admits same-repo PRs from any human (`user.type != 'Bot'`) plus the one bot
whose PRs this repo wants documentation-checked, matched as
`github.event.pull_request.user.id == 209825114` — the `claude[bot]`
account, from the Claude GitHub App (app id 1236702). Prefer that id over
`github.actor`, `user.login`, or `contains(login, '[bot]')` in any new
gate: logins are mutable and describe a naming convention, while the
numeric id is assigned by GitHub at account creation, survives renames,
and cannot be chosen by the account holder. `user.type` is GitHub's own
account-kind field, so Dependabot and Renovate stay skipped without
matching on the `[bot]` suffix.

Note this differs from `claude-code-review.yml`, which still gates on
`user.login == 'claude[bot]'`. That workflow is not a required check, so a
mis-fire there skips a review rather than deadlocking the PR; converting
it to the numeric id is worthwhile but is not load-bearing the way this
one is.

**There are two independent bot gates, and only the first is in this
repo.** Clearing the `if:` above is necessary but not sufficient:

1. **The workflow-level `if:`** decided whether the job ran at all. This is
   the one that caused the deadlock, and it is fixed here.
2. **`anthropics/claude-code-action`'s own actor check**, reached only once
   the job actually starts. It refuses a non-`User` actor unless the actor
   is listed in the action's `allowed_bots` input, which defaults to `""`
   (allow no bots). The failure reads:

   ```text
   Workflow initiated by non-human actor: claude (type: Bot).
   Add bot to allowed_bots list or use '*' to allow all bots.
   ```

   **This cannot be set from this repo, and the value is hardcoded in the
   toolkit.** Both ai-toolkit reusable workflows this repo calls decide
   `allowed_bots` themselves and expose no input for it:

   | Reusable workflow           | What it passes                         | Effect on `claude[bot]`    |
   | --------------------------- | -------------------------------------- | -------------------------- |
   | `_claude-docs-check.yml`    | nothing (action default `""`)          | rejected — no bots allowed |
   | `_generate-pr-metadata.yml` | `allowed_bots: dependabot` (hardcoded) | rejected — not in list     |

   `_claude-docs-check.yml` declares 14 `workflow_call` inputs, none of them
   `allowed_bots`, and neither of its two `claude-code-action` steps forwards
   one. Verified against the pinned SHA and against the toolkit's `main` and
   `next`, which are byte-identical here — so there is no input to pass and
   no newer ref that helps. The fix belongs in ai-toolkit: either add an
   `allowed_bots` input and forward it, or extend the hardcoded list to
   `dependabot,claude`. Do not reach for `'*'`: it would admit every bot,
   including external Apps on a public repo.

   This is also why `generate-metadata / generate-metadata` fails on
   bot-authored PRs — the same actor check, one line of hardcoded config
   away. It is not a required check, so it does not block merges.

Until that lands, a bot-authored PR gets `docs-check / docs-check` →
`failure` from the actor check rather than a real docs verdict. That is
still a strict improvement, because the required context reports at all and
the PR is no longer wedged pending-forever — but treat the red as "the
check could not run", not "the docs are wrong". The tell is in the job's
step list: `Run Claude Docs Check` fails and `Process Results` is
**skipped**, so no verdict was ever produced. (`Set Exit Code` then prints
"✅ Documentation check passed" against an empty `VERDICT`, which is
misleading — the job still fails on the earlier step.)

**The `claude` vs `claude[bot]` spelling does not matter.** The action's
`isAllowedBot` (`src/github/validation/actor.ts`) lowercases and strips a
trailing `[bot]` from _both_ the configured entries and the actor, so
`claude`, `claude[bot]`, and `Claude[bot]` are one entry. The error message
prints the stripped form purely for display; it is not a hint that the
suffixed form was compared and missed.

Note that `allowed_bots` matches on **name**, with no numeric-id
equivalent anywhere in the action's interface. Two properties keep that
acceptable, and one does not:

- The value compared is `github.actor`, which GitHub populates from the
  authenticated triggering actor. Nothing in a PR's branch, diff, or title
  can influence it.
- The list is consulted **only** for actors GitHub's Users API reports as
  non-`User`. A human who registers the account `claude` never reaches the
  allow-list, so the name grants them nothing.
- Residual, and unfixable within that interface: if the app were renamed,
  or a different app were named `claude`, the name would match. The
  action exposes no id-based equivalent.

That is why the gate this repo _does_ control uses the numeric id.

Fork PRs are still skipped (they have no access to secrets) and so are
still subject to the same never-reporting-context deadlock. No fork PR has
needed to merge here, but the durable fix is to drop
`docs-check / docs-check` from the ruleset in favour of a context that
always reports.

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
