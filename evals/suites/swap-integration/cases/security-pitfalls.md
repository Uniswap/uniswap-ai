# Security Pitfalls Test Case

Build a secure swap integration that avoids all common Trading API pitfalls and includes defensive validation.

## Context

- TypeScript/Node.js backend script handling real user funds
- Production environment where security is critical
- Using the Uniswap Trading API
- Must handle both Permit2 and non-Permit2 swap flows

## Requirements

1. Strip null permitData from the quote response before sending to /swap (API rejects permitData: null)
2. Never wrap the quote response in {quote: quoteResponse} - spread it into the request body
3. Validate that permitData and signature are BOTH present or BOTH absent (never one without the other)
4. Validate swap.data is non-empty hex before broadcasting (check for empty string, "0x", null, undefined)
5. Validate swap.to and swap.from are valid Ethereum addresses before broadcasting
6. Handle quote expiration by checking freshness and re-fetching if stale
7. Include a prepareSwapRequest helper that strips null fields and enforces Permit2 invariants
8. Include a validateSwapResponse function that checks all pre-broadcast conditions

## Constraints

- Must demonstrate the null field stripping pattern (destructure permitData, permitTransaction, spread rest)
- Must NOT include permitData: null in the swap request body
- Must NOT wrap quote in {quote: ...}
- Must validate swap response fields before calling sendTransaction
- Must handle both Permit2 and non-Permit2 flows correctly

## Security Checks the Output MUST Include

- Pre-broadcast validation of swap.data (non-empty, valid hex)
- Address validation of swap.to and swap.from
- Permit2 field pairing (both or neither)
- Null field stripping from quote response
- Quote freshness check or deadline parameter

## Anti-Patterns the Output MUST NOT Include

- permitData: null in any request body
- {quote: quoteResponse} wrapping pattern
- Broadcasting without validating swap.data
- Including signature without permitData or vice versa
- Hardcoded API keys in source code

## Expected Output

A production-quality TypeScript implementation with explicit prepareSwapRequest and validateSwapResponse helper functions that demonstrate all critical security patterns for the Uniswap Trading API.
