# ECO-81: Migration Plan - uniswap-trading Plugin to uniswap-ai

**Linear task**: [ECO-81](https://linear.app/uniswap/issue/ECO-81/move-uniswap-trading-plugin-to-uniswap-ai-repository)
**Status**: Reviewed (pending Q approval)
**Date**: 2026-02-10

## Executive Summary

Migrate the `uniswap-trading` plugin from `ai-toolkit` to `uniswap-ai`, splitting it into **two focused plugins** that follow Claude Code marketplace best practices for single-responsibility plugins.

## Current State

### Source Plugin (ai-toolkit)

Location: `ai-toolkit/packages/plugins/uniswap-trading/`

| Component                 | Type                        | Category | Lines  |
| ------------------------- | --------------------------- | -------- | ------ |
| `viem-integration`        | Skill (+ 6 reference files) | Tooling  | ~3,130 |
| `swap-integration`        | Skill                       | Protocol | ~1,006 |
| `viem-integration-expert` | Agent                       | Tooling  | ~50    |
| `swap-integration-expert` | Agent                       | Protocol | ~70    |

- **Zero runtime dependencies** -- pure markdown/documentation plugin
- **No commands, hooks, or MCP servers**
- **No build artifacts** -- nothing to compile

### Target Repository (uniswap-ai)

- Nx monorepo with one existing plugin (`uniswap-hooks`)
- Well-established conventions for plugin structure, validation, CI/CD
- Eval framework requiring coverage for every skill

## Decision: Split into Two Plugins

### Rationale

The current `uniswap-trading` plugin bundles two distinct concerns:

1. **Generic EVM tooling** (viem/wagmi) -- Not Uniswap-specific at all. Useful for any EVM developer.
2. **Uniswap protocol integration** (swaps) -- Deeply Uniswap-specific.

Splitting follows the single-responsibility principle and Claude Code marketplace best practices:

- Developers who only need viem/wagmi help don't need to install swap-specific content
- Developers who already know viem can install just the swap plugin
- Each plugin has a clear, discoverable purpose in the marketplace
- Smaller, focused plugins are easier to maintain, version, and evaluate

### Additional Consideration: wagmi-react.md

The `wagmi-react.md` reference file within viem-integration is **frontend/React-specific** (useAccount, useConnect, useReadContract, useWriteContract, useSwitchChain). This is the "UI coupling" mentioned in the task description.

**Recommendation**: Keep `wagmi-react.md` in the viem plugin. It's a reference file within the viem-integration skill, not a standalone skill. Splitting it out would break the skill's completeness without meaningful benefit. The viem plugin naturally covers both Node.js and React usage patterns -- that's the scope of viem/wagmi as libraries.

## Proposed Plugin Architecture

### Plugin 1: `uniswap-viem` (NEW)

**Purpose**: Foundational EVM blockchain integration using viem and wagmi.

```text
packages/plugins/uniswap-viem/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── viem-integration-expert.md
├── skills/
│   └── viem-integration/
│       ├── viem-integration.md
│       ├── SKILL.md -> viem-integration.md
│       └── references/
│           ├── clients-and-transports.md
│           ├── reading-data.md
│           ├── writing-transactions.md
│           ├── accounts-and-keys.md
│           ├── contract-patterns.md
│           └── wagmi-react.md
├── project.json
├── package.json
├── CLAUDE.md
└── README.md
```

**Naming rationale**: `uniswap-viem` clearly identifies this as viem/wagmi tooling within the Uniswap ecosystem. Alternative considered: `evm-toolkit` -- rejected because the `@uniswap` scope already establishes context, and `viem` is more specific/discoverable than `evm`.

**Note on reference file reorganization**: The current structure places reference files as siblings of the main skill file. The uniswap-hooks reference pattern uses a `references/` subdirectory. We adopt the `references/` pattern for consistency with the target repo.

### Plugin 2: `uniswap-trading` (RENAMED from uniswap-trading)

**Purpose**: Uniswap swap integration via Trading API, Universal Router, and SDKs.

```text
packages/plugins/uniswap-trading/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── swap-integration-expert.md
├── skills/
│   └── swap-integration/
│       ├── swap-integration.md
│       └── SKILL.md -> swap-integration.md
├── project.json
├── package.json
├── CLAUDE.md
└── README.md
```

**Naming rationale**: Renamed from `uniswap-trading` to `uniswap-trading` per domain expert review. "Builder" is overly generic and undiscoverable -- a developer searching for "Uniswap swap" or "Uniswap trading" won't find "builder" intuitively. "Trading" best covers Trading API, swaps, and potential future features (limit orders, Dutch auctions). Alternative considered: `uniswap-swaps` -- also viable but more limiting.

### Cross-Plugin Dependency

`swap-integration` skill currently references `../viem-integration/viem-integration.md` as a prerequisite. After splitting:

- **Remove the relative path reference** (it will be cross-plugin, not cross-directory)
- **Add a textual note** in the swap-integration skill: "This skill assumes familiarity with viem basics. Install the `uniswap-viem` plugin for comprehensive viem/wagmi guidance."
- **Add a `relatedPlugins` note** in the swap-integration plugin's CLAUDE.md and README.md

This is a soft dependency (documentation reference), not a hard dependency. The swap skill works independently -- it just recommends the viem skill for prerequisite knowledge.

## File-by-File Migration Map

### Plugin 1: uniswap-viem

| Source (ai-toolkit)                                 | Target (uniswap-ai)                                                                          | Action                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------ |
| `skills/viem-integration/viem-integration.md`       | `packages/plugins/uniswap-viem/skills/viem-integration/viem-integration.md`                  | Copy + update cross-references |
| `skills/viem-integration/SKILL.md`                  | `packages/plugins/uniswap-viem/skills/viem-integration/SKILL.md`                             | Recreate symlink               |
| `skills/viem-integration/clients-and-transports.md` | `packages/plugins/uniswap-viem/skills/viem-integration/references/clients-and-transports.md` | Copy (move into references/)   |
| `skills/viem-integration/reading-data.md`           | `packages/plugins/uniswap-viem/skills/viem-integration/references/reading-data.md`           | Copy (move into references/)   |
| `skills/viem-integration/writing-transactions.md`   | `packages/plugins/uniswap-viem/skills/viem-integration/references/writing-transactions.md`   | Copy (move into references/)   |
| `skills/viem-integration/accounts-and-keys.md`      | `packages/plugins/uniswap-viem/skills/viem-integration/references/accounts-and-keys.md`      | Copy (move into references/)   |
| `skills/viem-integration/contract-patterns.md`      | `packages/plugins/uniswap-viem/skills/viem-integration/references/contract-patterns.md`      | Copy (move into references/)   |
| `skills/viem-integration/wagmi-react.md`            | `packages/plugins/uniswap-viem/skills/viem-integration/references/wagmi-react.md`            | Copy (move into references/)   |
| `agents/viem-integration-expert.md`                 | `packages/plugins/uniswap-viem/agents/viem-integration-expert.md`                            | Copy + update reference paths  |
| (none)                                              | `packages/plugins/uniswap-viem/.claude-plugin/plugin.json`                                   | Create new                     |
| (none)                                              | `packages/plugins/uniswap-viem/package.json`                                                 | Create new                     |
| (none)                                              | `packages/plugins/uniswap-viem/project.json`                                                 | Create new                     |
| (none)                                              | `packages/plugins/uniswap-viem/CLAUDE.md`                                                    | Create new                     |
| (none)                                              | `packages/plugins/uniswap-viem/README.md`                                                    | Create new                     |

### Plugin 2: uniswap-trading

| Source (ai-toolkit)                           | Target (uniswap-ai)                                                            | Action                         |
| --------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------ |
| `skills/swap-integration/swap-integration.md` | `packages/plugins/uniswap-trading/skills/swap-integration/swap-integration.md` | Copy + update cross-references |
| `skills/swap-integration/SKILL.md`            | `packages/plugins/uniswap-trading/skills/swap-integration/SKILL.md`            | Recreate symlink               |
| `agents/swap-integration-expert.md`           | `packages/plugins/uniswap-trading/agents/swap-integration-expert.md`           | Copy                           |
| (none)                                        | `packages/plugins/uniswap-trading/.claude-plugin/plugin.json`                  | Create new                     |
| (none)                                        | `packages/plugins/uniswap-trading/package.json`                                | Create new                     |
| (none)                                        | `packages/plugins/uniswap-trading/project.json`                                | Create new                     |
| (none)                                        | `packages/plugins/uniswap-trading/CLAUDE.md`                                   | Create new                     |
| (none)                                        | `packages/plugins/uniswap-trading/README.md`                                   | Create new                     |

### Marketplace Config Update

| File                              | Action                                                    |
| --------------------------------- | --------------------------------------------------------- |
| `.claude-plugin/marketplace.json` | Add entries for both `uniswap-viem` and `uniswap-trading` |

## Required Modifications

### New Config Files

#### uniswap-viem/plugin.json

```json
{
  "name": "uniswap-viem",
  "version": "1.0.0",
  "description": "EVM blockchain integration using viem and wagmi - client setup, reading/writing data, accounts, contract interactions, and React hooks",
  "author": {
    "name": "Uniswap Labs",
    "email": "ai-services@uniswap.org"
  },
  "homepage": "https://github.com/uniswap/uniswap-ai",
  "keywords": ["viem", "wagmi", "evm", "blockchain", "ethereum", "web3", "react"],
  "license": "MIT",
  "skills": ["./skills/viem-integration"],
  "commands": ["./skills/viem-integration/viem-integration.md"],
  "agents": ["./agents/viem-integration-expert.md"]
}
```

#### uniswap-trading/plugin.json

```json
{
  "name": "uniswap-trading",
  "version": "1.0.0",
  "description": "Integrate Uniswap swaps via Trading API, Universal Router SDK, or direct smart contract calls",
  "author": {
    "name": "Uniswap Labs",
    "email": "ai-services@uniswap.org"
  },
  "homepage": "https://github.com/uniswap/uniswap-ai",
  "keywords": ["uniswap", "swap", "defi", "trading-api", "universal-router", "permit2"],
  "license": "MIT",
  "skills": ["./skills/swap-integration"],
  "commands": ["./skills/swap-integration/swap-integration.md"],
  "agents": ["./agents/swap-integration-expert.md"]
}
```

#### package.json (both plugins)

Follow the `uniswap-hooks` pattern:

- `@uniswap/uniswap-viem` and `@uniswap/uniswap-trading`
- `version: "0.0.1"`, `private: true`
- Repository URL: `https://github.com/uniswap/uniswap-ai.git`
- Include `"files": [".claude-plugin", "skills", "agents", "README.md"]`

#### project.json (both plugins)

Follow the `uniswap-hooks` pattern:

- `tags: ["type:plugin", "scope:uniswap"]`
- Targets: `lint-markdown` and `validate`
- `$schema` path relative to plugin location

### Content Modifications

1. **viem-integration.md**: Update all internal references to sibling files (e.g., `./clients-and-transports.md`) to use the new `./references/` subdirectory paths (e.g., `./references/clients-and-transports.md`). Remove the "Related Skills" cross-reference to swap-integration (the dependency is one-way: swap references viem, not vice versa).
2. **swap-integration.md**: Update the prerequisite reference to viem-integration from a relative path to a textual recommendation to install `uniswap-viem` plugin. Also **remove broken links** to non-existent `./trading-api.md` and `./universal-router.md` files (the content is inline, these dead links exist in the source).
3. **viem-integration-expert.md**: Update all relative paths to reference files (now under `references/` subdirectory, e.g., `../skills/viem-integration/references/...`)
4. **Skill frontmatter**: Add `name:` field to both skill YAML frontmatter (e.g., `name: viem-integration`, `name: swap-integration`) to match the uniswap-hooks convention
5. **All files**: Remove any `ai-toolkit` references in content
6. **Cross-plugin keywords**: Add `"uniswap-trading"` to uniswap-viem plugin.json keywords and `"uniswap-viem"` to uniswap-trading plugin.json keywords for marketplace discoverability

### Note: agents field in plugin.json

The uniswap-hooks reference plugin does not have an `agents` field in its plugin.json (it has no agents). Both new plugins introduce this field as an expansion of the plugin format. The validator does not reject this -- it's a new pattern being established.

### Marketplace Registration

Add to `.claude-plugin/marketplace.json`:

```json
{
  "name": "uniswap-viem",
  "source": "./packages/plugins/uniswap-viem",
  "description": "EVM blockchain integration using viem and wagmi"
},
{
  "name": "uniswap-trading",
  "source": "./packages/plugins/uniswap-trading",
  "description": "Integrate Uniswap swaps via Trading API, Universal Router, and SDKs"
}
```

## Cleanup Recommendations

1. **Remove ai-toolkit coupling**: Update all homepage URLs, repository URLs, and keyword references from `ai-toolkit` to `uniswap-ai`
2. **Adopt references/ subdirectory pattern**: Move viem reference files into `references/` subdirectory for consistency with `uniswap-hooks` plugin structure
3. **Update agent reference paths**: The `viem-integration-expert` agent references skill docs via relative paths -- update these to reflect the new `references/` subdirectory
4. **Add CLAUDE.md files**: Both plugins need CLAUDE.md following the pattern in `uniswap-hooks`
5. **Agent-agnostic design**: Verify all skills and agents follow the agent-agnostic design rules in `.claude/rules/agent-agnostic.md` (they should already, as they're pure markdown)

## Implementation Sequence

### Phase 1: Create Plugin Scaffolding

1. Create `packages/plugins/uniswap-viem/` directory structure
2. Create `packages/plugins/uniswap-trading/` directory structure
3. Write all config files (plugin.json, package.json, project.json)
4. Write CLAUDE.md and README.md for both plugins

### Phase 2: Copy and Adapt Content

5. Copy viem-integration skill files into `uniswap-viem`, reorganizing reference files into `references/`
6. Copy viem-integration-expert agent, updating reference paths
7. Copy swap-integration skill files into `uniswap-trading`
8. Copy swap-integration-expert agent

### Phase 2.5: Pre-Flight Check

Run markdownlint on source files to identify any formatting issues before migration:

- `npm exec markdownlint-cli2 -- '/Users/nick.koutrelakos/Projects/ai-toolkit.worktrees/next/packages/plugins/uniswap-trading/**/*.md'`

### Phase 3: Update Cross-References and Content

9. Update `viem-integration.md` internal references from `./[file].md` to `./references/[file].md`
10. Update `swap-integration.md` prerequisite reference to textual recommendation for `uniswap-viem`
11. Remove broken links to `./trading-api.md` and `./universal-router.md` in swap-integration.md
12. Update `viem-integration-expert.md` reference file paths for `references/` subdirectory
13. Add `name:` field to both skill YAML frontmatter
14. Add cross-plugin keywords to both plugin.json files
15. Remove all `ai-toolkit` references from content

### Phase 4: Register and Validate

16. Update `.claude-plugin/marketplace.json` with both new plugins
17. Run `npm install` to update workspace linkage
18. Run `node scripts/validate-plugin.cjs packages/plugins/uniswap-viem`
19. Run `node scripts/validate-plugin.cjs packages/plugins/uniswap-trading`
20. Run `npm exec markdownlint-cli2 -- 'packages/plugins/uniswap-viem/**/*.md'`
21. Run `npm exec markdownlint-cli2 -- 'packages/plugins/uniswap-trading/**/*.md'`

### Phase 5: Eval Scaffolding

22. Create eval suite scaffold for `viem-integration` in `evals/suites/viem-integration/`
23. Create eval suite scaffold for `swap-integration` in `evals/suites/swap-integration/`
24. (Eval content can be developed in a follow-up task)

### Phase 6: Documentation Updates

25. Update root `CLAUDE.md` repository structure section to include both new plugins
26. Verify Nx workspace graph includes both new projects (`nx graph`)

### Phase 7: Quality Checks

27. Run `npx nx format:write --uncommitted`
28. Run `npx nx affected --target=lint --base=HEAD~1`
29. Run `npm run docs:lint` (Vale)
30. Run pre-commit hooks to verify all pass

## Verification Checklist

- [ ] `uniswap-viem` plugin validates (`node scripts/validate-plugin.cjs`)
- [ ] `uniswap-trading` plugin validates (`node scripts/validate-plugin.cjs`)
- [ ] Both plugins appear in marketplace.json
- [ ] Both plugins appear in Nx project graph (`nx graph`)
- [ ] Markdown linting passes for both plugins
- [ ] No references to `ai-toolkit` remain in any migrated files
- [ ] SKILL.md symlinks work correctly
- [ ] Cross-references between plugins use textual recommendations (not broken relative paths)
- [ ] Broken links to `./trading-api.md` and `./universal-router.md` removed from swap-integration.md
- [ ] `viem-integration.md` internal refs updated for `references/` subdirectory
- [ ] Skill frontmatter includes `name:` field
- [ ] Eval suite scaffolds exist for both skills
- [ ] Root `CLAUDE.md` repository structure updated
- [ ] `npm install` succeeds with workspace changes
- [ ] Pre-commit hooks pass (format, lint, eval-coverage)

## Open Questions for Q

1. **Plugin naming**: Is `uniswap-viem` the right name? Alternatives: `evm-viem`, `uniswap-evm`, `viem-wagmi`
2. **Swap plugin naming**: Plan recommends `uniswap-trading` (per domain expert review). Alternatives: `uniswap-swaps`, or keep `uniswap-builder` if brand recognition matters
3. **Eval priority**: Should eval suites be fully developed in this PR, or scaffolded and completed in a follow-up?

## Follow-Up Tasks (Not in Scope for This PR)

Identified during domain expert review:

1. **Verify/update Universal Router contract addresses** -- Source references V1 address; V2 and V4-compatible routers now exist
2. **Replace ethers usage in backend example** -- swap-integration backend example uses ethers instead of viem; should be consistent
3. **Add UniswapX / Dutch auction details** -- Currently only a table entry; could use a brief section
4. **Expand supported chains list** -- Missing Zora, World Chain, and other recently added chains
5. **Develop full eval suites** -- Populate eval test cases and rubrics for both skills

## Risk Assessment

| Risk                                        | Likelihood | Impact | Mitigation                                                                  |
| ------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- |
| Broken internal refs in viem-integration.md | High       | Medium | Explicitly update all `./[file].md` to `./references/[file].md`             |
| Broken cross-references between plugins     | Medium     | Low    | Search for all relative paths, update to textual references                 |
| Dead links in swap-integration.md source    | Known      | Low    | Remove links to non-existent `./trading-api.md` and `./universal-router.md` |
| Missing files during copy                   | Low        | Medium | Verify file count matches source after migration                            |
| Marketplace validation failure              | Low        | Low    | Run validate-plugin.cjs before committing                                   |
| Eval coverage CI failure                    | High       | Medium | Create eval scaffolds (even if minimal) to pass coverage checks             |
| Markdownlint failures on source content     | Medium     | Low    | Run pre-flight markdownlint check on source files                           |
| Symlink issues on Windows                   | Low        | Low    | Test SKILL.md symlinks; fallback to copies if needed                        |

## Estimated Scope

- **Files to create**: ~14 new config/doc files
- **Files to copy**: ~12 markdown files (skills, agents, references)
- **Files to modify**: 4 (marketplace.json, cross-references in 3 skill/agent files)
- **Complexity**: Low -- pure file operations, no code changes
