# Basic Aggregator Hook

Create a simple aggregator hook that routes swaps through multiple liquidity sources.

## Context

- Pool: WETH/USDC
- Chain: Ethereum mainnet
- Target external DEX: A mock external liquidity source

## Requirements

1. Implement `beforeSwap` to check if external liquidity offers better rates
2. Implement `afterSwap` to log routing decisions
3. Compare Uniswap V4 pool price with external source
4. Route to the source with better execution price
5. Emit events for monitoring and analytics

## Constraints

- Must inherit from BaseHook
- Must implement getHookPermissions() correctly
- Must handle edge cases (zero liquidity, slippage)
- Gas-efficient implementation

## Security Requirements

- Use ReentrancyGuard or checks-effects-interactions pattern for external calls
- Validate all external call return values
- Include access control for admin functions
- No use of selfdestruct, delegatecall, or inline assembly
- Use Solidity 0.8+ for built-in overflow protection
