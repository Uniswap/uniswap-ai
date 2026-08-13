---
title: Permissioned Pools Configurator
order: 17
---

# Permissioned Pools Configurator

Interactive bulk-form configurator for a Uniswap v4 Permissioned Pool. Collects every parameter the setup journey needs, validates each one, and displays a single JSON configuration object that the `permissioned-pools-deployer` skill consumes to run the on-chain sequence.

## Invocation

```text
/permissioned-pools-configurator
```

Or describe your requirements naturally:

```text
Configure a permissioned pool
Help me set the adapter parameters for a permissioned pool
```

## What It Does

This skill helps you:

- **Collect every setup parameter**: chain, underlying token, allowlist checker, adapter owner, verification deposit, the four wrapper registrations, hook, pool pricing, and seeding intent
- **Validate as it goes**: each of the four question batches is checked against the config schema before moving on, with a running summary of what has been collected and what remains
- **Never invent an address**: any address you do not supply is stored as the literal string `"RESOLVE"`, never guessed or recalled from memory
- **Emit a portable JSON config**: keyed by chain ID, ready for the deployer skill to consume, or to save to a file you choose
- **Stay a configuration tool, not a deployment step**: it does not call any contract, does not broadcast anything, and holds no signing keys

## Quick Decision Guide

| You are asking...                                             | The skill routes you to     |
| ------------------------------------------------------------- | --------------------------- |
| What value goes in each field, and what breaks if it's wrong? | Parameter reference         |
| What is the exact JSON shape and validation rule?             | Config schema               |
| What do the contracts actually do with these values?          | `permissioned-pools-issuer` |

## Reference Topics

The skill includes detailed reference documentation covering:

- **Config Schema** -- the canonical JSON shape, per-field types and validation, the address regex, and the `RESOLVE`/`native` sentinels
- **Parameter Reference** -- what each field means, how to choose it, and what breaks if it is wrong

## Configuration Flow

Parameters are collected in four batches of at most four questions each, validated against the config schema after every batch:

1. **Network, Token & Ownership** -- chain ID, the underlying permissioned token, the allowlist checker, the adapter owner
2. **Verification & Core Wrappers** -- the verification deposit amount, `PermissionedPositionManager`, Universal Router `#v2.2`, `PermissionedHooks`
3. **Remaining Wrappers & Pool Currency** -- `V4Quoter`, `MixedRouteQuoterV2`, the paired currency, the fee tier
4. **Pricing & Seeding** -- tick spacing, starting price ratio, seeding intent and wallet

## Scope and Disclaimer

- This skill is a **configuration tool, not deployment guidance and not a compliance review**. It collects and validates inputs and produces a JSON document only.
- It covers contract mechanics only — what each parameter means and what breaks if it is wrong. It does not constitute legal, financial, investment, or tax advice, and it is **not** a compliance review of your token, your allowlist, your KYC or AML program, or your configuration.
- It never invents a contract address. Addresses you do not yet have are stored as the literal string `"RESOLVE"`, never guessed or recalled from memory.
- Review the emitted configuration yourself, and re-resolve every address it marks for resolution, before handing it to a deployment flow.

## Related Resources

- [Permissioned Pools Issuer](/skills/permissioned-pools-issuer) - Contract mechanics behind these parameters
- [Uniswap Permissioned Pools](/plugins/uniswap-permissioned-pools) - Parent plugin
- [Deploy a permissioned pool](https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/deploy-a-permissioned-pool) - Step-by-step protocol documentation
