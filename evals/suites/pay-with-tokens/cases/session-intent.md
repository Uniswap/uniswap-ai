# Session Intent Test Case

I'm integrating with a pay-per-request AI API that uses MPP session payments.
The 402 response has:

```json
{
  "payment_methods": [
    {
      "type": "tempo",
      "amount": "100000",
      "token": "0xUSEUSD_ON_TEMPO",
      "recipient": "0xAPI_PROVIDER_TEMPO",
      "chain_id": "TEMPO_CHAIN_ID",
      "intent_type": "session"
    }
  ]
}
```

I hold USDC on Base. Walk me through setting up a session payment channel for this API.
Explain how session intent differs from a one-time charge.
