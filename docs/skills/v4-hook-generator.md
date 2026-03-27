---
title: v4 Hook Generator
order: 4
---

# v4 Hook Generator

Generate Uniswap v4 hook contracts using the OpenZeppelin Contracts Wizard MCP. Select the right hook type, configure permissions and utilities, and produce the canonical MCP tool call JSON — all guided by a structured decision workflow.

## Invocation

```text
/v4-hook-generator
```

Or describe what you want to build:

```text
"Generate a v4 hook with dynamic fees based on volatility"
"Create a hook that implements custom accounting for my AMM curve"
```

## What It Does

This skill guides you through the full hook generation workflow:

1. **Select a hook type** from a 14-type decision table matched to your goal
2. **Configure permissions** — choose only the flags your hook needs, with guidance on address encoding implications
3. **Choose utility libraries** — `currencySettler`, `safeCast`, `transientStorage` with when-to-use notes
4. **Set shares and access control** — `false`, `ERC20`, `ERC6909`, `ERC1155` shares; `ownable`, `roles`, `managed` access
5. **Assemble the MCP tool call JSON** — produces the canonical schema ready to pass to the OpenZeppelin MCP tool
6. **Hand off to security review** — prompts you to run `v4-security-foundations` on the generated code

## Hook Type Decision Table

| Goal                            | Hook Type                  |
| ------------------------------- | -------------------------- |
| General-purpose hook            | `BaseHook`                 |
| Async/off-chain swap execution  | `BaseAsyncSwap`            |
| Custom accounting logic         | `BaseCustomAccounting`     |
| Custom AMM curve                | `BaseCustomCurve`          |
| Dynamic fee based on pool state | `BaseDynamicFee`           |
| Override fee per swap           | `BaseOverrideFee`          |
| Dynamic fee applied after swap  | `BaseDynamicAfterFee`      |
| Fee distribution to hook        | `BaseHookFee`              |
| MEV / sandwich protection       | `AntiSandwichHook`         |
| Liquidity penalty enforcement   | `LiquidityPenaltyHook`     |
| On-chain limit orders           | `LimitOrderHook`           |
| LP position re-hypothecation    | `ReHypothecationHook`      |
| Price oracle                    | `BaseOracleHook`           |
| Oracle with Uniswap v3 adapters | `OracleHookWithV3Adapters` |

## MCP Tool Call Schema

The skill assembles and outputs a JSON object conforming to the OpenZeppelin Contracts Wizard MCP tool schema:

```json
{
  "hook": "<HookTypeName>",
  "permissions": {
    "beforeInitialize": false,
    "afterInitialize": false,
    "beforeAddLiquidity": false,
    "afterAddLiquidity": false,
    "beforeRemoveLiquidity": false,
    "afterRemoveLiquidity": false,
    "beforeSwap": false,
    "afterSwap": false,
    "beforeDonate": false,
    "afterDonate": false,
    "beforeSwapReturnDelta": false,
    "afterSwapReturnDelta": false,
    "afterAddLiquidityReturnDelta": false,
    "afterRemoveLiquidityReturnDelta": false
  },
  "shares": {
    "type": "false"
  },
  "access": "ownable",
  "inputs": {},
  "info": {
    "license": "MIT"
  }
}
```

## Key Topics Covered

- **Hook type selection**: Match your goal to one of 14 OpenZeppelin base hook types using the decision table
- **Permission flags**: All 14 flags explained with risk guidance; note that permissions encode into the hook address and HookMiner may be needed
- **Utility libraries**: When to use `currencySettler` (token settlement), `safeCast` (integer casting), and `transientStorage` (intra-transaction state)
- **Shares configuration**: Trade-offs between `false` (no LP shares), `ERC20`, `ERC6909`, and `ERC1155`
- **Access control**: How `ownable`, `roles`, and `managed` each change the constructor shape
- **Hook inputs**: Which hook types use `blockNumberOffset` and `maxAbsTickDelta`
- **Security handoff**: MCP returns code only (does not write files) — always follow up with `v4-security-foundations`

## Related Resources

- [Uniswap Hooks Plugin](/plugins/uniswap-hooks) - Parent plugin
- [v4 Security Foundations](/skills/v4-security-foundations) - Security review companion skill (run after generation)
- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview) - Official documentation
- [OpenZeppelin Contracts Wizard](https://wizard.openzeppelin.com) - Underlying generation tool
