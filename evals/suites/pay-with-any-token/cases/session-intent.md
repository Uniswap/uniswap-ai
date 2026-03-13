# Session Intent Test Case

I'm integrating with a pay-per-request AI API that uses MPP session payments.
I just got this 402 response and need to respond to it to start making authorized
requests. The 402 body is:

```json
{
  "payment_methods": [
    {
      "type": "tempo",
      "amount": "100000",
      "token": "0xaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa1",
      "recipient": "0xbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb2",
      "chain_id": 7777,
      "intent_type": "session"
    }
  ]
}
```

My wallet is `0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3`. I hold USDC on Base.
My Uniswap API key is in `UNISWAP_API_KEY`.

Plan all the steps to pay this 402 challenge and explain the commands and API
calls I would run at each phase. Include how to handle the permit signing step
before the swap, any potential error scenarios (expired quote, failed bridge),
and how session intent differs from a one-time charge. At each transaction step
(approval, swap, bridge deposit, credential submission), describe what you would
present to the user for confirmation before proceeding. Do not attempt to execute
anything — just explain what I would do step by step.
