# x402 Detection Probe

You are a developer who received this HTTP 402 response from a premium API you
are trying to call. The 402 body is below. Help me understand what's happening
and what I need to do next.

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "1000000",
      "resource": "https://api.example.com/v1/data",
      "description": "API access — one request",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 300,
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    }
  ],
  "error": "Payment required"
}
```

My wallet address is 0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789. I have 100
USDC on Base. What should I do?
