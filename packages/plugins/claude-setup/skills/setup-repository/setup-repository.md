---
name: setup-repository
description: Interactive setup wizard for configuring any repository with Claude Code best practices. Use when user says "setup claude", "init claude", "configure claude code", "setup repository", "boris setup", "best practices setup", or wants to configure their repo for optimal AI-assisted development.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(which:*), Bash(ls:*), Bash(cat:*), Bash(mkdir:*), AskUserQuestion, WebFetch
model: opus
---

# Claude Code Repository Setup Wizard

Interactive setup wizard that configures any repository for optimal AI-assisted development, following best practices from [Boris Cherny's workflow](https://howborisusesclaudecode.com/).

## Overview

This wizard guides you through 5 setup areas:

| Step | Area               | What It Creates                                          |
| ---- | ------------------ | -------------------------------------------------------- |
| 1    | **CLAUDE.md**      | Project-specific instructions Claude reads on startup    |
| 2    | **Slash Commands** | Workflow automation (commit-push-pr, test-and-fix, etc.) |
| 3    | **Agents**         | Specialized assistants (verify-app, code-simplifier)     |
| 4    | **Hooks**          | Automatic formatting on file edits                       |
| 5    | **Permissions**    | Pre-approved safe commands                               |

You can skip any step. Each step analyzes your existing setup and makes recommendations.

---

## Setup Protocol

### Step 0: Repository Analysis

Before starting, analyze the repository to understand its structure:

1. **Check for existing Claude Code configuration:**

   - `CLAUDE.md` or `AGENTS.md` at root
   - `.claude/` directory
   - `.claude/commands/`
   - `.claude/agents/`
   - Project-level `settings.local.json`

2. **Identify repository type:**

   - Check `package.json` for Node.js project
   - Check for `Cargo.toml` (Rust), `go.mod` (Go), `pyproject.toml` (Python)
   - Check for monorepo indicators (`nx.json`, `pnpm-workspace.yaml`, `lerna.json`)
   - Check for framework indicators (Next.js, React, Vite, etc.)

3. **Detect existing tooling:**

   - Package manager: npm, yarn, pnpm, bun
   - Test runner: jest, vitest, pytest, cargo test
   - Linter: eslint, prettier, biome
   - Build system: nx, turbo, make

4. **Present analysis to user:**

   ```text
   Repository Analysis Complete

   Type: [Node.js monorepo / Python project / etc.]
   Package Manager: [npm/yarn/pnpm/bun]
   Test Runner: [jest/vitest/etc.]
   Existing Claude Config: [Yes/No - list what exists]

   Ready to proceed with setup? [Continue / Abort]
   ```

---

### Step 1: CLAUDE.md Setup

**Goal:** Create or enhance the project's CLAUDE.md file with instructions Claude reads on every session.

#### If CLAUDE.md exists

1. Read the existing file
2. Analyze for completeness against best practices
3. Suggest enhancements (don't overwrite without permission)

#### If CLAUDE.md doesn't exist

1. Generate a tailored CLAUDE.md based on repository analysis
2. Include:
   - Project overview (inferred from README/package.json)
   - Build commands (detected from package.json scripts)
   - Test commands
   - Code style preferences (inferred from linter configs)
   - Key conventions

#### CLAUDE.md Template Structure

```markdown
# CLAUDE.md

## Project Overview

[Brief description of what this project does]

## Build Commands

[Detected from package.json/Makefile/etc.]

## Test Commands

[Detected test runner commands]

## Code Style

[Inferred from .eslintrc, .prettierrc, etc.]

## Key Patterns

[Framework-specific patterns if detected]

## Learnings

[Empty section - add mistakes/corrections here over time]
```

**Ask user:**

- "Should I create/enhance CLAUDE.md? [Yes / Skip]"
- If yes, show preview and ask for confirmation

---

### Step 2: Slash Commands Setup

**Goal:** Create workflow automation commands in `.claude/commands/`.

**Commands to offer:**

| Command          | Description                                      | When to use                                 |
| ---------------- | ------------------------------------------------ | ------------------------------------------- |
| `commit-push-pr` | Stage, commit, push, create PR                   | Daily workflow - Boris uses dozens of times |
| `test-and-fix`   | Run tests, fix failures iteratively              | After code changes                          |
| `review-changes` | Review uncommitted changes, suggest improvements | Before committing                           |
| `quick-commit`   | Stage all and commit with generated message      | Fast commits                                |

**For each command, ask:**

- "Would you like to add /{command-name}? [Yes / No / Customize]"

**Customize options:**

- Git tool: `git` vs `gh` vs `gt` (Graphite)
- PR creation method: GitHub CLI vs Graphite
- Commit message style: conventional commits vs freeform

#### Command Template: commit-push-pr.md

```markdown
---
name: commit-push-pr
description: Commit changes and create a pull request
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob
---

# Commit, Push, and Create PR

## Steps

1. **Check status**: Run `git status` to see changes
2. **Stage files**: Add changed files individually (never `git add .`)
3. **Generate commit message**: Analyze diff and generate meaningful message
4. **Commit**: Run `git commit -m "[message]"`
5. **Push**: Run `git push -u origin [branch]`
6. **Create PR**: Run `gh pr create --fill` or show PR creation options

## Commit Message Format

Use conventional commits: `type(scope): description`

Types: feat, fix, docs, style, refactor, test, chore
```

**Create directory and files:**

```bash
mkdir -p .claude/commands
```

---

### Step 3: Agents Setup

**Goal:** Create specialized agent assistants in `.claude/agents/`.

**Agents to offer:**

| Agent             | Description                        | When to use                |
| ----------------- | ---------------------------------- | -------------------------- |
| `verify-app`      | End-to-end verification of changes | After completing a feature |
| `code-simplifier` | Clean up and simplify code         | After Claude writes code   |
| `build-validator` | Ensure project builds correctly    | Before creating PR         |

**For each agent, ask:**

- "Would you like to add the {agent-name} agent? [Yes / No]"

#### Agent Template: verify-app.md

```markdown
---
name: verify-app
description: Thoroughly verify changes work end-to-end
---

# Verification Agent

Verify that recent changes work correctly before considering them complete.

## Verification Steps

1. **Build Check**: Run the build command and verify success
2. **Test Check**: Run the test suite and verify all tests pass
3. **Type Check**: Run type checking if applicable
4. **Lint Check**: Run linters and verify no errors
5. **Manual Verification**: For UI changes, describe what to check visually

## Output

Report verification results:

- Build: [PASS/FAIL]
- Tests: [PASS/FAIL] - X passed, Y failed
- Types: [PASS/FAIL]
- Lint: [PASS/FAIL]

If any check fails, explain the failure and suggest fixes.
```

#### Agent Template: code-simplifier.md

```markdown
---
name: code-simplifier
description: Simplify and clean up code after changes
---

# Code Simplifier Agent

Review recently changed code and simplify where possible.

## Simplification Targets

1. **Dead code**: Remove unused variables, functions, imports
2. **Duplication**: Extract repeated patterns into functions
3. **Complexity**: Simplify nested conditionals, reduce cognitive load
4. **Naming**: Improve unclear variable/function names
5. **Comments**: Remove obvious comments, add clarifying ones where needed

## Constraints

- Do NOT change behavior
- Do NOT add new features
- Do NOT refactor unrelated code
- Keep changes minimal and focused

## Output

List changes made with before/after snippets.
```

**Create directory:**

```bash
mkdir -p .claude/agents
```

---

### Step 4: Hooks Setup

**Goal:** Configure automatic hooks for formatting and validation.

**Available hooks:**

| Hook          | Trigger                   | Action                    |
| ------------- | ------------------------- | ------------------------- |
| `PostToolUse` | After Write/Edit          | Auto-format changed files |
| `PreToolUse`  | Before dangerous commands | Confirm with user         |

**Ask user:**

- "Would you like to enable auto-formatting on file edits? [Yes / No]"
- "What formatter do you use? [prettier / eslint --fix / biome / detected]"

#### PostToolUse Hook Configuration

Add to user's `~/.claude/settings.json` or project's `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "[formatter command]"
          }
        ]
      }
    ]
  }
}
```

**Formatter detection:**

- Check for `.prettierrc` → `npx prettier --write`
- Check for `biome.json` → `npx biome format --write`
- Check for `.eslintrc` → `npx eslint --fix`

---

### Step 5: Permissions Setup

**Goal:** Pre-approve common safe commands to reduce permission prompts.

**Permission categories to offer:**

| Category        | Commands                            | Risk   |
| --------------- | ----------------------------------- | ------ |
| **Build**       | `npm run *`, `npx *`, `yarn *`      | Low    |
| **Test**        | `npm test`, `jest`, `vitest`        | Low    |
| **Git (read)**  | `git status`, `git diff`, `git log` | None   |
| **Git (write)** | `git add`, `git commit`, `git push` | Medium |
| **GitHub CLI**  | `gh pr *`, `gh issue *`             | Medium |

**Ask user for each category:**

- "Pre-approve {category} commands? [Yes / No]"

#### Permissions Configuration

Add to `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(npx:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)"
    ]
  }
}
```

**Note:** Write permissions to project's `.claude/settings.local.json`, not global settings.

---

## Completion Summary

After all steps, present a summary:

```text
Setup Complete!

Created/Modified:
- [x] CLAUDE.md (created/enhanced)
- [x] .claude/commands/commit-push-pr.md
- [x] .claude/commands/test-and-fix.md
- [x] .claude/agents/verify-app.md
- [x] .claude/agents/code-simplifier.md
- [x] .claude/settings.local.json (hooks + permissions)

Skipped:
- [ ] review-changes command (user skipped)

Next Steps:
1. Review the created files and customize as needed
2. Try running /commit-push-pr on your next commit
3. Add project-specific learnings to CLAUDE.md over time
4. Consider adding the files to .gitignore or committing them

Tips:
- Start sessions in Plan mode (Shift+Tab twice) for complex tasks
- Use verification commands to catch issues early
- Update CLAUDE.md whenever Claude makes a mistake
```

---

## References

For more details on each component:

- [Boris' Setup Guide](references/boris-best-practices.md)
- [CLAUDE.md Examples](references/claude-md-examples.md)
- [Command Templates](references/command-templates.md)
- [Agent Templates](references/agent-templates.md)

---

## Troubleshooting

| Issue                       | Solution                                            |
| --------------------------- | --------------------------------------------------- |
| Commands not appearing      | Ensure `.claude/commands/` is in the right location |
| Hooks not triggering        | Check `settings.local.json` syntax                  |
| Permissions still prompting | Verify patterns match exact command format          |
| Agents not found            | Ensure `.claude/agents/` directory exists           |
