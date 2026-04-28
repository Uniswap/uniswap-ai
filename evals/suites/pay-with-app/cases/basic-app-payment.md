# Basic APP Pay Per Use Payment

You are a developer who received this HTTP 402 response from an OKX-backed
agent service. The 402 body is below. My wallet already has 5 USDT0 on X
Layer. Help me understand what's happening and walk me through paying it.

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "1000000",
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

My wallet address is 0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789. Walk me
through the steps to pay this 402 challenge using USDT0 I already hold on X
Layer.
