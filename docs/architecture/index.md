---
title: Architecture Overview
order: 1
---

# Architecture Overview

Uniswap AI is built as an Nx monorepo designed for modularity, extensibility, and agent-agnostic operation.

## Design Principles

### Agent-Agnostic

All tools in this repository are designed to work with any LLM coding agent, not just Claude Code:

- Documentation uses standard markdown (AGENTS.md symlinks to CLAUDE.md)
- Prompts avoid model-specific assumptions
- Skills are structured as interpretable markdown
- Tools use standard JSON Schema definitions

### Modular Architecture

The codebase is organized into independent packages:

- **Plugins** - Self-contained Claude Code plugins with skills, agents, and commands
- **SDKs** - Reusable TypeScript libraries for common functionality
- **Evals** - Evaluation suites for testing AI tool quality

### Nx-Powered

All packages use [Nx](https://nx.dev) for:

- Dependency graph management
- Build caching and optimization
- Affected command detection
- Consistent tooling across packages

## High-Level Structure

```
uniswap-ai/
├── packages/
│   └── plugins/          # Claude Code plugins
│       └── uniswap-hooks/  # Uniswap V4 hooks plugin
├── evals/                # AI tool evaluations
├── docs/                 # This documentation
└── .github/              # CI/CD workflows
```

## Package Relationships

```
┌─────────────────────────────────────────────────────┐
│                   Claude Code                        │
│                   (Runtime)                          │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                    Plugins                           │
│  ┌─────────────────────────────────────────────┐    │
│  │           uniswap-hooks                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │    │
│  │  │  Skills  │ │  Agents  │ │ Commands │    │    │
│  │  └──────────┘ └──────────┘ └──────────┘    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                     Evals                            │
│  ┌──────────────────────────────────────────────┐   │
│  │  promptfoo-based evaluation framework         │   │
│  │  Measures: accuracy, safety, completeness     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Key Technologies

| Technology | Purpose |
|------------|---------|
| [Nx](https://nx.dev) | Monorepo management, build orchestration |
| [VitePress](https://vitepress.dev) | Documentation site generation |
| [Promptfoo](https://github.com/promptfoo/promptfoo) | AI evaluation framework |
| [TypeScript](https://www.typescriptlang.org) | Type-safe development |
| [GitHub Actions](https://github.com/features/actions) | CI/CD automation |

## Next Steps

- [Monorepo Structure](/architecture/monorepo-structure) - Detailed package organization
- [Contributing](/contributing/) - How to contribute to the project
- [Plugins](/plugins/) - Plugin development guide
