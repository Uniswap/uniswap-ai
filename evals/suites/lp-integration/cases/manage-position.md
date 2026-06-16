# Position Management Test Case

Show me how to manage an existing v3 liquidity position: increase it, then partially remove liquidity, then claim accumulated fees.

## Context

- TypeScript/Node.js backend
- Working with an existing v3 position on Ethereum mainnet, identified by its NFT token ID
- Need to perform three separate management actions on the same position
- Using viem for signing and broadcasting

## Requirements

1. Add liquidity to the position via /lp/increase, using `nftTokenId` to identify it
2. Remove 25% of the liquidity via /lp/decrease with `liquidityPercentageToDecrease`
3. Collect accumulated trading fees via /lp/claim_fees
4. Use the correct field name for the position NFT ID in each endpoint (`nftTokenId` for increase/decrease, `tokenId` for claim_fees)
5. Validate each returned transaction before broadcasting

## Constraints

- Must use the correct endpoint paths: /lp/increase, /lp/decrease, /lp/claim_fees
- Must use `nftTokenId` for increase and decrease requests
- Must use `tokenId` (not `nftTokenId`) for claim_fees requests
- Must call /lp/check_approval before each write action
- Should include error handling

## Expected Output

A TypeScript implementation demonstrating all three position-management operations in sequence, with correct field names per endpoint and pre-broadcast validation on each transaction.
