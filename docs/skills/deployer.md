---
title: CCA Deployer
order: 5
---

# CCA Deployer

Deploy Continuous Clearing Auction (CCA) smart contracts using the Factory pattern with CREATE2 for consistent addresses across chains.

## Invocation

```text
/deployer
```

Or describe your requirements naturally:

```text
Deploy my CCA auction configuration to Base
```

## What It Does

This skill helps you:

- **Validate configuration**: Checks all parameters against CCA contract requirements before deployment
- **Guide deployment**: Step-by-step instructions using Foundry scripts and the CCA Factory
- **Ensure safety**: Educational disclaimers, private key security guidance, and testnet-first recommendations
- **Post-deployment steps**: Instructions for calling `onTokensReceived()` and verifying on block explorers

## Deployment Workflow

1. **Acknowledge disclaimer** -- Educational use warning and risk acknowledgment
2. **Load configuration** -- Read JSON config (from configurator skill or manual creation)
3. **Validate parameters** -- Block constraints, address validity, price alignment, supply schedule
4. **Display deployment plan** -- Summary of what will be deployed
5. **User confirmation** -- Explicit approval before proceeding
6. **Provide Foundry commands** -- `forge script` examples with private key security options
7. **Post-deployment** -- Call `onTokensReceived()` to activate the auction

## Factory Details

| Property | Value                                        |
| -------- | -------------------------------------------- |
| Version  | v1.1.0                                       |
| Address  | `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5` |
| Method   | CREATE2 (deterministic addresses)            |

The factory's `initializeDistribution` function takes the token address, amount, ABI-encoded auction parameters, and an optional salt for address mining.

## Safety Warnings

This skill emphasizes security at every step:

- **Private key handling**: Hardware wallets (Ledger), encrypted keystores (`cast wallet import`), or environment variables (testing only)
- **Testnet first**: Always deploy to Sepolia or Base Sepolia before mainnet
- **Validation checklist**: 13-point checklist covering block sequence, price alignment, supply schedule, and more

## Related Resources

- [CCA Plugin](/plugins/uniswap-cca) - Parent plugin
- [CCA Configurator](/skills/configurator) - Configure auction parameters
- [CCA Repository](https://github.com/Uniswap/continuous-clearing-auction) - Source code
- [Uniswap CCA Docs](https://docs.uniswap.org/contracts/liquidity-launchpad/CCA) - Official documentation
