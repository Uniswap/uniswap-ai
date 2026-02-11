# Basic CCA Deployment

Deploy a configured CCA auction on Ethereum Mainnet using the Factory contract.

## Context

- Network: Ethereum Mainnet (Chain ID 1, 12s block time)
- Factory: ContinuousClearingAuctionFactory v1.1.0
- Configuration file is already prepared with valid parameters
- User wants step-by-step deployment guidance

## Requirements

1. Show educational disclaimer about AI-generated deployment commands
2. Verify configuration file validity before proceeding
3. Provide correct Factory address (0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5)
4. Show the initializeDistribution function signature and parameters
5. Provide Foundry deployment script example
6. Include post-deployment steps (onTokensReceived call)
7. Include private key security best practices

## Constraints

- Must show educational disclaimer and get acknowledgment before deployment steps
- Must include private key security guidance (hardware wallets, encrypted keystores)
- Must recommend testnet deployment first
- Must include validation checklist
- Factory uses CREATE2 for consistent addresses

## Expected Output

A deployment guide including:

- Educational disclaimer with acknowledgment requirement
- Configuration validation steps
- Factory contract details and interface
- Foundry script example for deployment
- Post-deployment verification steps
- Private key security recommendations
- Troubleshooting for common deployment issues
