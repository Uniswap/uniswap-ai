---
name: v4-hook-generator
description: 'Generate Uniswap v4 hook contracts via OpenZeppelin MCP. Use when building custom swap logic, async swaps, hook-owned liquidity, custom curves, dynamic fees, MEV protection, limit orders, or oracle hooks.'
allowed-tools: Read, Glob, Grep, WebFetch, Bash
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# v4 Hook Generator

Generate Uniswap v4 hook contracts via the OpenZeppelin Contracts Wizard MCP tool. This skill
guides you through selecting the right hook type, configuring permissions and utilities, assembling
the canonical MCP JSON, and invoking the MCP tool to produce ready-to-compile Solidity code.

> **Security companion**: Generated hook code touches fund-handling contracts. Always apply the
> `v4-security-foundations` skill immediately after generation to audit permissions, delta
> accounting, and access control before deploying to any network.

## When to Use This Skill

Use this skill when you need to:

- Scaffold a new Uniswap v4 hook contract from scratch
- Select the right base hook type for a specific use case (fees, MEV protection, oracles, etc.)
- Configure hook permissions, utility libraries, shares, and access control
- Produce the canonical MCP tool call JSON to invoke the OpenZeppelin Contracts Wizard
- Understand trade-offs between hook configuration options before committing to an implementation

**Prerequisite / companion skill**: `v4-security-foundations` — run it before writing custom logic
and again before deployment. Hook misconfiguration can drain user funds.

## Hook Type Decision Table

Choose the base hook type that matches your primary goal. If your hook has multiple goals, choose
the type that covers the most critical concern and layer additional logic on top.

| Goal                 | Use Hook                   |
| -------------------- | -------------------------- |
| Custom swap logic    | `BaseHook`                 |
| Async/delayed swaps  | `BaseAsyncSwap`            |
| Hook-owned liquidity | `BaseCustomAccounting`     |
| Custom curve         | `BaseCustomCurve`          |
| Dynamic LP fees      | `BaseDynamicFee`           |
| Dynamic swap fees    | `BaseOverrideFee`          |
| Post-swap fees       | `BaseDynamicAfterFee`      |
| Fixed hook fees      | `BaseHookFee`              |
| MEV protection       | `AntiSandwichHook`         |
| JIT protection       | `LiquidityPenaltyHook`     |
| Limit orders         | `LimitOrderHook`           |
| Yield on idle        | `ReHypothecationHook`      |
| Oracle               | `BaseOracleHook`           |
| V3-compatible oracle | `OracleHookWithV3Adapters` |

**Selection tips**:

- `BaseHook` is the general-purpose starting point — choose a specialized type only when the
  built-in logic provides concrete value.
- `BaseCustomCurve` replaces the entire AMM math; only use it if you are implementing a novel
  pricing algorithm.
- `AntiSandwichHook` and `LiquidityPenaltyHook` both address MEV but target different actors
  (traders vs. JIT LPs). Clarify which attack vector you are mitigating.
- `OracleHookWithV3Adapters` is appropriate when downstream integrations expect a Uniswap v3
  `IUniswapV3Pool`-compatible oracle interface.

## Minimal Decision Checklist

Before calling the MCP tool, confirm all six decisions:

1. **Hook type** — chosen from the decision table above
2. **Permissions to enable** — only the callbacks your logic actually uses (`beforeSwap`, `afterSwap`, etc.)
3. **Utility libraries** — `currencySettler`, `safeCast`, `transientStorage` as needed
4. **Shares** — `false`, `ERC20`, `ERC6909`, or `ERC1155`
5. **Access control** — `ownable`, `roles`, or `managed`
6. **Hook inputs** — `blockNumberOffset`, `maxAbsTickDelta` (only for hook types that use them)

## Permission Configuration

All 14 permission flags with guidance on when to enable each. Start with all flags `false` and
enable only what your hook logic requires. Every enabled permission increases the hook's attack
surface and requires a specific bit to be set in the hook's deployed address (see address encoding
note below).

