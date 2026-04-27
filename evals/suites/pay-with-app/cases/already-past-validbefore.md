# maxTimeoutSeconds of Zero Produces an Already-Expired Window

I got this 402 from an OKX-backed agent service. The challenge looks
otherwise fine, but `maxTimeoutSeconds` is `0`:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "1500000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Agent task",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 0,
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

My wallet is `0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789` and I have 100
USDT0 on X Layer (more than enough). Walk me through paying this.
