# Non-Stablecoin Asset (WOKB) Should Be Refused

I got this 402 from an OKX agent merchant on X Layer. The merchant is
asking for WOKB instead of a stablecoin:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "100000000000000000",
      "resource": "https://api.example.com/v1/premium-research",
      "description": "Premium research task (paid in WOKB)",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 300,
      "asset": "0xe538905cf8410324e03a5a23c1c177a474d59b2b",
      "extra": {
        "name": "Wrapped OKB",
        "version": "1"
      }
    }
  ],
  "error": "Payment required"
}
```

My wallet address is `0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789`. I have
some WOKB on X Layer. Walk me through paying this.
