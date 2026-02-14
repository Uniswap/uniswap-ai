---
title: Uniswap CCA
order: 4
---

# Uniswap CCA

Configure and deploy Continuous Clearing Auction (CCA) smart contracts for token distribution.

## Installation

```bash
/plugin install uniswap-cca
```

## Skills

| Skill                                  | Description                                                         | Invocation      |
| -------------------------------------- | ------------------------------------------------------------------- | --------------- |
| [Configurator](../skills/configurator) | Interactive bulk form configuration flow for CCA auction parameters | `/configurator` |
| [Deployer](../skills/deployer)         | Deployment guidance for CCA contracts via Factory pattern           | `/deployer`     |

## MCP Servers

| Server              | Description                                                        | Type  |
| ------------------- | ------------------------------------------------------------------ | ----- |
| cca-supply-schedule | Generate and encode supply schedules using normalized convex curve | stdio |

## Skill Workflow

The skills are designed to be used in sequence:

```text
configurator (configure parameters)
        |
    JSON config file
        |
deployer (deploy via Factory)
```

1. **Configurator**: Collects auction parameters through efficient bulk form prompts (up to 4 questions per batch), generates supply schedules via MCP tool, and outputs a JSON configuration file.
2. **Deployer**: Validates the JSON config, displays a deployment plan, provides Foundry script examples, and guides post-deployment steps.

## Network Support

| Network          | Chain ID | Block Time |
| ---------------- | -------- | ---------- |
| Ethereum Mainnet | 1        | 12s        |
| Unichain         | 130      | 1s         |
| Unichain Sepolia | 1301     | 2s         |
| Base             | 8453     | 2s         |
| Arbitrum         | 42161    | 2s         |
| Sepolia          | 11155111 | 12s        |

## Key Concepts

### Q96 Fixed-Point Format

CCA uses Q96 fixed-point arithmetic for precise pricing:

- **Q96**: 2^96 = 79228162514264337593543950336
- **Formula**: `Q96 * ratio / 10^(tokenDecimals - currencyDecimals)`

### MPS (Milli-Basis Points)

Supply schedules use MPS = 1e7 (10 million). Each MPS unit represents one thousandth of a basis point. Schedule steps are defined as `{mps, blockDelta}` pairs that always total exactly 10,000,000 MPS.

### Factory Deployment

Uses `ContinuousClearingAuctionFactory` (v1.1.0) at canonical address `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5`. Deploys via CREATE2 for consistent addresses across chains.

## Related

- [Plugins Overview](/plugins/) - All available plugins
- [Skills](/skills/) - All available skills
- [CCA Repository](https://github.com/Uniswap/continuous-clearing-auction)
- [Uniswap CCA Docs](https://docs.uniswap.org/contracts/liquidity-launchpad/CCA)
