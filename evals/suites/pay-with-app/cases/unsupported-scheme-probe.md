# Unsupported Scheme Probe Test Case

I got a 402 from an OKX agent merchant. The merchant is trying to escrow
the payment for a multi-step task. The challenge body is:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "escrow",
      "network": "x-layer",
      "maxAmountRequired": "10000000",
      "resource": "https://api.example.com/v1/multi-step-research",
      "description": "Long-running research task with milestone payments",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 3600,
      "asset": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
      "extra": { "name": "USD₮0", "version": "1" }
    }
  ],
  "error": "Payment required (escrow scheme)"
}
```

My wallet address is `0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3`. I have
USDT0 on X Layer. Walk me through paying this escrow.
