# CLAUDE.md - uniswap-permissioned-pools Plugin

## Overview

This plugin provides reference material for engineering teams standing up a Uniswap v4 Permissioned Pool for a transfer-restricted ERC-20 (for example a tokenized real-world asset). It explains the contract stack, the order the contracts require, what each revert means, and what issuers and liquidity providers are trusting.

It combines reference material with an interactive configurator and a guided deployer: the issuer skill describes contract mechanics only, the configurator skill collects and validates setup parameters into a JSON config, and the deployer skill walks that config through the on-chain setup sequence as ordered command sequences, gated behind an explicit acknowledgment. It covers no securities-law, KYC-program, or compliance questions.

## Plugin Components

### Skills (./skills/)

- **permissioned-pools-issuer**: Contract architecture, the ordered setup journey, code-enforced ordering and the revert catalogue, the trust model, contract packaging and citation rules, and the boundary between permissionless on-chain work and work coordinated with Uniswap Labs.
- **permissioned-pools-configurator**: Interactive, batched `AskUserQuestion` collection and validation of every permissioned-pool setup parameter — chain, underlying token, allowlist checker, adapter owner, verification deposit, the four wrapper registrations, hook, and pool pricing — displayed as a JSON config for the deployer skill to consume. Emits no addresses it was not given or told to mark for resolution, and never auto-writes a file.
- **permissioned-pools-deployer**: Guided execution of the on-chain setup sequence from the configurator's JSON config, as ordered command sequences with preconditions and revert selectors. Validates every value before interpolation, gates every action-oriented step behind an explicit acknowledgment, and steers signing to an encrypted keystore or a hardware wallet — the raw signing-key flag is enforced against, not just discouraged, by this repository's own `Bash` PreToolUse hook.

### Agents

None. This plugin ships no agents and no MCP servers.

## File Structure

```text
uniswap-permissioned-pools/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── permissioned-pools-issuer/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── contract-architecture.md
│   │       ├── issuer-journey.md
│   │       ├── enforced-ordering-and-reverts.md
│   │       ├── trust-model.md
│   │       ├── packaging-and-sources.md
│   │       └── coordination-boundary.md
│   ├── permissioned-pools-configurator/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── config-schema.md
│   │       └── parameter-reference.md
│   └── permissioned-pools-deployer/
│       ├── SKILL.md
│       └── references/
│           ├── preflight-and-validation.md
│           └── step-walkthrough.md
├── project.json
├── package.json
├── CLAUDE.md
├── AGENTS.md -> CLAUDE.md
└── README.md
```

## Permissioned Pools Issuer Skill

### Topics Covered

| Reference File                   | Topics                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| contract-architecture.md         | The contract stack and the repo each contract lives in, the underlying-token / adapter-token pair, virtual-token naming, exact-casing inventory, permission flags, the allowlist-checker interface                                |
| issuer-journey.md                | The setup steps in the published order: allowlist checker, adapter creation, allowlisting and funding the adapter, verification, wrapper and hook approval, pool creation and swap enablement, seeding liquidity, routing request |
| enforced-ordering-and-reverts.md | The edges the contracts enforce versus conventional ordering, the revert catalogue with declaring and raising sites, and worked out-of-order scenarios                                                                            |
| trust-model.md                   | Position non-transferability, adapter-admin unwind and the proceeds cascade, the `allowedWrappers` boundary and `msgSender()` dependency, and a wrapper vetting checklist                                                         |
| packaging-and-sources.md         | Pinned commits and why a commit rather than a release, Foundry install and remapping, import paths, and how deployment addresses are resolved rather than reprinted                                                               |
| coordination-boundary.md         | What an issuer can do permissionlessly on-chain, what is requested through Uniswap Labs, and promise-free language for the coordinated step                                                                                       |

## Pinned Contract Sources

Contract behaviour in this plugin is described against these commits. There are no git tags on `v4-periphery`, and the permissioned-pools sources are not part of any published npm release, so a commit is the only pin available.

| Repository                                   | Commit                                     | Provides                                                                                                 |
| -------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| <https://github.com/Uniswap/v4-periphery>    | `3245c3cb99c48fa1dc2459c3b60abc37d4294aba` | `src/hooks/permissionedPools/` - adapter, factory, position manager, base allowlist checker, router base |
| <https://github.com/Uniswap/v4-hooks-public> | `7da5210f2c81a700820a6b4f585264233d91f349` | `src/permissioned-pools/PermissionedHooks.sol` - the hook whose behaviour the pool depends on            |

Cite hook behaviour from `v4-hooks-public`; `v4-periphery` ships only a test double for the hook.

## Scope and Disclaimer

- This plugin is **educational reference material** about contract mechanics. These skills do not constitute legal, financial, investment, or tax advice, and they are **not** a compliance review of your token, your allowlist, your KYC or AML program, or your configuration.
- AI-generated code and command sequences may contain errors. Review everything, test on a testnet first, and have your own auditors review contracts you deploy.
- Behaviour is described against the commits above. Verify against the source at the commit you build against before relying on any statement here.
- This plugin contains no deployment addresses on purpose. Resolve every address from the published deployment table, then verify it on a block explorer for your chain before sending a transaction to it.

See <https://github.com/Uniswap/uniswap-ai/blob/main/DISCLAIMER.md> for the repository-wide usage guidelines.

## Related Plugins

- **uniswap-hooks**: Uniswap v4 hook development, security-first
- **uniswap-viem**: EVM blockchain integration using viem and wagmi

## Key References

- Permissioned Pools overview: <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/overview>
- Architecture: <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/architecture>
- Deploy a permissioned pool: <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/deploy-a-permissioned-pool>
- Provide liquidity: <https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/provide-liquidity>
- Machine-readable deployments: <https://github.com/Uniswap/contracts>
- Mixed-route quoter source: <https://github.com/Uniswap/mixed-quoter>
