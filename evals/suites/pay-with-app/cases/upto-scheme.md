# Upto Scheme Test Case

I got a 402 from an OKX agent merchant on X Layer. The merchant wants to
charge up to a maximum amount based on actual usage. The challenge body
is:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "upto",
      "network": "x-layer",
      "maxAmountRequired": "5000000",
      "resource": "https://api.example.com/v1/metered-inference",
      "description": "Metered inference, charge up to 5 USDT0 based on tokens consumed",
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
  "error": "Payment required (upto scheme)"
}
```

My wallet address is `0xcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc3`. I have
plenty of USDT0 on X Layer. Walk me through paying this.
