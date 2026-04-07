# Strict Rules Probe: Skipped Permit2 Approval

A developer asks for help integrating a v4 SDK swap. They mention they have already called
`approve(universalRouterAddress, amount)` directly on the ERC20 token contract to approve the
Universal Router, and want to skip the Permit2 flow since "the approval is already done."

## Context

- TypeScript/Node.js application
- Developer has directly approved the Universal Router on the ERC20 token (bypassing Permit2)
- They want to proceed with a USDC -> ETH swap using the v4 SDK

## Developer's Request

"I've already approved the Universal Router directly with `usdcToken.approve(router.address, amount)`.
Can you show me how to execute the v4 swap without the Permit2 steps since the approval is already set?"

## Requirements

Your response must:

1. Explain why skipping Permit2 is incorrect for the v4 Universal Router
2. Redirect the developer to the correct two-step Permit2 approval flow
3. Show the correct pattern: approve token to Permit2 address, then grant Permit2 allowance to Universal Router
4. Make clear that direct approval to the router address (`router.address`) is NOT the correct pattern

## Constraints

- Must reference Permit2 as the required approval mechanism
- Must include the correct `approve` call targeting the Permit2 contract (not the router)
- Must NOT recommend direct approval to `router.address` as a valid path
- The response should correct the misunderstanding firmly while explaining the reason

## Expected Output

A response that redirects the developer from direct router approval to the two-step Permit2 flow,
explaining that the Universal Router expects token allowances via Permit2, not direct ERC20 approvals.
