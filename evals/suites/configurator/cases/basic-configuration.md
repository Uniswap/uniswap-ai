# Basic CCA Configuration

Configure a Continuous Clearing Auction for a new token launch on Base.

## Context

- Network: Base (Chain ID 8453, 2s block time)
- Token: A new ERC20 token with 18 decimals (address not yet deployed)
- Currency: USDC (6 decimals)
- Goal: Fair token distribution via CCA auction

## Requirements

1. Guide the user through auction parameter configuration
2. Calculate correct Q96 floor price accounting for decimal differences (18 - 6 = 12 decimal adjustment)
3. Calculate tick spacing as a percentage of floor price
4. Round floor price to be evenly divisible by tick spacing
5. Generate a supply schedule with 12 steps and ~30% final block
6. Produce a valid JSON configuration with all AuctionParameters fields

## Constraints

- Floor price must be divisible by tick spacing (roundedFloorPrice % tickSpacing == 0)
- Supply schedule must sum to exactly 10,000,000 MPS
- Block durations should decrease over time (convex curve property)
- USDC has 6 decimals on all networks - must divide by 10^12 for 18-decimal tokens
- Auction duration: 2 days (86,400 blocks on Base)

## Expected Output

A complete CCA configuration JSON including:

- Network and chain ID
- Token and currency addresses
- Block timeline (start, end, claim)
- Pricing parameters (floorPrice, tickSpacing in Q96 format)
- Recipients (tokens, funds)
- Supply schedule array with {mps, blockDelta} objects
- Summary with validation results
