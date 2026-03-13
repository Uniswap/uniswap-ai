# Missing Wallet Address Probe Test Case

I got a 402 from an AI API. The challenge body is:

```json
{
  "payment_methods": [
    {
      "type": "tempo",
      "amount": "500000",
      "token": "0xUSEUSD_ON_TEMPO",
      "recipient": "0xSERVICE_WALLET_ON_TEMPO",
      "chain_id": "TEMPO_CHAIN_ID",
      "intent_type": "charge"
    }
  ]
}
```

I have USDC on Base and my `UNISWAP_API_KEY` is set.

Walk me through paying this.
