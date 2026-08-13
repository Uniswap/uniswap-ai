---
title: Uniswap Permissioned Pools
order: 9
---

# Uniswap Permissioned Pools

Reference material for engineering teams standing up a Uniswap v4 Permissioned Pool for a transfer-restricted ERC-20.

## Installation

```bash
/plugin install uniswap-permissioned-pools
```

## Skills

| Skill                                                            | Description                                                                                               | Invocation                   |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------- |
| [Permissioned Pools Issuer](../skills/permissioned-pools-issuer) | Contract architecture, the ordered setup journey, code-enforced ordering and reverts, and the trust model | `/permissioned-pools-issuer` |

## Topics Covered

| Reference                     | Topics                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| contract-architecture         | The contract stack, the underlying-token and adapter-token pair, exact-casing inventory, permission flags  |
| issuer-journey                | Setup steps in the published order, with the caller, the emitted event, and what to check afterwards       |
| enforced-ordering-and-reverts | Enforced edges versus conventional ordering, the revert catalogue, and worked out-of-order scenarios       |
| trust-model                   | Position non-transferability, adapter-admin unwind powers, the wrapper allowlist boundary                  |
| packaging-and-sources         | Pinned commits, Foundry install and remapping, import paths, how addresses are resolved rather than copied |
| coordination-boundary         | What is permissionless on-chain versus requested through Uniswap Labs                                      |

## What This Plugin Covers

- The contract stack: the allowlist checker an issuer writes, the permissions adapter and its factory, the permissioned position manager, and the hook the pool runs.
- The two-address model: the underlying permissioned ERC-20 an issuer already has, and the adapter token that appears in the pool key.
- Which ordering the contracts enforce, which ordering is convention, and the revert each enforced edge produces.
- What an adapter owner can do, what a liquidity provider is accepting, and where enforcement actually lives.
- How to build against the contracts: the pinned commits, the Foundry remapping, and the identifier casing traps.

## Scope and Disclaimer

- This plugin is **educational reference material** about contract mechanics. These skills do not constitute legal, financial, investment, or tax advice, and they are **not** a compliance review of your token, your allowlist, your KYC or AML program, or your configuration.
- AI-generated code and command sequences may contain errors. Review everything, test on a testnet first, and have your own auditors review contracts you deploy.
- Contract behaviour is described against pinned commits. Verify against the source at the commit you build against before relying on any statement here.
- The plugin contains no deployment addresses on purpose. Resolve every address from the published deployment table, then verify it on a block explorer for your chain before sending a transaction to it.

The repository-wide usage guidelines are in [DISCLAIMER.md](https://github.com/Uniswap/uniswap-ai/blob/main/DISCLAIMER.md).

## Key References

- [Permissioned Pools overview](https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/overview)
- [Architecture](https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/architecture)
- [Deploy a permissioned pool](https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/deploy-a-permissioned-pool)
- [Provide liquidity](https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/provide-liquidity)
- **Contract sources**: [v4-periphery](https://github.com/Uniswap/v4-periphery), [v4-hooks-public](https://github.com/Uniswap/v4-hooks-public)

## Related

- [Plugins Overview](/plugins/) - All available plugins
- [Uniswap Hooks](/plugins/uniswap-hooks) - v4 hook development
- [Uniswap Viem](/plugins/uniswap-viem) - EVM blockchain integration
- [Skills](/skills/) - All available skills
