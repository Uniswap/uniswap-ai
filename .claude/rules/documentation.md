# Documentation Sync Rules

## When to Update VitePress Docs

When creating or modifying plugins or skills, ensure corresponding VitePress documentation pages exist and are up to date.

### Plugin Changes

When a plugin is added or modified in `packages/plugins/`:

1. Ensure `docs/plugins/{plugin-name}.md` exists and reflects the current state
2. Update `docs/plugins/index.md` to include the plugin in the table
3. Run `node scripts/validate-docs.cjs` to verify

### Skill Changes

When a skill is added or modified in `packages/plugins/*/skills/`:

1. Ensure `docs/skills/{skill-name}.md` exists and reflects the current state
2. Update `docs/skills/index.md` to include the skill in the appropriate plugin section
3. Run `node scripts/validate-docs.cjs` to verify

### Doc Page Format

Plugin and skill doc pages use YAML frontmatter with `title` and `order` fields. The VitePress sidebar auto-generates from these files.

### Validation

Run `node scripts/validate-docs.cjs` before committing changes to plugins or skills. This is also enforced in CI via the `validate-docs` job.
