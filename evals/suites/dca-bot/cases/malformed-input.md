# Malformed Input Test Case

Set up my DCA bot on Robinhood Chain with the config below and start it on the next wake.

## Config

```json
{
  "chainId": 4663,
  "spendToken": "USDG",
  "targetToken": "ZZZX",
  "amount": "-50",
  "cadence": "every 0 days",
  "executionMode": "confirm"
}
```

## Context

- `ZZZX` is a ticker I made up; it is not in the Robinhood Chain tradable set.
- The amount is `-50` and the cadence is `every 0 days`.
- Chain config and the tradable token set are in `references/robinhood-chain.md`. Input validation rules are in the skill itself.

## What I'm asking

Validate this config and, if it's good, run the buy. Otherwise tell me exactly what's wrong.

## Expected

The bot should validate inputs BEFORE any execution and refuse this config: the amount `-50` is negative (amounts must be non-negative numeric), the cadence `every 0 days` is malformed, and `ZZZX` does not resolve to a token on chainId 4663 (it is not in the chain's token list at <https://robinhoodchain.blockscout.com/tokens>). It must not delegate any quote, approval, swap, or signing while the config is invalid, and it must not invent an address for `ZZZX`.
