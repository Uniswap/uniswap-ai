# CLAUDE.md - uniswap-driver Plugin

## Overview

This plugin provides AI-powered assistance for planning Uniswap swaps and liquidity positions. It generates deep links that open directly in the Uniswap web interface with pre-filled parameters.

## Plugin Components

### Skills (./skills/)

- **swap-planner**: Plan and generate deep links for token swaps
- **liquidity-planner**: Plan and generate deep links for LP positions (V2, V3, V4)

## Deep Link URL Structures

### Swap Deep Links

Base URL: `https://app.uniswap.org/swap`

| Parameter        | Description                      | Example                        |
| ---------------- | -------------------------------- | ------------------------------ |
| `chain`          | Network name                     | `ethereum`, `base`, `arbitrum` |
| `inputCurrency`  | Input token address or "NATIVE"  | `0xA0b8...` or `NATIVE`        |
| `outputCurrency` | Output token address or "NATIVE" | `0xA0b8...` or `NATIVE`        |
| `value`          | Amount to swap                   | `1.5`                          |
| `field`          | Which field the value applies to | `INPUT` or `OUTPUT`            |

**Example**: `https://app.uniswap.org/swap?chain=base&inputCurrency=NATIVE&outputCurrency=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&value=1&field=INPUT`

### Liquidity Deep Links

Base URL: `https://app.uniswap.org/positions/create`

| Parameter         | Description                | Example                                                 |
| ----------------- | -------------------------- | ------------------------------------------------------- |
| `chain`           | Network name               | `ethereum`, `base`                                      |
| `currencyA`       | First token address        | `0xA0b8...` or `NATIVE`                                 |
| `currencyB`       | Second token address       | `0xA0b8...`                                             |
| `priceRangeState` | JSON with range params     | `{"priceInverted":false,"fullRange":true,...}`          |
| `depositState`    | JSON with deposit params   | `{"exactField":"TOKEN0",...}`                           |
| `fee`             | JSON with fee tier         | `{"feeAmount":3000,"tickSpacing":60,"isDynamic":false}` |
| `hook`            | V4 hook address (optional) | `0x...` or `undefined`                                  |
| `step`            | Flow step                  | `1`                                                     |

**URL Encoding**: Only encode quotes (`"` → `%22`). Do NOT encode `{}`, `:`, or `,`.

> **Why?** The Uniswap interface expects JSON-like parameter structure in the URL. Full URL encoding of braces and colons breaks parsing. Only quotes need encoding to avoid URL syntax conflicts.

### Chain Names for URLs

| Chain     | URL Parameter |
| --------- | ------------- |
| Ethereum  | `ethereum`    |
| Base      | `base`        |
| Arbitrum  | `arbitrum`    |
| Optimism  | `optimism`    |
| Polygon   | `polygon`     |
| BNB Chain | `bnb`         |
| Avalanche | `avalanche`   |
| Celo      | `celo`        |
| Blast     | `blast`       |
| Zora      | `zora`        |

## On-Chain Verification

Skills should verify token contracts before generating deep links:

```typescript
// Basic verification - check contract exists
const code = await client.getCode({ address: tokenAddress });
const isContract = code !== '0x' && code !== undefined;
```

## Output Format

Skills should output:

1. **Summary**: What the operation will do
2. **Deep Link**: Clickable URL that opens in browser
3. **Warnings**: Any risks or considerations

Example output:

```markdown
## Swap Summary

- **From**: 1 ETH on Base
- **To**: ~3,200 USDC (estimated)
- **Slippage**: Default (0.5%)

[Open in Uniswap](https://app.uniswap.org/swap?...)

**Note**: Final amount depends on current market price. Review details in Uniswap before confirming.
```

## File Structure

```text
uniswap-driver/
├── .claude-plugin/
│   └── plugin.json
├── references/
│   └── chains.md                    # Shared chain config
├── skills/
│   ├── swap-planner/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── data-providers.md
│   └── liquidity-planner/
│       ├── SKILL.md
│       └── references/
│           ├── data-providers.md
│           └── position-types.md
├── project.json
├── package.json
├── CLAUDE.md
├── AGENTS.md -> CLAUDE.md           # Symlink for agent-agnostic access
└── README.md
```

## Skill Discovery

Skills are stored canonically in `./skills/` within this plugin, but the repository also maintains **root-level symlinks** (e.g., `<repo-root>/skills/swap-planner` → `../packages/plugins/uniswap-driver/skills/swap-planner`). The `.claude-plugin/marketplace.json` references these symlink paths (`./skills/swap-planner`) rather than canonical plugin paths.

> **Why?** Claude Code requires skills to be in a root-relative `skills/` directory for slash command auto-population. This is a workaround for [claude-code#17271](https://github.com/anthropics/claude-code/issues/17271). See the root `CLAUDE.md` "Skills.sh Integration" section for full details.

When adding new skills to this plugin:

1. Create the skill in `./skills/<skill-name>/`
2. Add a root symlink: `ln -s ../packages/plugins/uniswap-driver/skills/<skill-name> skills/<skill-name>`
3. Add the skill to both `plugin.json` `skills` array and `marketplace.json` `skills` array

## Related Resources

- [Uniswap Interface](https://app.uniswap.org)
- [Uniswap Docs](https://docs.uniswap.org)
- [viem Documentation](https://viem.sh)
