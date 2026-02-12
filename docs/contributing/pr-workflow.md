---
title: PR Workflow
order: 2
---

# PR Workflow

This page details the pull request process for Uniswap AI contributions.

## Creating a PR

### 1. Branch Naming

Use descriptive branch names:

```text
feature/add-aggregator-hook-skill
fix/eval-timeout-issue
docs/update-installation-guide
```

### 2. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature
git commit -m "feat(hooks): add liquidity aggregator skill"

# Bug fix
git commit -m "fix(evals): increase timeout for slow tests"

# Documentation
git commit -m "docs(skills): update aggregator hook examples"
```

### 3. PR Title

PR titles must also follow conventional commits format:

```text
feat(hooks): add liquidity aggregator skill
fix(evals): increase timeout for slow tests
docs: update installation guide
```

## CI Checks

Every PR runs through these checks:

### Automated Checks

| Check             | Description                          | Required |
| ----------------- | ------------------------------------ | -------- |
| Build             | Builds affected packages             | ✅       |
| Lint              | Runs ESLint on affected packages     | ✅       |
| Format            | Checks Prettier formatting           | ✅       |
| Tests             | Runs Jest tests with coverage        | ✅       |
| Plugin Validation | Validates plugin configurations      | ✅       |
| Eval Coverage     | Ensures new skills have evals        | ✅       |
| PR Title          | Validates conventional commit format | ✅       |
| Docs Check        | Validates documentation updates      | ⚠️       |
| Vale              | Checks prose quality                 | ⚠️       |

✅ = Required to pass
⚠️ = Advisory (non-blocking)

### Claude Code Review

PRs automatically receive AI-powered code review:

- Provides formal review (APPROVE/REQUEST_CHANGES/COMMENT)
- Posts inline comments on specific lines
- Focuses on security, best practices, and code quality

To request a new review, comment:

```text
@request-claude-review
```

## Review Process

### What Reviewers Look For

1. **Code Quality**

   - TypeScript best practices
   - No `any` types
   - Proper error handling

2. **Security**

   - No hardcoded secrets
   - Input validation
   - Safe external interactions

3. **Testing**

   - Adequate test coverage
   - Edge cases covered
   - Eval suites for new skills

4. **Documentation**
   - CLAUDE.md updated if needed
   - README.md reflects changes
   - Code comments where helpful

### Addressing Feedback

1. Push new commits to address feedback
2. Reply to review comments explaining changes
3. Request re-review when ready

## Merging

Once approved:

1. Ensure all required checks pass
2. Squash and merge (default)
3. Delete the branch after merge

### Automatic Post-Merge Actions

After merging to `main`:

- **Documentation**: Docs are rebuilt and deployed
- **Skills Publishing**: Skills become available via the [skills.sh CLI](https://skills.sh) (fetched directly from the default branch)

## Troubleshooting

### CI Failures

**Build fails:**

```bash
# Run build locally
npx nx affected --target=build --verbose
```

**Tests fail:**

```bash
# Run tests locally
npx nx affected --target=test --verbose
```

**Formatting issues:**

```bash
# Fix formatting
npx nx format:write
```

### Eval Coverage Check

If you added a new skill, create the eval suite:

```bash
mkdir -p evals/suites/your-skill/cases
mkdir -p evals/suites/your-skill/rubrics
# Add promptfoo.yaml, prompt-wrapper.txt, and test cases
```

## Related

- [Contributing Guide](/contributing/) - Getting started
- [Writing Evals](/evals/writing-evals) - Creating evaluation suites
- [Architecture](/architecture/) - Project structure
