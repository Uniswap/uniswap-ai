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

- **Plugins** - Self-contained Claude Code plugins with skills and agents
- **Evals** - Evaluation suites for testing AI tool quality

### Nx-Powered

All packages use [Nx](https://nx.dev) for:

- Dependency graph management
- Build caching and optimization
- Affected command detection
- Consistent tooling across packages

## High-Level Structure

```text
uniswap-ai/
├── packages/
│   └── plugins/              # Claude Code plugins
│       ├── uniswap-hooks/    # V4 hook development
│       ├── uniswap-cca/      # CCA auction configuration & deployment
│       ├── uniswap-trading/  # Swap integration
│       ├── uniswap-viem/     # EVM blockchain integration (viem/wagmi)
│       └── uniswap-driver/   # Swap & liquidity deep link planning
├── evals/                    # AI tool evaluations
├── docs/                     # This documentation
└── .github/                  # CI/CD workflows
```

## Package Relationships

```text
┌───────────────────────────────────────────────────────┐
│                    Claude Code                         │
│                    (Runtime)                           │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────┐
│                     Plugins                            │
│  ┌───────────────┐ ┌───────────────┐ ┌─────────────┐ │
│  │ uniswap-hooks │ │ uniswap-cca   │ │uniswap-viem │ │
│  │ (2 skills)    │ │ (2 skills +   │ │ (1 skill +  │ │
│  │               │ │  MCP server)  │ │  1 agent)   │ │
│  └───────────────┘ └───────────────┘ └─────────────┘ │
│  ┌─────────────────┐ ┌───────────────┐                │
│  │uniswap-trading  │ │uniswap-driver │                │
│  │ (1 skill +      │ │ (2 skills)    │                │
│  │  1 agent)       │ │               │                │
│  └─────────────────┘ └───────────────┘                │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────┐
│                      Evals                             │
│  ┌─────────────────────────────────────────────────┐  │
│  │   Promptfoo-based evaluation framework           │  │
│  │   One suite per skill                             │  │
│  │   Measures: accuracy, safety, completeness       │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

## Key Technologies

| Technology                                            | Purpose                                  |
| ----------------------------------------------------- | ---------------------------------------- |
| [Nx](https://nx.dev)                                  | Monorepo management, build orchestration |
| [VitePress](https://vitepress.dev)                    | Documentation site generation            |
| [Promptfoo](https://github.com/promptfoo/promptfoo)   | AI evaluation framework                  |
| [TypeScript](https://www.typescriptlang.org)          | Type-safe development                    |
| [GitHub Actions](https://github.com/features/actions) | CI/CD automation                         |

## Next Steps

- [Monorepo Structure](/architecture/monorepo-structure) - Detailed package organization
- [Contributing](/contributing/) - How to contribute to the project
- [Plugins](/plugins/) - Plugin development guide
