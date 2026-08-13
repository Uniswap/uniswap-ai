---
title: Permissioned Pools Deployer
order: 18
---

# Permissioned Pools Deployer

Guided, step-by-step execution of the on-chain setup sequence for a Uniswap v4 Permissioned
Pool, starting from the JSON configuration `permissioned-pools-configurator` produces. Walks the
same journey as `permissioned-pools-issuer`'s contract mechanics, but as ordered command
sequences — allowlist checker, `createPermissionsAdapter`, allowlisting and funding the adapter,
verification, wrapper and hook registration, pool initialization, swap enablement, liquidity
seeding, and the routing-allowlist request.

## Invocation

```text
/permissioned-pools-deployer
```

Or describe your requirements naturally:

```text
Deploy a permissioned pool
Walk me through the permissioned pool deployment
Run the permissioned pool setup
```

## What It Does

This skill helps you:

- **Execute the published setup journey, in order**: seven steps from confirming the allowlist
  checker through the routing-allowlist request, each stating its precondition and, where the
  contracts enforce one, the exact revert selector you get if you are early
- **Validate every value before it reaches a command**: addresses, chain ID, numeric fields, and
  a shell-metacharacter check on every string field, all before interpolation — never after
- **Gate every action-oriented step**: nothing that produces a broadcastable command, or an
  address-resolution step leading directly into one, is shown before an explicit, affirmative
  acknowledgment
- **Steer signing away from raw keys**: only an encrypted keystore or a hardware wallet — the raw
  signing-key flag is enforced against, not just discouraged, by this repository's own
  `Bash` PreToolUse hook
- **Resolve addresses from real sources only**: the deploy guide's table, then
  `Uniswap/contracts` `deployments/json/<chainId>.json`, then a block explorer — never a guess,
  never a value recalled from memory, and never the config's `"RESOLVE"` sentinel carried into a
  command

## Quick Decision Guide

| You are asking...                                                  | The skill routes you to           |
| ------------------------------------------------------------------ | --------------------------------- |
| What do I check and validate before running anything?              | Preflight and validation          |
| What is the exact command sequence for Steps 2 through 7?          | Step walkthrough                  |
| Why does the contract behave this way, or what does a revert mean? | `permissioned-pools-issuer`       |
| What value goes in each config field?                              | `permissioned-pools-configurator` |

## Reference Topics

The skill includes detailed reference documentation covering:

- **Preflight and Validation** -- loading and re-validating the config, resolving the
  `"RESOLVE"` sentinel and the `"native"` pool-currency sentinel, the full input-validation
  table, the allowlist-checker branch (`existing` vs `to-be-deployed`), and key handling
- **Step Walkthrough** -- Steps 2 through 7 as ordered command sequences, each with its
  precondition, its revert if that precondition is missing, and the read-only checks to run
  afterward

## The Deployment Journey

| Step | Summary                                                                |
| ---- | ---------------------------------------------------------------------- |
| 1    | Confirm or deploy the allowlist checker                                |
| 2    | `createPermissionsAdapter`                                             |
| 3    | Allowlist the adapter on your token, approve, `depositForVerification` |
| 4    | `verifyPermissionsAdapter`                                             |
| 5    | The four `updateAllowedWrapper` registrations, then `setAllowedHook`   |
| 6    | Pool `initialize`, `updateSwappingEnabled`, liquidity seeding          |
| 7    | The routing-allowlist request                                          |

Only five of these ordering edges are enforced by the contracts; the rest is the published
guide's convention. Every step in the skill names which case it is.

## Scope and Disclaimer

- This is **educational deployment guidance, not a compliance review, and not a substitute for
  your own review of every command before you run it**.
- It covers contract mechanics only. It does not constitute legal, financial, investment, or
  tax advice, and it is **not** a compliance review of your token, your allowlist, your KYC
  or AML program, or your configuration.
- It ships no deployment addresses. Every address comes from the loaded config, a value you
  supply during the walkthrough, or a read against a contract whose address came from one of
  those two sources.
- Run the entire sequence on a testnet before touching mainnet. Have your own auditors review
  any contract you deploy, most importantly your allowlist checker.
- Nothing here is shown before an explicit, affirmative acknowledgment of the risks above.

## Related Resources

- [Permissioned Pools Issuer](/skills/permissioned-pools-issuer) - Contract mechanics behind
  every step this skill executes
- [Permissioned Pools Configurator](/skills/permissioned-pools-configurator) - Produces the JSON
  config this skill consumes
- [Uniswap Permissioned Pools](/plugins/uniswap-permissioned-pools) - Parent plugin
- [Deploy a permissioned pool](https://developers.uniswap.org/docs/protocols/v4/permissioned-pools/deploy-a-permissioned-pool) - Step-by-step protocol documentation
