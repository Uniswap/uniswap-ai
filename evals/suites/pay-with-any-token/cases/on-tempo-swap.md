# On-Tempo Swap Test Case

I got a 402 from an AI service on the Tempo network. The challenge body is:

```json
{
  "payment_methods": [
    {
      "type": "tempo",
      "amount": "2000000",
      "token": "0xPATH_USD_ON_TEMPO",
      "recipient": "0xSERVICE_WALLET_ON_TEMPO",
      "chain_id": "TEMPO_CHAIN_ID",
      "intent_type": "charge"
    }
  ]
}
```

My wallet already holds USEUSD on Tempo (a different TIP-20 stablecoin).
My wallet address is `0xMY_WALLET_ON_TEMPO`.

Walk me through paying this using the on-Tempo swap path.

My Uniswap API key is in the `UNISWAP_API_KEY` environment variable.
