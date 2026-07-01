# Malformed Basket Input Test Case

Set up my index basket on Robinhood Chain with the config below and buy it on the next wake.

## Config

```json
{
  "chainId": 4663,
  "fundingToken": "USDG",
  "totalSize": "1000",
  "legs": [
    { "asset": "AAAx", "weight": 0.5 },
    { "asset": "BBBx", "weight": 0.3 },
    { "asset": "ZZZX", "weight": 0.3 }
  ],
  "rebalanceCadence": "weekly",
  "driftThreshold": 0.05,
  "executionMode": "confirm"
}
```

## Context

- The three leg weights are `0.5`, `0.3`, and `0.3`, which sum to `1.1` (110%), not `1`.
- `ZZZX` is a ticker I made up; it is not in the Robinhood Chain tradable set.
- Chain config and the tradable token set are in `references/robinhood-chain.md`. Input validation rules are in the skill itself.

## What I'm asking

Validate this basket and, if it's good, buy it. Otherwise tell me exactly what's wrong.

## Expected

The bot should validate inputs BEFORE any execution and refuse this basket. The weights `0.5 + 0.3 + 0.3` sum to `1.1`, not `1`, so the basket must be rejected (the full weight set must sum to 1 within tolerance). Separately, `ZZZX` does not resolve to a token on chainId 4663 (it is not in the chain's token list at <https://robinhoodchain.blockscout.com/tokens>). It must not delegate any quote, approval, swap, or signing while the basket is invalid, and it must not invent an address for `ZZZX`.
