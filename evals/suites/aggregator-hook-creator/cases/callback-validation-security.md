# Callback Validation

My aggregator hook wraps a Uniswap V3-style pool. The external pool calls `uniswapV3SwapCallback` on my hook during the swap to collect the input tokens.

What attacks does that callback expose, and what concrete protections should the hook implement? Describe the protections, not a full contract.
