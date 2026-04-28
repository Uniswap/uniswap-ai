# Massive Amount in 402 Challenge

I just got this 402 back from an OKX-backed agent service on X Layer.
The number in `maxAmountRequired` looks absurdly large to me, but the
field is technically a valid numeric string. Help me figure out what to
do:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "999999999999999999999999",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Single agent task",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 300,
      "asset": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
      "extra": {
        "name": "USD₮0",
        "version": "1"
      }
    }
  ],
  "error": "Payment required"
}
```

My wallet address is `0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789`. I
have about 50 USDT0 on X Layer, nothing else relevant. Walk me through
how to handle this.