| Permission Flag                   | Enable When                                                                                                     | Risk     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| `beforeInitialize`                | You need to validate or restrict pool creation params                                                           | LOW      |
| `afterInitialize`                 | You need to set up state after a pool is created                                                                | LOW      |
| `beforeAddLiquidity`              | You need to gate or transform LP deposits                                                                       | MEDIUM   |
| `afterAddLiquidity`               | You track LP positions or distribute rewards                                                                    | LOW      |
| `beforeRemoveLiquidity`           | You need lock-up periods or fee-on-exit logic                                                                   | HIGH     |
| `afterRemoveLiquidity`            | You track position removals for accounting                                                                      | LOW      |
| `beforeSwap`                      | You modify swap behavior, apply dynamic fees, or block                                                          | HIGH     |
| `afterSwap`                       | You observe final swap state for oracles or accounting                                                          | MEDIUM   |
| `beforeDonate`                    | You restrict who may donate to the pool                                                                         | LOW      |
| `afterDonate`                     | You track donation events                                                                                       | LOW      |
| `beforeSwapReturnDelta`           | You implement custom AMM curves or JIT liquidity (CRITICAL: NoOp attack vector — see `v4-security-foundations`) | CRITICAL |
| `afterSwapReturnDelta`            | You extract a hook fee from swap output                                                                         | HIGH     |
| `afterAddLiquidityReturnDelta`    | You adjust LP token amounts on deposit                                                                          | HIGH     |
| `afterRemoveLiquidityReturnDelta` | You adjust withdrawal amounts                                                                                   | HIGH     |

**Address encoding note**: Permissions are encoded as bits in the hook contract's deployed address.
The address must have the correct bits set at deployment time or the PoolManager will revert. Use
`HookMiner` (from `v4-periphery`) to mine a salt that produces an address with the correct bit
pattern. Never change permissions after deployment — the address is immutable.

## Utility Library Selection

Three optional utility libraries can be included in the generated hook. Include only what your
hook logic uses.

| Library            | Include When                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currencySettler`  | Your hook moves tokens between itself and the PoolManager (e.g., custom accounting, fee collection)                                                         |
| `safeCast`         | Your hook performs arithmetic that could overflow when casting between integer types                                                                        |
| `transientStorage` | Your hook needs to pass data between callbacks within a single transaction without persisting to storage (requires EVM Cancun or later, Solidity >= 0.8.24) |

**Guidance**:

- `currencySettler` is almost always needed when `beforeSwapReturnDelta`,
  `afterSwapReturnDelta`, `afterAddLiquidityReturnDelta`, or `afterRemoveLiquidityReturnDelta`
  are enabled — it provides `settle` and `take` helpers that implement the correct
  `sync → transfer → settle` sequence.
- `transientStorage` is a gas-efficient alternative to storage slots for intra-transaction state.
  Use it to pass a flag or value from `beforeSwap` to `afterSwap` without paying 20k gas for a
  cold SSTORE.
- `safeCast` is advisable whenever you compute amounts derived from `int256`/`uint256` conversions,
  especially for fee calculations.

## Shares Configuration

The `shares` option controls whether the generated hook issues a token representing user shares
(e.g., LP positions in hook-owned liquidity pools).

| Option    | Description                                                                                  | Use When                                                 |
| --------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `false`   | No share token — hook does not track ownership of deposited assets                           | Simple hooks that do not hold user funds                 |
| `ERC20`   | Fungible share token — one token represents proportional ownership of all hook-held assets   | Hook-managed liquidity pools with interchangeable shares |
| `ERC6909` | Multi-token (minimal) — one contract manages many token IDs with lower overhead than ERC1155 | Hook manages multiple distinct asset classes efficiently |
| `ERC1155` | Multi-token (standard) — full ERC1155 with metadata URI support                              | Hook needs broad wallet and marketplace compatibility    |

**Trade-offs**:

- `false`: smallest bytecode, no share accounting overhead; appropriate for fee hooks and oracles.
- `ERC20`: simplest fungible share; good DeFi composability (e.g., used as collateral).
- `ERC6909`: gas-efficient multi-token with a minimal interface; preferred for new protocol designs.
- `ERC1155`: widest ecosystem support (wallets, explorers, NFT marketplaces); higher gas cost per
  transfer than ERC6909.

## Access Control Options

The `access` option shapes the constructor and administrative interface of the generated hook.

| Option    | Constructor Shape                                 | Use When                                                                     |
| --------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ownable` | `constructor(IPoolManager, address initialOwner)` | Single owner controls all admin functions                                    |
| `roles`   | `constructor(IPoolManager, address admin)`        | Multiple roles with granular permissions (OpenZeppelin AccessControl)        |
| `managed` | `constructor(IPoolManager, address authority)`    | External authority contract governs permissions (OpenZeppelin AccessManaged) |

