---
title: Permissioned Pools Issuer
order: 16
---

# Permissioned Pools Issuer

Reference guide for engineering teams setting up a Uniswap v4 Permissioned Pool for a transfer-restricted ERC-20. Covers the contract architecture, the ordered setup journey, the ordering the contracts enforce, and the trust model.

## Invocation

```text
/permissioned-pools-issuer
```

Or describe your requirements naturally:

```text
How do we list our transfer-restricted token on Uniswap v4?
```

## What It Does

This skill helps you:

- **Understand the contract stack**: the allowlist checker you write, the permissions adapter and its factory, the permissioned position manager, and the hook the pool runs
- **Work with two token addresses**: your underlying permissioned ERC-20 and the adapter token that appears in the pool key, and which one each participant sees
- **Follow the setup order**: which steps the contracts enforce, which are convention, and what each call requires of its caller
- **Decode reverts**: which selector comes from which call site, and what condition raised it
- **Explain the trust model**: what an adapter owner can do, what a liquidity provider is accepting, and where enforcement lives
- **Build against the contracts**: the pinned commits, the Foundry remapping, and the identifier casing traps
- **Separate on-chain work from coordinated work**: what is permissionless today and what is requested through Uniswap Labs

## Quick Decision Guide

| You are asking...                                      | The skill routes you to       |
| ------------------------------------------------------ | ----------------------------- |
| What are these contracts and how do they fit together? | Contract architecture         |
| What do I call, in what order, and as which account?   | Issuer journey                |
| Why did this call revert?                              | Enforced ordering and reverts |
| What can the adapter owner do to a position?           | Trust model                   |
| How do I install and import the contracts?             | Packaging and sources         |
| Does Uniswap have to approve anything?                 | Coordination boundary         |

## Reference Topics

The skill includes detailed reference documentation covering:

- **Contract Architecture** -- the stack, the two-address model, virtual-token naming, the exact-casing inventory, permission flags
- **Issuer Journey** -- the setup steps in the published order, each with its caller, event, and post-checks
- **Enforced Ordering and Reverts** -- the enforced edges, the revert catalogue, and worked out-of-order scenarios
- **Trust Model** -- position non-transferability, adapter-admin unwind and the proceeds cascade, the wrapper allowlist boundary
- **Packaging and Sources** -- pinned commits, Foundry install and remapping, import paths, address resolution
- **Coordination Boundary** -- permissionless on-chain work versus work requested through Uniswap Labs

## Scope and Disclaimer

- This skill is **educational reference material** about contract mechanics. It does not constitute legal, financial, investment, or tax advice, and it is **not** a compliance review of your token, your allowlist, your KYC or AML program, or your configuration.
- AI-generated code and command sequences may contain errors. Review everything, test on a testnet first, and have your own auditors review contracts you deploy.
- Contract behaviour is described against pinned commits. Verify against the source at the commit you build against before relying on any statement here.
- The skill contains no deployment addresses on purpose. Resolve every address from the published deployment table, then verify it on a block explorer for your chain before sending a transaction to it.
- The skill does not walk you through a deployment and does not emit broadcastable commands.

## Related Resources

- [Uniswap Permissioned Pools](/plugins/uniswap-permissioned-pools) - Parent plugin
- [Permissioned Pools documentation](https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/overview) - Published protocol guide
- [Deploy a permissioned pool](https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/deploy-a-permissioned-pool) - Step-by-step protocol documentation
