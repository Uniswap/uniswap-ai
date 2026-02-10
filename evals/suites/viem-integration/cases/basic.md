# Basic viem Integration Test Case

Set up a viem client to read data from the Ethereum blockchain.

## Context

- TypeScript/Node.js backend application
- Needs to read ERC-20 token balances
- Using viem as the blockchain library

## Requirements

1. Create a PublicClient with http transport for Ethereum mainnet
2. Read an ERC-20 token balance using readContract
3. Format the balance with correct decimals
4. Include proper TypeScript types
5. Handle potential errors

## Constraints

- Must use viem (not ethers.js or web3.js)
- Must use TypeScript with proper typing
- Should follow viem best practices

## Expected Output

A working TypeScript code example that creates a viem PublicClient, reads a token balance, and formats it correctly.
