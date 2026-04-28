# Shared Wallet Race Test Case

I got this 402 from an OKX agent merchant on X Layer:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "5000000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Agent payment for API call",
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

My wallet is `0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3` and I have
plenty of USDT0 on X Layer (well over 5).

One thing you should know: this wallet is also being used by another
agent on a different machine. Both processes pull from the same private
key and can submit transactions independently. Walk me through paying
this 5 USDT0 challenge.