**Guidance**:

- `ownable` is the simplest — one address can perform all privileged operations. Suitable for
  early-stage hooks and personal tools.
- `roles` adds `ADMIN_ROLE`, `PAUSER_ROLE`, etc. via OpenZeppelin `AccessControl`. Use when
  different team members need different privileges (e.g., a keeper bot that can update fees but
  cannot upgrade the contract).
- `managed` delegates all permission checks to a separate `AccessManager` contract. Use when
  you need a unified governance layer across multiple contracts or want timelocked admin actions.

> **Note**: Changing the `access` option changes the constructor signature. Update deployment
> scripts and initialization logic accordingly. When using `ownable`, ensure the `initialOwner`
> is not the zero address — OpenZeppelin's `Ownable` reverts on zero address since v5.

## Hook Inputs Reference

Some hook types accept numeric configuration inputs that tune behavior. These are passed as the
`inputs` object in the MCP tool call.

| Input               | Type      | Used By                                    | Description                                                            |
| ------------------- | --------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `blockNumberOffset` | `uint256` | `AntiSandwichHook`, `LiquidityPenaltyHook` | Number of blocks before sandwich/JIT detection window opens            |
| `maxAbsTickDelta`   | `int24`   | `AntiSandwichHook`                         | Maximum tick movement allowed per block before MEV protection triggers |

For hook types that do not use these inputs, omit the `inputs` field or pass an empty object `{}`.
Passing unsupported inputs to the MCP tool will not cause an error but the values will be ignored.

## MCP Tool Call (Canonical)

The OpenZeppelin Contracts Wizard exposes a `generate_hook` MCP tool. The following is the
canonical JSON schema — populate each field according to your decisions from the sections above,
then pass this object as the tool's argument.

```json
{
  "hook": "BaseHook",
  "name": "MyHook",
  "pausable": false,
  "currencySettler": true,
  "safeCast": true,
  "transientStorage": false,
  "shares": { "options": false },
  "permissions": {
    "beforeInitialize": false,
    "afterInitialize": false,
    "beforeAddLiquidity": false,
    "beforeRemoveLiquidity": false,
    "afterAddLiquidity": false,
    "afterRemoveLiquidity": false,
    "beforeSwap": true,
    "afterSwap": false,
    "beforeDonate": false,
    "afterDonate": false,
    "beforeSwapReturnDelta": false,
    "afterSwapReturnDelta": false,
    "afterAddLiquidityReturnDelta": false,
    "afterRemoveLiquidityReturnDelta": false
  },
  "inputs": {
    "blockNumberOffset": 1,
    "maxAbsTickDelta": 100
  },
  "access": "ownable",
  "info": { "license": "MIT" }
}
```

**Field notes**:

