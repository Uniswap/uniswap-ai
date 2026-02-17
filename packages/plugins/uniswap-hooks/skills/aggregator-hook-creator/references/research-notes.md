# Research Notes

Open questions from ongoing research, still to be determined.

## Protocol Fees

How to implement fee collection on aggregator hook swaps?

- v4 has native protocol fee mechanism, but external swaps bypass it
- Options: take fee in hook before/after external call, or integrate with external protocol's fee system

## MEV Protection

How to handle sandwich attacks on external DEX portions?

- External calls are visible in mempool
- Options: private transaction pools (Flashbots), commit-reveal schemes, or accept MEV as cost
- May need per-protocol solutions

## Liquidity Discovery

How to efficiently index available external liquidity?

- Need real-time view of liquidity across Curve, Balancer, Aerodrome, etc.
- Options: custom indexer, existing aggregator APIs (1inch, Paraswap), or on-chain queries
- Trade-off between freshness and gas/latency costs
