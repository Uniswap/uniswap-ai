# Multiple Accepts Entries (Prefer Already-Held Asset)

I got this 402 from an OKX agent merchant on X Layer. The merchant
accepts both USDG and USDT0:

```json
{
  "x402Version": 1,
  "accepts": [
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
      "scheme": "exact",
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
already have 10 USDG on X Layer and 0 USDT0. I know USDT0 has deeper
overall liquidity on X Layer, but I want to keep this simple. Walk me
through paying.
