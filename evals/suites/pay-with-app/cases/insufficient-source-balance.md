# Insufficient Source Balance Test Case

I got this 402 from an OKX agent merchant on X Layer. The merchant wants
100 USDT0:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "100000000",
      "resource": "https://api.example.com/v1/premium-research",
      "description": "Premium research task",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 600,
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

My wallet is `0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789`. I have:

- 0 USDT0 on X Layer
- 5 USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- 0.005 ETH on Base (gas only)
- Nothing on any other chain

Walk me through paying the 100 USDT0 needed.
