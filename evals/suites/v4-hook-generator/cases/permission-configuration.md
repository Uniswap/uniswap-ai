# Permission Configuration

I am building a Uniswap v4 hook that applies a small protocol fee on every swap. The hook only
needs to observe the swap after it completes to record statistics and collect the fee — it does
not need to modify swap behavior before the swap executes.

## Questions

1. Which permission flags should I enable for this hook? Which should remain `false`?
2. Is there a risk difference between enabling `afterSwap` versus `beforeSwap`? Explain.
3. What is the implication of enabling permissions on the hook's deployed address? What tool do I
   need to use at deployment time?
4. If I later decide I also need `afterSwapReturnDelta` to extract the fee directly from swap
   output, what additional security consideration does that introduce?

## Requirements

Your response should:

1. Identify the minimal set of permissions for the described use case
2. Explain the security risk level of each enabled permission
3. Clearly describe the address encoding constraint and name the tool needed to satisfy it
4. Explain the CRITICAL risk of `afterSwapReturnDelta` and reference the relevant companion skill
