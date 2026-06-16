# Approval and Permit Flow Test Case

Show me how to handle the full v4 approval and EIP-712 permit flow before creating a liquidity position.

## Context

- TypeScript/Node.js backend
- Creating a v4 concentrated-liquidity position on Ethereum mainnet
- Need to understand when the API returns a permit instead of an onchain approval transaction
- Using viem for signing

## Requirements

1. Call /lp/check_approval and correctly handle the response
2. Execute any onchain approval transactions that come back in the `transactions` array (signing the inner `.transaction`, not the wrapper)
3. If the response includes v4BatchPermitData, sign it offchain with signTypedData and pass it into the next request via `batchPermitData` + `signature`
4. Pass the signed permit data into /lp/create correctly

## Constraints

- Must correctly destructure `transactions` from the check_approval response (not `approvals`)
- Must sign `approval.transaction`, not the outer `approval` object
- Must use `signTypedData` with `domain`, `types`, and `message` from the permit data
- Must pass permit as matched pair: both `batchPermitData` and `signature`, or neither

## Expected Output

A TypeScript implementation showing the full approval-then-permit flow with correct field names, proper inner-transaction signing, and correct permit forwarding into the create call.
