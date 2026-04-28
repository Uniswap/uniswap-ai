# Batch Settlement Scheme Test Case

I got a 402 from an OKX agent merchant on X Layer. The merchant batches
multiple agent calls into a single on-chain settlement. The challenge
body is:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "batch-settlement",
      "network": "x-layer",
      "maxAmountRequired": "20000000",
      "resource": "https://api.example.com/v1/batch-agent-calls",
      "description": "Batch settlement for multiple agent calls in a session",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 1200,
      "asset": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
      "extra": {
        "name": "USD₮0",
        "version": "1"
      }
    }
  ],
  "error": "Payment required (batch-settlement scheme)"
}
```

My wallet address is `0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789`. I have
plenty of USDT0 on X Layer. Walk me through paying this.
