# CI/CD Workflows

This directory contains GitHub Actions workflows for the uniswap-ai repository. The workflows are designed to validate PRs, automate code reviews, and publish packages.

## Workflow Overview

| Workflow                                                           | Trigger              | Purpose                                 |
| ------------------------------------------------------------------ | -------------------- | --------------------------------------- |
| [PR Checks](#pr-checks)                                            | PR events            | Build, lint, test, and validate plugins |
| [Check PR Title](#check-pr-title)                                  | PR events            | Enforce conventional commit format      |
| [Claude Code Review](#claude-code-review)                          | PR events, comments  | AI-powered code review                  |
| [Claude Docs Check](#claude-docs-check)                            | PR events            | Validate documentation updates          |
| [Generate PR Title & Description](#generate-pr-title--description) | PR events            | Auto-generate PR metadata               |
| [Deploy Documentation](#deploy-documentation)                      | Push to main         | Build and deploy VitePress docs         |
| [Publish Packages](#publish-packages)                              | Push to main, manual | Publish npm packages                    |

## Workflows

### PR Checks

**File:** `ci-pr-checks.yml`

Core CI validation workflow that runs on all PRs:

- Validates `package-lock.json` is in sync
- Builds affected packages with Nx
- Runs linting and formatting checks
- Executes test suites with coverage
- Validates plugin configurations

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

### Deploy Documentation

**File:** `deploy-docs.yml`

Builds and deploys VitePress documentation to GitHub Pages:

- Triggers on push to main when `docs/` changes
- Builds with `npm run docs:build`
- Deploys to GitHub Pages environment

### Publish Packages

**File:** `publish-packages.yml`

Handles npm package publishing:

- **Auto mode** (push to main): Detects affected packages, publishes with `latest` tag
- **Force mode** (manual): Publishes specified packages with `next` tag and prerelease versions

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
