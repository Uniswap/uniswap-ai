# MCP Tool Call Generation

I want to generate a Uniswap v4 hook contract that protects liquidity providers from MEV sandwich
attacks. The hook should:

- Use the `AntiSandwichHook` base type
- Enable `beforeSwap` permission only (no delta-return permissions needed)
- Use `safeCast` utility (arithmetic safety)
- Not issue any share tokens (hook does not hold user funds)
- Be owned by a single deployer address (`ownable` access control)
- Use a `blockNumberOffset` of `2` and `maxAbsTickDelta` of `50`

## Task

Produce the complete MCP tool call JSON object I should pass to the OpenZeppelin Contracts Wizard
`generate_hook` tool to scaffold this contract. Name the contract `AntiSandwichMEVHook`.

## Requirements

Your response must:

1. Output a valid JSON object matching the canonical MCP schema from the skill
2. Include all 14 permission flags (set correctly — only `beforeSwap: true`)
3. Set the `inputs` field with the specified `blockNumberOffset` and `maxAbsTickDelta` values
4. Set `shares.options` correctly for a hook that does not issue share tokens
5. Set the `access` field to the correct value for single-owner control
6. Note any post-generation steps required (e.g., HookMiner, deployment script updates)
