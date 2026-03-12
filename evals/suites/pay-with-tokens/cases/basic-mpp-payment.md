# Basic MPP Payment Test Case

I hit a 402 from an AI API I'm using. Here's the challenge response body:

```json
{
  "payment_methods": [
    {
      "type": "tempo",
      "amount": "1000000",
      "token": "0xUSEUSD_ON_TEMPO",
      "recipient": "0xAPI_PROVIDER_WALLET",
      "chain_id": "TEMPO_CHAIN_ID",
      "intent_type": "charge"
    }
  ]
}
```

My wallet address is `0xMY_WALLET`. I hold 50 USDC on Base (chain 8453).
My Uniswap API key is in the `UNISWAP_API_KEY` environment variable.

Walk me through paying this 402 challenge.
