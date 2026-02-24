# Full Range V2 Liquidity

I want to add liquidity to a V2 ETH/DAI pool on Ethereum. I just want simple full range liquidity.

## Context

- The user wants a simple V2 position (full range, no concentrated liquidity)
- Token pair: ETH/DAI on Ethereum mainnet
- They prefer simplicity over capital efficiency
- Amount is not specified

## Requirements

1. Verify ETH and DAI addresses on Ethereum
2. Explain that V2 provides full-range liquidity by default
3. Mention the trade-offs vs V3 concentrated positions
4. Generate a Uniswap deep link for V2 LP creation (omit the amount — generate the link without it so the user can fill it in the UI)
5. Handle the missing amount gracefully by generating the link anyway

## Expected Output

A response that explains V2 full-range liquidity, verifies token addresses, and generates a clickable Uniswap deep link (app.uniswap.org) for the V2 add-liquidity interface. The link should work even without a deposit amount specified.
