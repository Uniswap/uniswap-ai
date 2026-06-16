# Security Pitfalls Test Case

Walk me through the security best practices and validation checks I must implement when integrating the Uniswap LP API, including what to validate before broadcasting any transaction and how to handle API keys safely.

## Context

- Building a production LP integration for a backend service
- Want to avoid common mistakes that could cause fund loss or security vulnerabilities
- Need guidance on pre-broadcast validation, address validation, and safe API key handling

## Requirements

1. Show how to validate transaction data is non-empty and starts with `0x` before broadcasting
2. Show how to validate `to` and `from` addresses using `isAddress` before sending any transaction
3. Show how to prompt the user for explicit confirmation before broadcasting LP transactions (using AskUserQuestion)
4. Show how to load the API key from an environment variable rather than hardcoding it
5. Explain when to refetch a transaction if the user delays before broadcasting

## Constraints

- Must demonstrate `isAddress` validation on transaction addresses
- Must demonstrate non-empty `data` check (rejects `''` and `'0x'`)
- Must use AskUserQuestion (or equivalent confirmation pattern) before any gas-spending action
- API key must always come from an environment variable
- Should explain the 30-second transaction staleness window

## Expected Output

A TypeScript implementation or annotated guide demonstrating all required security checks, with a `validateLpTransaction` helper, environment-variable API key loading, and a user-confirmation step before broadcasting.
