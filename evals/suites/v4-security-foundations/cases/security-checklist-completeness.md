# Security Checklist Completeness

You are preparing a pre-deployment security checklist for a Uniswap V4 hook.

## Context

A development team is about to deploy a V4 hook that:

- Implements beforeSwap and afterSwap callbacks
- Stores some state for tracking purposes
- Makes one external call to an oracle
- Has an admin function for configuration updates

## Questions

1. What security checks should be performed before deployment?
2. Create a comprehensive security checklist covering all major vulnerability categories.
3. What testing methodologies should be applied to this hook?
4. What ongoing security measures should be in place after deployment?

## Requirements

Your response should include checks for:

1. Access control (PoolManager verification, admin functions)
2. Reentrancy protection for external calls
3. Delta accounting correctness
4. Input validation and edge cases
5. Gas considerations (no unbounded loops)
6. Token handling hazards
7. Testing requirements (unit, fuzz, invariant)
8. Audit recommendations based on risk level

## Expected Output

A comprehensive, actionable security checklist that covers all critical areas for V4 hook deployment.
