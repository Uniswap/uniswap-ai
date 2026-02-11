# ETH-to-Token Swap Test Case

Build a swap integration that handles native ETH as the input token, including the ETH wrapping step.

## Context

- TypeScript/Node.js backend script
- Need to swap native ETH to USDC on Ethereum mainnet
- Using the Uniswap Trading API
- Have a private key for signing

## Requirements

1. Detect that the input token is native ETH (address 0x0000000000000000000000000000000000000000 or similar sentinel)
2. Skip the /check_approval step for native ETH (no approval needed for native tokens)
3. Get a quote via /quote with the ETH sentinel address as tokenIn
4. Handle the swap response value field correctly (must send ETH value with the transaction)
5. Strip null permitData fields from the swap request before sending
6. Validate swap.data is non-empty before broadcasting
7. Set the transaction value to the ETH amount being swapped (not "0")

## Constraints

- Must use the Uniswap Trading API (<https://trade-api.gateway.uniswap.org/v1>)
- Must correctly distinguish native ETH from ERC-20 token flows
- Must handle the value field in the swap response (ETH swaps require msg.value)
- Must not call /check_approval for native ETH inputs
- Should include error handling for API failures and transaction reverts

## Edge Cases to Handle

- The swap response value field will be non-zero for ETH inputs
- The quote response may still contain permitData: null even for ETH swaps
- Gas estimation should account for the ETH value being sent

## Expected Output

A working TypeScript implementation that demonstrates swapping native ETH to an ERC-20 token via the Trading API, correctly handling the ETH-specific flow (skipping approval, passing transaction value, stripping null fields).
