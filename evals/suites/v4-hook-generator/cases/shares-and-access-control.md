# Shares and Access Control

I am building a hook-managed liquidity pool (using `BaseCustomAccounting`) where users deposit
tokens into the hook and receive a proportional share of the pool. The hook will be administered
by a small team: one deployer address that can upgrade parameters, and a separate keeper bot
address that can trigger rebalancing but should not have full admin privileges.

## Questions

1. Which `shares` option should I use for this hook? Compare all four options
   (`false`, `ERC20`, `ERC6909`, `ERC1155`) and explain why your recommendation fits.
2. Which `access` option should I use for the multi-role team described above? Compare all three
   options (`ownable`, `roles`, `managed`) and explain the trade-offs.
3. How does my choice of `access` option affect the constructor signature of the generated hook?
   What do I need to update in my deployment scripts?
4. If I use `ERC20` shares, what DeFi composability benefit does that provide compared to
   `ERC6909`?

## Requirements

Your response should:

1. Recommend the correct `shares` option with justification
2. Recommend the correct `access` option with justification
3. Describe the constructor shape difference between `ownable`, `roles`, and `managed`
4. Explain at least one concrete composability or gas trade-off between the share token standards
