<!-- markdownlint-disable MD024 MD040 -->
<!-- Duplicate headings and missing language specifiers are intentional in template examples -->

# Slash Command Templates

Complete templates for commonly used slash commands.

---

## /commit-push-pr

Boris' most-used command. Runs dozens of times daily.

### Standard Version (GitHub CLI)

````markdown
---
name: commit-push-pr
description: Commit changes and create a pull request via GitHub CLI
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob
---

# Commit, Push, and Create PR

Automate the commit-to-PR workflow.

## Prerequisites

- Changes must be staged or ready to stage
- Must be on a feature branch (not main/master)

## Workflow

### 1. Check Current State

```bash
git status
git branch --show-current
```
````

### 2. Stage Changes

Review and stage files individually:

```bash
git add [file1] [file2] ...
```

**Never use `git add .`** - always review what you're committing.

### 3. Generate Commit Message

Analyze the diff and generate a meaningful commit message:

```bash
git diff --staged
```

Use conventional commit format:

- `feat(scope): add new feature`
- `fix(scope): fix bug description`
- `docs(scope): update documentation`
- `refactor(scope): refactor code`
- `test(scope): add tests`
- `chore(scope): maintenance task`

### 4. Commit

```bash
git commit -m "[generated message]"
```

### 5. Push

```bash
git push -u origin [current-branch]
```

### 6. Create PR

```bash
gh pr create --fill
```

Or with specific options:

```bash
gh pr create --title "[title]" --body "[body]"
```

## Output

Report:

- Files committed
- Commit hash
- PR URL

````

### Graphite Version

```markdown
---
name: commit-push-pr
description: Commit changes and create a pull request via Graphite
allowed-tools: Bash(git:*), Bash(gt:*), Read, Glob
---

# Commit, Push, and Create PR (Graphite)

Automate the commit-to-PR workflow using Graphite CLI.

## Workflow

### 1. Stage Changes
```bash
git add [file1] [file2] ...
````

### 2. Create Commit with Graphite

```bash
gt create -m "[commit message]"
```

### 3. Submit PR

```bash
gt submit
```

For stack updates:

```bash
gt modify --no-verify && gt submit --stack --update-only
```

## Notes

- Graphite handles pushing and PR creation
- Supports stacked PRs automatically
- Use `gt sync` to sync with remote

````

---

## /test-and-fix

Run tests and iteratively fix failures.

```markdown
---
name: test-and-fix
description: Run tests and fix any failures iteratively
allowed-tools: Bash(npm:*), Bash(npx:*), Read, Edit, Glob, Grep
---

# Test and Fix

Run tests and iteratively fix failures until all pass.

## Workflow

### 1. Run Tests
```bash
npm test
````

Or for specific test file:

```bash
npm test -- [path/to/test]
```

### 2. Analyze Failures

If tests fail:

1. Read the error output carefully
2. Identify the failing test(s)
3. Understand the expected vs actual behavior

### 3. Fix the Issue

1. Locate the relevant source file
2. Understand why the test is failing
3. Make the minimal fix required
4. Do NOT change the test unless it's incorrect

### 4. Re-run Tests

```bash
npm test
```

### 5. Repeat Until Passing

Continue the fix-and-test cycle until all tests pass.

## Output

Report:

- Initial test results
- Issues found and fixes applied
- Final test results (all passing)

## Constraints

- Do NOT skip or delete failing tests
- Do NOT change test expectations unless they're wrong
- Make minimal changes to fix the issue

````

---

## /review-changes

Review uncommitted changes before committing.

```markdown
---
name: review-changes
description: Review uncommitted changes and suggest improvements
allowed-tools: Bash(git:*), Read, Glob, Grep
---

# Review Changes

Review all uncommitted changes and provide feedback.

## Workflow

### 1. Get Changes
```bash
git diff
git diff --staged
git status
````

### 2. Review Each Changed File

For each modified file:

1. Understand the intent of the change
2. Check for:
   - Bugs or logic errors
   - Security issues
   - Performance problems
   - Code style violations
   - Missing error handling
   - Incomplete implementations

### 3. Provide Feedback

For each issue found:

- File and line number
- Issue description
- Suggested fix

### 4. Summary

Provide overall assessment:

- Ready to commit? [Yes/No]
- Critical issues: [list]
- Suggestions: [list]

````

---

## /quick-commit

Fast commit with auto-generated message.

```markdown
---
name: quick-commit
description: Stage all changes and commit with a descriptive message
allowed-tools: Bash(git:*), Read
---

# Quick Commit

Fast-track committing with auto-generated message.

## Workflow

### 1. Check Changes
```bash
git status
git diff
````

### 2. Stage All Changes

```bash
git add -A
```

**Note:** This stages everything. Use /commit-push-pr for more control.

### 3. Generate and Commit

Analyze changes and generate commit message:

```bash
git commit -m "[auto-generated message]"
```

## Output

- Commit hash
- Files committed
- Commit message used

````

---

## /lint-fix

Run linters and fix issues.

```markdown
---
name: lint-fix
description: Run linters and auto-fix issues
allowed-tools: Bash(npm:*), Bash(npx:*), Read, Edit
---

# Lint and Fix

Run all linters and fix issues automatically where possible.

## Workflow

### 1. Format Code
```bash
npx prettier --write .
````

### 2. Run ESLint with Auto-fix

```bash
npx eslint --fix .
```

### 3. Run Type Check

```bash
npx tsc --noEmit
```

### 4. Report Results

- Files formatted
- Lint issues fixed
- Remaining issues (manual fix required)

````

---

## Adding Commands to Your Project

1. Create directory: `mkdir -p .claude/commands`
2. Add command file: `.claude/commands/[name].md`
3. Commands are available immediately as `/[name]`

### Frontmatter Options

```yaml
---
name: command-name          # Required: unique identifier
description: what it does   # Required: shown in command list
allowed-tools: Tool1, Tool2 # Optional: restrict available tools
model: opus                 # Optional: force specific model
---
````

### Tool Patterns

| Pattern       | Meaning                  |
| ------------- | ------------------------ |
| `Bash(git:*)` | Only git commands        |
| `Bash(npm:*)` | Only npm commands        |
| `Read`        | Can read files           |
| `Edit`        | Can edit files           |
| `Write`       | Can create files         |
| `Glob`        | Can search for files     |
| `Grep`        | Can search file contents |
