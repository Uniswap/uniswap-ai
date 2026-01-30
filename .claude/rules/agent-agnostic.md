# Agent-Agnostic Design Rules

## Core Principle

All AI tools in this repository should be usable by ANY LLM coding agent, not just Claude Code. This ensures maximum interoperability and adoption across different AI development environments.

## Guidelines

### 1. Documentation Standards

- Use **AGENTS.md** (symlink to CLAUDE.md) as the standard entry point
- Both files contain identical content, allowing any agent to find instructions
- Prefer common markdown syntax over proprietary extensions

### 2. Prompt Design

- Write prompts that work across models (GPT-4, Claude, Gemini, etc.)
- Avoid Claude-specific features unless absolutely necessary
- When Claude-specific features are needed, document alternatives for other models
- Use clear, explicit instructions that don't rely on model-specific behaviors

### 3. Skill Structure

- Skills are structured as markdown that any agent can interpret
- Use standard YAML frontmatter for metadata
- Keep skill files self-contained with all necessary context
- Avoid implicit dependencies on specific model capabilities

### 4. Tool Definitions

- Define tools using standard JSON Schema
- Avoid tool names or patterns that only work with specific platforms
- Document expected inputs and outputs clearly
- Provide examples that work across different execution environments

### 5. Evaluation Framework

- Evals should work with multiple LLM backends
- Use model-agnostic evaluation metrics where possible
- Support configurable model selection in eval runners
- Document any model-specific considerations

## Implementation Checklist

When creating new tools, verify:

- [ ] Documentation uses standard markdown
- [ ] Prompts avoid model-specific assumptions
- [ ] Frontmatter follows common conventions
- [ ] Examples work without Claude-specific features
- [ ] Evals can run with different models

## Exceptions

Some features may require Claude-specific implementations:

- Claude Code plugin integration (marketplace, slash commands)
- Extended thinking or specific model capabilities

When exceptions are necessary:

1. Document the requirement clearly
2. Provide graceful degradation for other models
3. Consider abstraction layers for portability
