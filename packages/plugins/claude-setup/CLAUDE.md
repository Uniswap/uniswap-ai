# CLAUDE.md - claude-setup Plugin

## Overview

This plugin provides an interactive setup wizard for configuring any repository with Claude Code best practices.

## Plugin Structure

```text
claude-setup/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── setup-repository/
│       ├── setup-repository.md    # Main wizard skill
│       └── references/
│           ├── boris-best-practices.md
│           ├── claude-md-examples.md
│           ├── command-templates.md
│           └── agent-templates.md
├── package.json
├── project.json
├── CLAUDE.md
└── README.md
```

## Skills

### /setup-repository

Interactive wizard that guides users through:

1. **Repository Analysis** - Detect project type, tooling, existing config
2. **CLAUDE.md Setup** - Create/enhance project instructions
3. **Slash Commands** - Add workflow automation
4. **Agents** - Add specialized assistants
5. **Hooks** - Configure auto-formatting
6. **Permissions** - Pre-approve safe commands

## References

The `references/` directory contains:

- Boris' best practices summary
- CLAUDE.md templates for different project types
- Command templates (commit-push-pr, test-and-fix, etc.)
- Agent templates (verify-app, code-simplifier, etc.)

## Design Principles

1. **Interactive** - Ask users what they want, don't assume
2. **Skip-friendly** - Every step can be skipped
3. **Repository-aware** - Detect and adapt to the project type
4. **Minimal** - Create only what's needed
5. **Documented** - Explain what's being created and why

## Triggering the Wizard

Users can invoke with:

- "setup claude"
- "init claude"
- "configure claude code"
- "setup repository"
- "boris setup"
- "/setup-repository"
