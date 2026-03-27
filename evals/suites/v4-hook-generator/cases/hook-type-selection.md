# Hook Type Selection

I want to build a Uniswap v4 hook that charges dynamic LP fees based on pool volatility. The fee
should increase automatically when the pool experiences high price impact, and decrease when the
market is calm. I don't need to implement a custom AMM curve — I just want to adjust the fee
percentage that liquidity providers earn.

## Questions

1. Which hook type from the decision table should I use, and why?
2. Are there any other hook types I should consider for this goal? What are the trade-offs?
3. What is the key difference between `BaseDynamicFee` and `BaseOverrideFee`? Which is better for
   LP fee adjustments specifically?

## Requirements

Your response should:

1. Name the correct hook type from the decision table
2. Explain why this type is the best fit for the stated goal
3. Clarify the distinction between similar-sounding hook types
4. Note any important caveats about using this hook type
