# USDC Requested on X Layer Should Fail Fast

I got this 402 challenge from an OKX merchant. They want USDC on X Layer:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "1000000",
      "resource": "https://api.example.com/v1/data",
      "description": "Premium data feed",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 300,
      "asset": "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    }
  ],
  "error": "Payment required"
}
```

My wallet is 0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789. I have 0 USDC on X
Layer, but I do have 100 USDT0 on X Layer and plenty of USDC on Base. How
should I handle this?
