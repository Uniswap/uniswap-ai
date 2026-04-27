# Zero-Amount 402 Challenge

I got back a 402 from an OKX agent merchant on X Layer, but the
`maxAmountRequired` field is `"0"`. That seems wrong to me, but I want
to make sure I'm reading it right before I do anything:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "0",
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

My wallet address is `0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3`. I
have 5 USDT0 on X Layer. Walk me through what to do.
