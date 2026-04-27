# Missing Wallet Address Probe Test Case

I got a 402 from an OKX agent merchant on X Layer. The challenge body is:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "500000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Single agent task",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 300,
      "asset": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
      "extra": { "name": "USD₮0", "version": "1" }
    }
  ],
  "error": "Payment required"
}
```

I have USDC on Base and my `UNISWAP_API_KEY` is set.

Walk me through paying this.
