---
title: Contributing Guide
order: 1
---

# Contributing Guide

Thank you for your interest in contributing to Uniswap AI! This guide will help you get started.

## Prerequisites

- Node.js 22.x or later
- npm 11.7.0 or later
- Git
- Familiarity with TypeScript and Nx

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone
git clone https://github.com/YOUR_USERNAME/uniswap-ai.git
cd uniswap-ai
```

### 2. Install Dependencies

```bash
# Ensure you have the correct npm version
npm install -g npm@11.7.0

# Install dependencies
npm install
```

### 3. Verify Setup

```bash
# Run tests
npx nx run-many --target=test

# Build all packages
npx nx run-many --target=build

# Start docs dev server
npm run docs:dev
```

## Development Workflow

### Creating Changes

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code guidelines

3. **Test your changes**:

   ```bash
   # Run affected tests
   npx nx affected --target=test

   # Run affected linting
   npx nx affected --target=lint

   # Check formatting
   npx nx format:check
   ```

4. **Commit using conventional commits**:

   ```bash
   git commit -m "feat(hooks): add new feature"
   ```

### Pull Request Process

1. Push your branch and create a PR
2. Ensure all CI checks pass
3. Request review from maintainers
4. Address any feedback
5. Once approved, the PR will be merged

## Code Guidelines

### TypeScript

- Use strict TypeScript (`strict: true`)
- Never use `any` - prefer `unknown` with type guards
- Use explicit types at function boundaries
- Prefer union types over enums

### Nx Usage

- All packages must be Nx projects
- Use Nx commands for build, test, lint
- Leverage Nx caching and affected detection

### Documentation

After making changes:

1. Update relevant CLAUDE.md files
2. Update README.md if needed
3. Add/update documentation in `docs/`
4. Run `npm exec markdownlint-cli2 -- --fix "**/*.md"`

## Creating New Packages

### New Plugin

```bash
# Plugins go in packages/plugins/
mkdir -p packages/plugins/my-plugin
```

Each plugin needs:

- `package.json` with plugin metadata
- `project.json` for Nx configuration
- `.claude-plugin/plugin.json` manifest
- `README.md` documentation

### New Skill

Skills are defined in `packages/plugins/*/skills/`:

```bash
mkdir -p packages/plugins/uniswap-hooks/skills/my-skill
```

Each skill needs:

- `SKILL.md` - The skill definition
- Corresponding eval suite in `evals/suites/`

## Eval Requirements

All new skills **must** have corresponding evaluation suites:

```bash
# Create eval suite for new skill
mkdir -p evals/suites/my-skill/cases
mkdir -p evals/suites/my-skill/rubrics
```

See [Writing Evals](/evals/writing-evals) for details.

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Description           |
| ---------- | --------------------- |
| `feat`     | New feature           |
| `fix`      | Bug fix               |
| `docs`     | Documentation only    |
| `style`    | Formatting changes    |
| `refactor` | Code restructuring    |
| `test`     | Adding/updating tests |
| `chore`    | Maintenance tasks     |

### Scopes

- `hooks` - uniswap-hooks plugin
- `cca` - uniswap-cca plugin
- `trading` - uniswap-trading plugin
- `viem` - uniswap-viem plugin
- `driver` - uniswap-driver plugin
- `evals` - Evaluation framework
- `docs` - Documentation
- `ci` - CI/CD workflows

## Getting Help

- Open an issue for bugs or feature requests
- Join the [Uniswap Discord](https://discord.gg/uniswap) for discussions
- Check existing issues before creating new ones

## Related

- [PR Workflow](/contributing/pr-workflow) - Detailed PR process
- [Architecture](/architecture/) - Project architecture
- [Evals](/evals/) - Evaluation framework
