# Claude Setup Plugin

Interactive setup wizard for configuring any repository with Claude Code best practices, based on [Boris Cherny's workflow](https://howborisusesclaudecode.com/).

## Installation

```bash
claude plugins install claude-setup@uniswap-ai
```

## Usage

Run the setup wizard in any repository:

```text
/setup-repository
```

The wizard will guide you through 5 setup areas:

1. **CLAUDE.md** - Project-specific instructions
2. **Slash Commands** - Workflow automation
3. **Agents** - Specialized assistants
4. **Hooks** - Automatic formatting
5. **Permissions** - Pre-approved commands

You can skip any step based on your needs.

## What Gets Created

### CLAUDE.md

A project-specific instruction file that Claude reads on every session. Includes:

- Project overview
- Build/test commands
- Code patterns
- Learnings section

### Slash Commands

Workflow automation in `.claude/commands/`:

- `/commit-push-pr` - Stage, commit, push, create PR
- `/test-and-fix` - Run tests and fix failures
- `/review-changes` - Review before committing

### Agents

Specialized assistants in `.claude/agents/`:

- `verify-app` - End-to-end verification
- `code-simplifier` - Post-task cleanup
- `build-validator` - Pre-PR validation

### Hooks

Automatic actions in `.claude/settings.local.json`:

- Auto-format on file edits

### Permissions

Pre-approved commands to reduce prompts.

## Boris' Best Practices

This plugin implements key practices from Boris Cherny (creator of Claude Code):

- **Verification loops** - Give Claude ways to verify its work
- **Plan mode first** - Start complex tasks with planning
- **Compounding learning** - Update CLAUDE.md when Claude makes mistakes
- **Slash commands for inner loops** - Automate repetitive workflows
- **Opus 4.5 with thinking** - Use the best model for quality

See [references/boris-best-practices.md](skills/setup-repository/references/boris-best-practices.md) for full details.

## Customization

All created files are templates you can customize:

- Edit command workflows to match your git flow
- Add project-specific agents
- Adjust permission levels

## Related Resources

- [Boris' Original Thread](https://x.com/bcherny/status/2007179832300581177)
- [How Boris Uses Claude Code](https://howborisusesclaudecode.com/)
- [bcherny-claude GitHub](https://github.com/0xquinto/bcherny-claude)

## License

MIT
