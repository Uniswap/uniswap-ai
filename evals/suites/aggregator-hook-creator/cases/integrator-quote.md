# Quote an Aggregator Hook Pool

I run a router. I found a v4 pool whose hook is a Uniswap-deployed aggregator hook, and I want to price a swap of 1,000 units of token0 for token1 through it, and show its liquidity depth.

1. Which hook functions do I call, and how (view call or transaction)?
2. How do I express an exact-input amount versus an exact-output amount?
3. How should I keep liquidity depth up to date?
4. Where do I find which hooks Uniswap uses for routing, and what should I do about slippage when I execute?
