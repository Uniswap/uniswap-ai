# CLAUDE.md - Uniswap AI Project Guidelines

## Overview

This is the **uniswap-ai** monorepo providing Uniswap-specific AI tools (skills, plugins, agents) for external developers and AI agents integrating the Uniswap ecosystem.

**Differentiation from ai-toolkit:**

- **ai-toolkit** = General development workflow plugins (internal focus)
- **uniswap-ai** = Uniswap protocol-specific AI tools (external focus)

## Core Requirements

### Nx Usage

- **REQUIREMENT**: Use Nx for ALL packages and tooling in this monorepo
- Every package must be an Nx project with proper configuration
- Use Nx generators, executors, and workspace features wherever possible
- Leverage Nx's dependency graph and caching capabilities

### Package Structure

- All packages must be properly configured Nx libraries or applications
- Use Nx's project.json for configuration
- Follow Nx best practices for monorepo organization

### Development Workflow

- Use Nx commands for all operations (build, test, lint, etc.)
- Maintain proper inter-package dependencies through Nx
- Ensure all packages are part of the Nx workspace graph

### Code Quality Enforcement

After making any code changes, Claude Code MUST:

1. **Format the code**: Run `npx nx format:write --uncommitted` to format all uncommitted files
2. **Lint the code**: Run `npx nx affected --target=lint --base=HEAD~1` to check for linting errors
3. **Typecheck the code**: Run `npx nx affected --target=typecheck --base=HEAD~1` to typecheck affected projects
4. **Lint markdown files**: Run `npm exec markdownlint-cli2 -- --fix "**/*.md"`

## Package Scopes

| Type | Scope | npm | Marketplace |
|------|-------|-----|-------------|
| Plugins | `@uniswap` | No | Yes (Claude Code Marketplace) |
| SDKs | `@uniswap-ai` | Yes | N/A |
| Utils | `@uniswap-ai` | Yes | N/A |

## Repository Structure

```text
uniswap-ai/
├── .github/
│   ├── workflows/           # CI/CD workflows
│   ├── actions/             # Reusable composite actions
│   └── scripts/             # CI scripts
├── .claude-plugin/
│   └── marketplace.json     # Claude Code marketplace config
├── .claude/
│   └── rules/               # Agent rules (agnostic design)
├── docs/                    # VitePress documentation
├── evals/                   # AI tool evaluations
│   ├── framework/           # Eval harness
│   └── suites/              # Per-tool eval suites
├── packages/
│   ├── plugins/             # Claude Code plugins
│   │   └── uniswap-hooks/   # Uniswap V4 hooks plugin
│   ├── sdk/                 # TypeScript SDKs
│   ├── prompts/             # Shared prompt templates
│   └── utils/               # Shared utilities
├── scripts/                 # Build/validation scripts
├── nx.json
├── package.json
├── tsconfig.base.json
├── CLAUDE.md                # This file
├── AGENTS.md -> CLAUDE.md   # Symlink for agent-agnostic access
├── LICENSE                  # MIT
└── README.md
```

### Plugin Architecture

Plugins are stored in `./packages/plugins/<plugin-name>/`:

- Each plugin is a self-contained Nx package with `package.json`, `project.json`, and `.claude-plugin/plugin.json`
- The `.claude-plugin/marketplace.json` references plugins via relative paths
- Plugin validation: `node scripts/validate-plugin.cjs packages/plugins/<plugin-name>`

### Plugin Versioning

All plugins follow semantic versioning (semver):

- **Patch (1.0.X)**: Bug fixes, minor documentation updates
- **Minor (1.X.0)**: New skills, agents, or commands (backward compatible)
- **Major (X.0.0)**: Breaking changes, significant restructuring

After making any changes to `packages/plugins/`, bump the plugin version in `.claude-plugin/plugin.json`.

## Agent-Agnostic Design

All AI tools in this repo should be usable by ANY LLM coding agent, not just Claude Code:

1. **Documentation**: Use AGENTS.md (symlink to CLAUDE.md) as standard
2. **Prompts**: Write prompts that work across models (avoid Claude-specific features unless necessary)
3. **Skills**: Structure skills as markdown that any agent can interpret
4. **No vendor lock-in**: Prefer standards over proprietary features
5. **Testing**: Evals should work with multiple LLM backends

## Evals Framework

Evals are to AI tools what tests are to traditional code:

- Each skill/plugin should have an eval suite
- Cases are markdown prompts with expected behaviors
- Run on PR to catch regressions
- Support multiple LLM backends for comparison

## npm Version Requirement

**CRITICAL: This project requires npm 11.7.0**

```bash
npm install -g npm@11.7.0
npm --version  # Should output: 11.7.0
```

## GitHub Actions Best Practices

### Action Pinning

Always pin external actions to specific commit hashes with version comments:

```yaml
- uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
```

### Expression Injection Prevention

Never use `${{ }}` expressions directly in bash scripts. Use environment variables instead:

```yaml
- name: Process input
  env:
    INPUT_VALUE: ${{ github.event.inputs.value }}
  run: |
    echo "Processing: $INPUT_VALUE"
```

### Bullfrog Security Scanning

Every job running on non-macOS runners MUST have `bullfrogsec/bullfrog` as the FIRST step.

## Documentation Management

### CLAUDE.md File Management

After changes to files in this repository, update the relevant CLAUDE.md file to reflect the changes.

### README.md File Management

Check all README.md files in directories with changes and update if appropriate.

## Nx Guidelines

- When running tasks, always prefer running through `nx` (i.e., `nx run`, `nx run-many`, `nx affected`)
- Use `nx_workspace` tool to understand workspace architecture
- Use `nx_project_details` to analyze specific project structure
- Use `nx_docs` for configuration questions and best practices
