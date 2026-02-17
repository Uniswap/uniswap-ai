---
title: CCA Configurator
order: 4
---

# CCA Configurator

Interactive configuration tool for Continuous Clearing Auction (CCA) smart contract parameters. Guides you through parameter collection in efficient batches and outputs a deployment-ready JSON configuration.

## Invocation

```text
/configurator
```

Or describe your requirements naturally:

```text
Configure a new CCA token auction on Base
```

## What It Does

This skill helps you:

- **Configure auction parameters**: Token, currency, pricing, timing, recipients, and supply schedule
- **Calculate Q96 pricing**: Automatic fixed-point conversion with decimal adjustment for floor price and tick spacing
- **Generate supply schedules**: Uses an MCP tool to produce a normalized convex curve distribution
- **Validate inputs**: Checks all parameters against CCA contract requirements after each batch
- **Output deployment-ready JSON**: Produces a complete configuration file for the deployer skill

## Configuration Flow

Parameters are collected in 5 batches to minimize interaction rounds:

| Batch | Questions | Parameters                                                 |
| ----- | --------- | ---------------------------------------------------------- |
| 1     | 1         | Task selection (configure, generate, review)               |
| 2     | 4         | Network, token address, total supply, currency             |
| 3     | 4         | Auction duration, prebid period, floor price, tick spacing |
| 4     | 4         | Recipients, start time, minimum funds required             |
| 5     | 1         | Optional validation hook                                   |

After collection, the skill generates a supply schedule and displays the complete JSON configuration.

## Output Format

The skill produces a JSON configuration keyed by chain ID:

```json
{
  "8453": {
    "token": "0x...",
    "totalSupply": 100000000000000000000000000,
    "currency": "0x0000000000000000000000000000000000000000",
    "startBlock": 24321000,
    "endBlock": 24327001,
    "floorPrice": 7922816251426433759354395000,
    "tickSpacing": 79228162514264337593543950,
    "supplySchedule": [...]
  }
}
```

## Supported Networks

| Network          | Chain ID | Block Time |
| ---------------- | -------- | ---------- |
| Ethereum         | 1        | 12s        |
| Unichain         | 130      | 1s         |
| Unichain Sepolia | 1301     | 2s         |
| Base             | 8453     | 2s         |
| Arbitrum         | 42161    | 2s         |
| Sepolia          | 11155111 | 12s        |

## Related Resources

- [CCA Plugin](/plugins/uniswap-cca) - Parent plugin
- [CCA Deployer](/skills/deployer) - Deploy a configured auction
- [CCA Repository](https://github.com/Uniswap/continuous-clearing-auction) - Source code
- [Uniswap CCA Docs](https://docs.uniswap.org/contracts/liquidity-launchpad/CCA) - Official documentation
