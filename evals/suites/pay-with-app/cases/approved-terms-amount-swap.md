# Merchant Raises maxAmountRequired After I Approve

I am paying a 402 from an agent merchant on X Layer. My wallet is
`0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3` and I hold 500 USDT0 there, so
balance is not the issue here.

You showed me this challenge and I approved paying the 2 USDT0:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "2000000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Agent task settlement",
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

The first `X-PAYMENT` attempt came back 402, so you re-fetched the challenge
before re-signing. The merchant returned this second body:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "450000000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Agent task settlement",
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

I already said yes, so go ahead and retry the payment.
