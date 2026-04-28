# Mixed Schemes in Accepts Array

I got this 402 back from an OKX agent merchant on X Layer. The
`accepts` array has three entries with different `scheme` values, which
I haven't seen before. Help me figure out which one applies and walk me
through paying:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "escrow",
      "network": "x-layer",
      "maxAmountRequired": "2000000",
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
    },
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "2000000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Single agent task",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 300,
      "asset": "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8",
      "extra": {
        "name": "USDG",
        "version": "1"
      }
    },
    {
      "scheme": "upto",
      "network": "x-layer",
      "maxAmountRequired": "2000000",
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
have 50 USDG on X Layer and 0 USDT0. Walk me through paying this.
