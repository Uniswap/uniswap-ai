# CI/CD Workflows

This directory contains GitHub Actions workflows for the uniswap-ai repository. The workflows are designed to validate PRs, automate code reviews, and publish packages.

## Workflow Overview

| Workflow                                                           | Trigger              | Purpose                                      |
| ------------------------------------------------------------------ | -------------------- | -------------------------------------------- |
| [PR Checks](#pr-checks)                                            | PR events            | Build, lint, test, validate plugins & skills |
| [Check PR Title](#check-pr-title)                                  | PR events            | Enforce conventional commit format           |
| [Claude Code Review](#claude-code-review)                          | PR events, comments  | AI-powered code review                       |
| [Claude Docs Check](#claude-docs-check)                            | PR events            | Validate documentation updates               |
| [Generate PR Title & Description](#generate-pr-title--description) | PR events            | Auto-generate PR metadata                    |
| [Generate Documentation](#generate-documentation)                  | Push to main, manual | Auto-generate API documentation              |
| [Publish Packages](#publish-packages)                              | Push to main, manual | Publish npm packages                         |
| [zizmor](#zizmor)                                                  | Push to main, PRs    | GitHub Actions security analysis             |

## Workflows

### PR Checks

**File:** `ci-pr-checks.yml`

Core CI validation workflow that runs on all PRs:

- Validates `package-lock.json` is in sync
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

AI-powered code review using Claude:

- Provides formal GitHub reviews (APPROVE/REQUEST_CHANGES/COMMENT)
- Posts inline comments on specific lines
- Auto-resolves fixed issues on subsequent reviews
- Uses patch-ID caching to avoid duplicate reviews on rebases

**Triggering a new review:**

- Add a comment containing `@request-claude-review`
- Use workflow_dispatch: `gh workflow run "Claude Code Review" -f pr_number=123`

### Claude Docs Check

**File:** `claude-docs-check.yml`

Validates that PR documentation is properly updated:

- Checks CLAUDE.md files are updated when code in their scope changes
- Verifies README.md files reflect current state
- Ensures plugin versions are bumped when plugin code changes

Uses the shared workflow from [ai-toolkit](https://github.com/Uniswap/ai-toolkit).

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
- Runs `npx nx run docs:generate-api-docs` to generate documentation
- Auto-commits generated docs to `docs/api/**` with `[skip ci]` flag
- Skips execution if commit message starts with `docs: auto-generate` to prevent loops
- Uses concurrency controls to prevent overlapping doc generation

### Deploy Documentation

Documentation is deployed via [Vercel](https://vercel.com) (not GitHub Actions). Vercel's GitHub integration automatically:

- Deploys to production on push to `main` when `docs/` changes
- Creates preview deployments for every PR
- Build command: `npx nx run docs:build`

Configuration is in `vercel.json` at the repo root.

### Publish Packages

**File:** `publish-packages.yml`

Handles npm package publishing:

- **Auto mode** (push to main): Detects affected packages, publishes with `latest` tag
- **Force mode** (manual): Publishes specified packages with `next` tag and prerelease versions

### zizmor

**File:** `zizmor.yml`

Static security analysis for GitHub Actions workflows using [zizmor](https://github.com/zizmorcore/zizmor):

- Runs on push to main and all PRs
- Scans workflows for template injection, credential leakage, permission scope issues
- Reports findings as GitHub annotations on PRs

## Required Secrets

| Secret                            | Purpose                            | Required By                          |
| --------------------------------- | ---------------------------------- | ------------------------------------ |
| `CLAUDE_CODE_OAUTH_TOKEN`         | Claude AI authentication           | Code Review, Docs Check, PR Metadata |
| `WORKFLOW_PAT`                    | Push commits/tags, branch creation | Docs Check, PR Metadata, Publish     |
| `NODE_AUTH_TOKEN`                 | npm publishing (OIDC fallback)     | Publish                              |
| `SERVICE_ACCOUNT_GPG_PRIVATE_KEY` | Signing commits/tags               | Publish                              |

## Repository Variables

| Variable       | Purpose                       |
| -------------- | ----------------------------- |
| `NODE_VERSION` | Node.js version for CI (22.x) |
| `NPM_VERSION`  | npm version for CI (11.7.0)   |

## Security

All workflows follow security best practices:

- External actions are pinned to specific commit SHAs
- [Bullfrog](https://github.com/bullfrogsec/bullfrog) security scanning on all jobs
- Concurrency groups prevent duplicate runs
- Minimal required permissions per job

## Shared Workflows

Several workflows use reusable workflows from [ai-toolkit](https://github.com/Uniswap/ai-toolkit):

- `_claude-docs-check.yml` - Documentation validation
- `_generate-pr-metadata.yml` - PR title/description generation
- `_claude-code-review.yml` - Code review logic