- `hook`: string — one of the 14 hook types from the decision table
- `name`: string — the Solidity contract name (PascalCase, no spaces)
- `pausable`: boolean — wraps the hook in OpenZeppelin `Pausable`; adds `pause()`/`unpause()` admin functions
- `shares.options`: `false` | `"ERC20"` | `"ERC6909"` | `"ERC1155"`
- `access`: `"ownable"` | `"roles"` | `"managed"`
- `info.license`: SPDX license identifier — use `"MIT"` for open-source hooks
- `inputs`: omit or pass `{}` for hook types that do not use `blockNumberOffset`/`maxAbsTickDelta`

## Workflow: Gather → Configure → Generate → Secure

Follow these steps in order every time you use this skill.

### Step 1: Gather Requirements

Ask the user (or infer from context):

1. What is the hook's primary goal? (Map to the decision table.)
2. Which lifecycle events does the hook need to intercept? (Map to permissions.)
3. Does the hook hold or move user funds? (Determines `currencySettler` and `shares`.)
4. Who administers the hook? (Single owner, role-based team, or external governance?)
5. Does the hook need to pass state between callbacks within a single transaction?
6. Is this for a chain with EVM Cancun support? (Required for `transientStorage`.)

### Step 2: Select Hook Type

Using the decision table, identify the single best hook type. If the user's goal maps to multiple
types, explain the trade-offs and ask them to confirm. Document the chosen type and the reasoning.

### Step 3: Configure All Six Decisions

Work through the minimal decision checklist:

1. Set `hook` to the chosen type.
2. Set each permission flag — default `false`, enable only what the logic requires.
3. Set `currencySettler`, `safeCast`, `transientStorage` based on utility library guidance.
4. Set `shares.options` based on shares guidance.
5. Set `access` based on access control guidance.
6. Set `inputs` only if the hook type uses `blockNumberOffset` or `maxAbsTickDelta`.

### Step 4: Assemble and Call the MCP Tool

Construct the JSON object from Step 3 and call the OpenZeppelin Contracts Wizard MCP tool with it.
The tool returns Solidity source code — it does **not** write files automatically.

After receiving the generated code:

1. Display the code to the user.
2. Explain the key generated sections (constructor, `getHookPermissions`, enabled callbacks).
3. Note any manual steps required (HookMiner for address mining, deployment script updates for
   constructor args if `access` is `roles` or `managed`).

### Step 5: Apply Security Foundations

**Always remind the user** — and invoke `v4-security-foundations` — before the code is deployed:

- Verify all enabled callbacks check `msg.sender == address(poolManager)`.
- Review any enabled `*ReturnDelta` permissions for NoOp attack exposure.
- Confirm delta accounting sums to zero for every execution path.
- Run the full pre-deployment audit checklist from `v4-security-foundations`.

## Important Notes

- **Access control changes constructor shape**: Choosing `ownable` adds an `initialOwner` parameter;
  `roles` adds an `admin` parameter; `managed` adds an `authority` parameter. Update deployment
  scripts and factory contracts accordingly.
- **Permissions encode in the hook address**: Each enabled permission flag corresponds to a specific
  bit in the lower bytes of the hook's deployed address. The PoolManager validates these bits on
  every callback. Use `HookMiner` from `v4-periphery` to mine a deployment salt that produces a
  matching address.
- **MCP returns code only — it does not write files**: The generated Solidity is returned as a
  string. You must write it to disk yourself (e.g., `packages/contracts/src/hooks/MyHook.sol`).

## Related Skills

- `v4-security-foundations` — **Run this after generation.** Security audit for Uniswap v4 hooks:
  permission risk matrix, NoOp attack patterns, delta accounting, access control verification,
  and the full pre-deployment audit checklist. Generated hook code should never be deployed without
  completing this review.
- `viem-integration` — Deploy generated hook contracts and interact with them using viem/wagmi
- `v4-sdk-integration` — Interact with deployed hooks via the Uniswap v4 SDK
