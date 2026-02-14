# CLAUDE.md - Uniswap AI Project Guidelines

## Overview

This is the **uniswap-ai** monorepo providing Uniswap-specific AI tools (skills, plugins, agents) for external developers and AI agents integrating the Uniswap ecosystem.

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
5. **Lint documentation prose**: Run `npm run docs:lint` to check documentation quality with Vale

## Package Scopes

| Type    | Scope      | npm | Marketplace                   |
| ------- | ---------- | --- | ----------------------------- |
| Plugins | `@uniswap` | No  | Yes (Claude Code Marketplace) |

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
├── evals/                   # AI tool evaluations (Promptfoo)
│   ├── rubrics/             # Shared evaluation rubrics
│   ├── scripts/             # Custom providers and utilities
│   ├── suites/              # Per-skill eval suites
│   └── templates/           # Templates for new suites
├── packages/
│   └── plugins/             # Claude Code plugins
│       ├── uniswap-cca/     # Continuous Clearing Auction (CCA) plugin
│       ├── uniswap-driver/  # Swap & liquidity deep link planning
│       ├── uniswap-hooks/   # Uniswap V4 hooks plugin
│       ├── uniswap-trading/ # Uniswap swap integration
│       └── uniswap-viem/    # EVM blockchain integration (viem/wagmi)
├── repo-docs/               # Standalone documents (hackathon, overview)
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

Evals are to AI tools what tests are to traditional code. This project uses [Promptfoo](https://github.com/promptfoo/promptfoo) for declarative, CI-integrated evaluations.

### Structure

```text
evals/
├── promptfoo.yaml          # Root config with default providers
├── rubrics/                # Shared evaluation rubrics (.txt files)
│   └── security-checklist.txt
├── scripts/
│   └── anthropic-provider.ts  # Custom provider for OAuth support
├── suites/                 # Per-skill eval suites
│   └── <skill-name>/
│       ├── promptfoo.yaml  # Suite-specific config
│       ├── cases/          # Test case prompts (markdown)
│       └── rubrics/        # Skill-specific rubrics (.txt files)
└── templates/              # Templates for new suites
```

> **Note**: Rubric files must use `.txt` extension (not `.md`). Promptfoo's grader only supports `.txt`, `.json`, and `.yaml` for `file://` references in assertions.

### Setup (One-Time)

```bash
# Requires 1Password CLI (https://developer.1password.com/docs/cli/get-started)
eval $(op signin)
nx run evals:setup
```

Or set environment variables directly:

```bash
export ANTHROPIC_API_KEY=sk-ant-...       # CI, production
# OR
export CLAUDE_CODE_OAUTH_TOKEN=<token>    # Local development
```

### Running Evals

```bash
nx run evals:eval --suite=aggregator-hook-creator  # Run specific suite
nx run evals:eval:all                               # Run all suites
nx run evals:eval:view                              # Open results viewer
nx run evals:eval:cache-clear                       # Clear cache
```

### Creating New Eval Suites

1. Copy `evals/templates/suite/` to `evals/suites/<skill-name>/`
2. Rename `.template` files (remove `.template` extension)
3. Replace `{{SKILL_NAME}}` placeholders
4. Add test cases in `cases/` directory
5. Define rubrics in `rubrics/` directory
6. Update `promptfoo.yaml` with your prompts and assertions

### CI Integration

Evals run automatically on PRs that modify:

- `packages/plugins/**`
- `evals/**`

Pass rate must be ≥85% for PR to pass. Results include inference cost tracking.

### Writing Good Eval Cases

- Focus on **outputs**, not prescribed paths
- Include edge cases and security probes for smart contract code
- Use deterministic checks (`contains`, `not-contains`) for required patterns
- Use LLM rubrics for qualitative assessment

## npm Version Requirement

**CRITICAL: This project requires npm >=11.7.0**

```bash
npm install -g npm@latest
npm --version  # Should output: 11.7.0 or higher
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

### VitePress Documentation (`docs/`)

When modifying plugins or skills, update the corresponding VitePress documentation pages:

- **Plugin added/modified**: Update or create `docs/plugins/{plugin-name}.md`
- **Skill added/modified**: Update or create `docs/skills/{skill-name}.md`
- **Plugin/skill added or removed**: Update index pages:
  - `docs/plugins/index.md` - table of all plugins
  - `docs/skills/index.md` - table of all skills grouped by plugin
  - `docs/index.md` - featured skills section (if applicable)

Run `node scripts/validate-docs.cjs` to verify all documentation pages exist. This check is enforced in CI.

### CLAUDE.md File Management

After changes to files in this repository, update the relevant CLAUDE.md file to reflect the changes.

### README.md File Management

Check all README.md files in directories with changes and update if appropriate.

## Skills

Skills are discoverable via the [skills.sh CLI](https://skills.sh) (`npx skills add Uniswap/uniswap-ai`).

### Adding New Skills

1. Create the skill directory in `packages/plugins/<plugin-name>/skills/<skill-name>/`
2. Add a `SKILL.md` file with required frontmatter (`name`, `description`, `license`, `metadata.author`)
3. Add the skill to the plugin's `plugin.json` `skills` array
4. Create a documentation page at `docs/skills/<skill-name>.md`
5. Update `docs/skills/index.md` to include the new skill
6. CI `validate-skills` and `validate-docs` jobs will verify consistency

### Publishing

Merging to main = publishing to skills.sh. The CLI fetches directly from the repo's default branch. No separate publish step is required.

### CI Validation

The `validate-skills` job in PR checks enforces:

- Required frontmatter fields (`name`, `description`, `license`, `metadata.author`)
- Name consistency (frontmatter name matches directory name)
- Consistency between `plugin.json` skills array and skill directories
- Prerequisite existence (referenced skills exist across plugins)

## Nx Guidelines

- When running tasks, always prefer running through `nx` (i.e., `nx run`, `nx run-many`, `nx affected`)
- Use `nx_workspace` tool to understand workspace architecture
- Use `nx_project_details` to analyze specific project structure
- Use `nx_docs` for configuration questions and best practices
