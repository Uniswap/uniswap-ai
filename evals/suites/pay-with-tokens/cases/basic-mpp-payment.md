# Basic MPP Payment Test Case

I hit a 402 from an AI API I'm using. Here's the challenge response body:

```json
{
  "payment_methods": [
    {
      "type": "tempo",
      "amount": "1000000",
      "token": "0xaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa1",
      "recipient": "0xbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb2",
      "chain_id": 7777,
      "intent_type": "charge"
    }
  ]
}
```

My wallet address is `0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3`. I hold 50 USDC on Base (chain 8453).
My Uniswap API key is in the `UNISWAP_API_KEY` environment variable.

Plan all the steps to pay this 402 challenge and explain the commands and API
calls I would run at each phase. Do not attempt to execute anything — just
explain what I would do step by step.
