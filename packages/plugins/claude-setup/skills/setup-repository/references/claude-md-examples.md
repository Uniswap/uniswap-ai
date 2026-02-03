# CLAUDE.md Examples

Example CLAUDE.md files for different project types. Use these as starting points.

---

## Node.js Project (Basic)

```markdown
# CLAUDE.md

## Project Overview

[Project name] - [Brief description]

## Commands

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Run linter

### Git Workflow

- Never use `git add .` - add files individually
- Use conventional commits: `type(scope): description`

## Code Style

- Use TypeScript strict mode
- Prefer named exports over default exports
- Use `type` imports for type-only imports

## Learnings

<!-- Add mistakes Claude makes here so it learns -->
```

---

## React/Next.js Project

```markdown
# CLAUDE.md

## Project Overview

Next.js application with [brief description].

## Commands

### Development

- `npm run dev` - Start dev server at localhost:3000
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm test` - Run Jest tests
- `npm run lint` - ESLint check

## Architecture

### Directory Structure

- `app/` - Next.js App Router pages
- `components/` - React components
- `lib/` - Utility functions
- `hooks/` - Custom React hooks

### Patterns

- Use Server Components by default
- Client Components only when needed (useState, useEffect, events)
- Colocate components with their pages when possible

## Code Style

- Functional components only (no classes)
- Use TypeScript for all files
- CSS: Tailwind utility classes

## Testing

- Unit tests: Jest + React Testing Library
- Run specific test: `npm test -- path/to/test`

## Learnings

<!-- Add project-specific learnings here -->
```

---

## Python Project

```markdown
# CLAUDE.md

## Project Overview

Python [library/application] for [description].

## Commands

### Development

- `poetry install` - Install dependencies
- `poetry run pytest` - Run tests
- `poetry run mypy .` - Type checking
- `poetry run ruff check .` - Linting

### Virtual Environment

- Always use Poetry for dependency management
- `poetry shell` to activate environment

## Code Style

- Follow PEP 8
- Use type hints for all functions
- Docstrings for public functions (Google style)

## Project Structure

- `src/` - Source code
- `tests/` - Test files (mirror src structure)
- `pyproject.toml` - Project configuration

## Learnings
```

---

## Monorepo (Nx/Turbo)

```markdown
# CLAUDE.md

## Project Overview

Monorepo containing [list of packages/apps].

## Commands

### Nx Commands

- `npx nx build [project]` - Build specific project
- `npx nx test [project]` - Test specific project
- `npx nx affected --target=build` - Build affected projects
- `npx nx affected --target=test` - Test affected projects
- `npx nx graph` - Visualize dependency graph

### Project References

- Use `npx nx show project [name]` to see project details
- Use `npx nx list` to see available plugins

## Architecture

### Package Structure

- `packages/` - Shared libraries
- `apps/` - Applications
- Each package has its own `package.json` and `project.json`

### Dependencies

- Inter-package dependencies through Nx
- External dependencies in root `package.json`

## Code Quality

After changes, run:

1. `npx nx format:write --uncommitted`
2. `npx nx affected --target=lint`
3. `npx nx affected --target=test`

## Learnings
```

---

## Rust Project

```markdown
# CLAUDE.md

## Project Overview

Rust [library/binary] for [description].

## Commands

- `cargo build` - Build project
- `cargo test` - Run tests
- `cargo clippy` - Linting
- `cargo fmt` - Format code
- `cargo doc --open` - Generate and view docs

## Code Style

- Follow Rust API guidelines
- Use `?` for error propagation
- Prefer `impl Trait` over generics where possible

## Project Structure

- `src/lib.rs` - Library root
- `src/main.rs` - Binary entry (if applicable)
- `tests/` - Integration tests

## Error Handling

- Use `thiserror` for library errors
- Use `anyhow` for application errors

## Learnings
```

---

## Go Project

```markdown
# CLAUDE.md

## Project Overview

Go [service/library] for [description].

## Commands

- `go build ./...` - Build all packages
- `go test ./...` - Run all tests
- `go vet ./...` - Static analysis
- `golangci-lint run` - Extended linting

## Code Style

- Follow Effective Go guidelines
- Use `gofmt` for formatting
- Keep functions small and focused

## Project Structure

- `cmd/` - Main applications
- `internal/` - Private packages
- `pkg/` - Public packages

## Error Handling

- Always check errors
- Wrap errors with context: `fmt.Errorf("doing thing: %w", err)`

## Learnings
```

---

## Template Variables

When generating CLAUDE.md, detect and fill these variables:

| Variable            | Detection Method                                                             |
| ------------------- | ---------------------------------------------------------------------------- |
| `{project_name}`    | `package.json` name or directory name                                        |
| `{description}`     | `package.json` description or README first paragraph                         |
| `{build_cmd}`       | `package.json` scripts.build                                                 |
| `{test_cmd}`        | `package.json` scripts.test                                                  |
| `{lint_cmd}`        | `package.json` scripts.lint                                                  |
| `{package_manager}` | Lockfile detection (package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb) |
| `{framework}`       | Dependency detection (next, react, vue, etc.)                                |
