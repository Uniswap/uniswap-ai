# Cross-Chain Funding Into USDG on X Layer

I got this 402 from an OKX agent merchant on X Layer. The merchant
specifically requires USDG (not USDT0):

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "5000000",
      "resource": "https://api.example.com/v1/usdg-only-task",
      "description": "Compliance-restricted task (USDG required)",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 600,
      "asset": "0x4a1c3aD6Ed28a636ee1751C69071f6be75DEb8B8",
      "extra": {
        "name": "USDG",
        "version": "1"
      }
    }
  ],
  "error": "Payment required"
}
```

My wallet is `0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789`. I have:

- 0 USDG on X Layer
- 0 USDT0 on X Layer
- 250 USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- 0.05 ETH on Base

Walk me through paying the 5 USDG needed.
