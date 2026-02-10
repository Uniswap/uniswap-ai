---
title: Monorepo Structure
order: 2
---

# Monorepo Structure

This page details the organization of the uniswap-ai repository.

## Directory Layout

```
uniswap-ai/
├── .claude/                # Claude Code configuration
│   └── rules/              # Agent rules (agnostic design)
├── .claude-plugin/         # Claude Code marketplace config
│   └── marketplace.json    # Plugin registry
├── .github/
│   ├── actions/            # Reusable composite actions
│   ├── workflows/          # CI/CD workflows
│   └── vale/               # Prose linting styles
├── docs/                   # VitePress documentation
│   ├── .vitepress/         # VitePress configuration
│   ├── api/                # Auto-generated API docs
│   ├── architecture/       # Architecture documentation
│   ├── contributing/       # Contribution guides
│   ├── evals/              # Eval framework docs
│   ├── getting-started/    # Getting started guides
│   ├── plugins/            # Plugin documentation
│   └── skills/             # Skill documentation
├── evals/                  # AI tool evaluations
│   ├── framework/          # Eval framework types
│   ├── rubrics/            # Shared evaluation rubrics
│   ├── scripts/            # Custom providers
│   ├── suites/             # Per-skill eval suites
│   └── templates/          # Templates for new suites
├── packages/
│   └── plugins/            # Claude Code plugins
├── scripts/                # Build/validation scripts
├── AGENTS.md -> CLAUDE.md  # Symlink for agent-agnostic access
├── CLAUDE.md               # Project guidelines
├── nx.json                 # Nx workspace configuration
├── package.json            # Root package configuration
├── tsconfig.base.json      # Base TypeScript config
└── typedoc.json            # API documentation config
```

## Package Scopes

| Type | Scope | npm | Marketplace |
|------|-------|-----|-------------|
| Plugins | `@uniswap` | No | Yes (Claude Code Marketplace) |

## Nx Configuration

### Workspace (nx.json)

The workspace is configured with:

- **Plugins**: TypeScript, ESLint, Jest
- **Caching**: Build outputs cached in `node_modules/.cache/nx`
- **Parallel execution**: Up to 5 concurrent tasks
- **Release**: Conventional commits with independent versioning

### Project Configuration

Each package has a `project.json` with:

```json
{
  "name": "package-name",
  "projectType": "library",
  "targets": {
    "build": { ... },
    "test": { ... },
    "lint": { ... }
  }
}
```

## Plugin Structure

Each plugin in `packages/plugins/` follows this structure:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest
├── skills/                 # AI skills
│   └── skill-name/
│       ├── SKILL.md       # Skill definition
│       └── references/    # Supporting materials
├── agents/                 # Specialized agents
├── commands/               # Slash commands
├── package.json           # Package metadata
├── project.json           # Nx configuration
└── README.md              # Plugin documentation
```

## Evals Structure

Evaluation suites in `evals/suites/` follow this structure:

```
suite-name/
├── cases/                  # Test case prompts
│   └── test-name.md
├── expected/               # Expected behaviors
│   └── test-name.md
├── rubrics/                # Suite-specific rubrics
├── promptfoo.yaml          # Suite configuration
└── README.md               # Suite documentation
```

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project guidelines and AI agent instructions |
| `AGENTS.md` | Symlink to CLAUDE.md for agent-agnostic access |
| `nx.json` | Nx workspace configuration |
| `typedoc.json` | API documentation generation config |
| `.vale.ini` | Prose linting configuration |

## Related

- [Architecture Overview](/architecture/) - High-level design
- [Contributing](/contributing/) - How to contribute
- [Plugins](/plugins/) - Plugin development
