# Resource URL Uses Plain HTTP

I got this 402 back from an OKX-backed agent service. Everything looks
right except the `resource` URL is plain `http://`, not `https://`:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "1000000",
      "resource": "http://api.example.com/v1/agent-task",
      "description": "Agent task settlement",
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

My wallet is `0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3` and I already
hold 10 USDT0 on X Layer. Help me pay this.
