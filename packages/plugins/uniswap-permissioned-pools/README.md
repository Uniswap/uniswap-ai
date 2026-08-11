# Uniswap Permissioned Pools Plugin

Reference material for engineering teams standing up a Uniswap v4 Permissioned Pool for a transfer-restricted ERC-20.

## Installation

```bash
claude plugin add @uniswap/uniswap-permissioned-pools
```

## Skills

| Skill                       | Description                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `permissioned-pools-issuer` | Contract architecture, the ordered setup journey, code-enforced ordering and reverts, and the trust model for an issuer team |

## Use Cases

This plugin helps an issuer's engineering team:

- **Understand the contract stack** - `PermissionsAdapter`, `PermissionsAdapterFactory`, `PermissionedPositionManager`, `PermissionedHooks`, and the allowlist checker an issuer writes
- **Plan the setup sequence** - which steps the contracts enforce, which are convention, and what each call requires of the caller
- **Decode reverts while bringing a pool up** - which selector comes from which call site, and what condition raised it
- **Explain the trust model** - what an issuer controls, what an LP is accepting, and where enforcement actually lives
- **Get the contracts building** - the pinned commits, the Foundry remapping, and the exact-casing identifier traps
- **Separate on-chain work from coordinated work** - what is permissionless today and what is requested through Uniswap Labs

## Quick Start

### Using the skill

The `permissioned-pools-issuer` skill activates when you describe permissioned-pool work:

```text
"How do I set up a permissioned pool for our tokenized asset?"
"Why does setAllowedHook revert with NotPermissionsAdapterAdmin?"
"Which contracts do we register with updateAllowedWrapper?"
"What can the adapter owner do to an LP position?"
```

### Slash command

```text
/permissioned-pools-issuer
```

## Reference Topics

| Topic                         | Coverage                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Contract architecture         | The contract stack, which repo each contract lives in, the two-address model, exact casing    |
| Issuer journey                | The setup steps in the published order, with the caller, the emitted event, and the checks    |
| Enforced ordering and reverts | The edges the contracts enforce, the revert catalogue, and worked out-of-order scenarios      |
| Trust model                   | Position transferability, adapter-admin unwind powers, and the wrapper allowlist boundary     |
| Packaging and sources         | Pinned commits, Foundry install and remapping, import paths, and where addresses are resolved |
| Coordination boundary         | What is permissionless on-chain versus requested through Uniswap Labs                         |

## Scope and Disclaimer

- This plugin is **educational reference material** about contract mechanics. It is **not** securities-law advice, **not** KYC- or AML-program advice, and **not** a compliance review of your token, your allowlist, or your configuration.
- AI-generated code and command sequences may contain errors. Review everything, test on a testnet first, and have your own auditors review contracts you deploy.
- Contract behaviour is described against pinned commits. Verify against the source at the commit you build against before relying on any statement here.
- This plugin contains no deployment addresses on purpose. Resolve every address from the published deployment table, then verify it on a block explorer for your chain before sending a transaction to it.

See <https://github.com/Uniswap/uniswap-ai/blob/main/DISCLAIMER.md> for the repository-wide usage guidelines.

## Related Plugins

- **uniswap-hooks** - Uniswap v4 hook development
- **uniswap-viem** - EVM blockchain integration with viem and wagmi

## License

MIT
