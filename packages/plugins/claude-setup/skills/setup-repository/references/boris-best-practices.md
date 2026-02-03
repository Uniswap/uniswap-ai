# Boris Cherny's Claude Code Best Practices

Summary of best practices from [Boris Cherny](https://x.com/bcherny), creator of Claude Code.

Sources:

- [Original X Thread](https://x.com/bcherny/status/2007179832300581177)
- [How Boris Uses Claude Code](https://howborisusesclaudecode.com/)
- [bcherny-claude GitHub](https://github.com/0xquinto/bcherny-claude)

---

## Core Philosophy

> "My setup might be surprisingly vanilla! Claude Code works great out of the box, so I personally don't customize it much."

The key insight: Claude Code is powerful by default. The goal of configuration is to **reduce friction** and **improve verification**, not to fundamentally change how it works.

---

## The 5 Pillars of Boris' Workflow

### 1. Verification is Critical

> "Probably the most important thing to get great results out of Claude Code: give Claude a way to verify its work. If Claude has that feedback loop, it will 2-3x the quality of the final result."

**Implementation:**

- Create `verify-app` agent that runs build, tests, type check
- Use Chrome DevTools MCP for visual verification of UI changes
- Always run tests before considering a task complete

### 2. Plan Mode First

> "Most sessions start in Plan mode (shift+tab twice). When the goal is a Pull Request, I go back and forth with Claude until I like the plan."

**Implementation:**

- Set `"defaultMode": "plan"` in settings
- Iterate on plans before switching to auto-accept mode
- A good plan avoids issues downstream

### 3. Compounding Learning via CLAUDE.md

> "Anytime we see Claude do something incorrectly we add it to the CLAUDE.md, so Claude knows not to do it next time."

**Implementation:**

- Maintain shared CLAUDE.md checked into git
- Update multiple times per week
- Use `@.claude` tags in PR reviews to add learnings
- Include both positive patterns and anti-patterns

### 4. Slash Commands for Inner Loops

> "I use slash commands for every 'inner loop' workflow I do many times a day. The /commit-push-pr command runs dozens of times daily."

**Implementation:**

- Create commands for repetitive workflows
- Commands are checked into git in `.claude/commands/`
- Use inline bash to pre-compute context (git status, etc.)
- Reduces back-and-forth with the model

### 5. Opus 4.5 with Thinking

> "The model choice is unambiguous: Opus 4.5 with thinking for everything."

**Rationale:**

- "Even though it's bigger & slower than Sonnet, since you have to steer it less and it's better at tool use, it is almost always faster overall."
- Better first-attempt quality means less iteration

---

## Parallel Session Strategy

Boris runs:

- 5 Claude Code sessions in terminal (numbered tabs 1-5)
- 5-10 additional sessions on claude.ai/code
- Uses `--teleport` to switch between local and web
- System notifications alert when a session needs input

**Key principle:** Each session works on a separate git checkout to avoid conflicts.

---

## Configuration Components

### CLAUDE.md

- Project-specific instructions read on every session
- Checked into git, shared with team
- Documents:
  - Build commands
  - Test commands
  - Code patterns to follow
  - Mistakes to avoid

### Slash Commands

- Stored in `.claude/commands/`
- Key commands:
  - `/commit-push-pr` - Most used, dozens of times daily
  - `/quick-commit` - Fast commits
  - `/test-and-fix` - Run tests, fix failures
  - `/review-changes` - Review before committing

### Agents

- Stored in `.claude/agents/`
- Key agents:
  - `verify-app` - End-to-end testing
  - `code-simplifier` - Post-task cleanup
  - `build-validator` - Pre-PR validation
  - `code-architect` - Design decisions

### Hooks

- PostToolUse for auto-formatting after Write/Edit
- Example: `"command": "bun run format || true"`

### Permissions

- Use `/permissions` to pre-approve safe commands
- Don't use `--dangerously-skip-permissions`
- Common approvals: build commands, test commands, git reads

---

## Anti-Patterns to Avoid

| Don't                                | Do Instead                            |
| ------------------------------------ | ------------------------------------- |
| `git add .`                          | Add files individually                |
| Skip verification                    | Always verify before marking complete |
| Use Sonnet for complex tasks         | Use Opus 4.5 with thinking            |
| Skip plan mode                       | Start in plan mode, iterate on plan   |
| Ignore mistakes                      | Add to CLAUDE.md immediately          |
| Use `--dangerously-skip-permissions` | Use `/permissions` for pre-approval   |

---

## Productivity Numbers

Boris' 30-day stats:

- 259 PRs landed
- 497 commits
- 40,000 lines added
- 38,000 lines removed

Key enabler: Parallel sessions + verification loops + slash commands.
