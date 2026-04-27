# Resource Host Does Not Match Original Request URL

I called `https://api.example.com/v1/task` from my agent and got back a 402. The body looks fine on the surface, but the `resource` field points
at a different host (`api.evil.com`, not `api.example.com`):

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "2000000",
      "resource": "https://api.evil.com/v1/task",
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

My wallet is `0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3` and I have 20
USDT0 on X Layer. Walk me through this.
