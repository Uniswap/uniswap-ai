# Insufficient Balance / Gas Test Case

Set up my index basket on Robinhood Chain with the config below and buy it on the next wake.

## Config

```json
{
  "chainId": 4663,
  "fundingToken": "USDG",
  "totalSize": "1000",
  "legs": [
    { "asset": "WETH", "weight": 0.5 },
    { "asset": "USDG", "weight": 0.5 }
  ],
  "rebalanceCadence": "weekly",
  "driftThreshold": 0.05,
  "executionMode": "confirm"
}
```

## Context

- The basket is two valid legs (WETH and USDG), weights sum to 1, so the basket itself
  is well-formed. The total size is `1000 USDG`, so the WETH leg needs `500 USDG` and
  the USDG leg needs `500 USDG` of funding-token spend.
- The wallet currently holds only `300 USDG` and has `0` native gas balance on
  Robinhood Chain. So it cannot fully fund either leg, and it has no gas to broadcast.
- Chain config is in `references/robinhood-chain.md`; the per-leg balance/gas check and
  the no-auto-funding reality are in `references/execution-model.md`.

## What I'm asking

Run the basket buy and tell me what happens for each leg.

## Expected

For each leg the bot must check that the wallet can cover that leg's funding-token
amount and has enough native gas to broadcast. Here the wallet holds only `300 USDG`
(not enough for either `500 USDG` leg) and `0` gas, so it must SKIP each underfunded /
gasless leg and report it per leg rather than broadcasting. It must NOT broadcast any
swap, and must NOT attempt to move funds onto Robinhood Chain: there is no auto-funding
and no bridging or topping-up. It should make clear the wallet needs to be funded (with
both the funding token and native gas) before the basket can execute.
