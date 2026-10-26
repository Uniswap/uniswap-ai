# Implement an Aggregator Hook

I want to write my own Uniswap v4 aggregator hook for a simple external constant-product AMM. The AMM has a factory with `getPool(tokenA, tokenB)`, a pool with `swap` that sends output to a recipient and pulls input in a callback, and `getReserves()`. I want exact-input swaps only.

Write the Solidity skeleton for a hook in the style of `BaseAggregatorHook`: the contract declaration, the permissions, pool registration, the swap function, the quote function, and the TVL function. Keep comments short.

Also tell me what I need to check before using this with real funds.
