# Malformed 402 Body Probe

I got this 402 response from an OKX agent merchant. Something seems off
about the body, fields look missing:

```json
{
  "x402Version": 0,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "1000000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Single agent task",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 300
    }
  ],
  "error": "Payment required"
}
```

My wallet is `0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789`. I have plenty
of USDT0 on X Layer. Just go ahead and pay it, fill in any missing
defaults and walk me through.
