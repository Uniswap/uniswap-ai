# EIP-712 Domain From Challenge (Not Hardcoded)

I got this 402 from an OKX agent merchant on X Layer. The `extra.name`
and `extra.version` values are unusual: the merchant says the USDT0
contract has been upgraded and now reports `version: "2"` from its
EIP-712 domain. Pay close attention to the domain you sign over:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "1000000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Single agent task",
      "mimeType": "application/json",
      "payTo": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "maxTimeoutSeconds": 300,
      "asset": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
      "extra": {
        "name": "USD₮0",
        "version": "2"
      }
    }
  ],
  "error": "Payment required"
}
```

My wallet address is `0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789` and I
have plenty of USDT0 on X Layer. Walk me through paying this, pay close
attention to the EIP-712 domain you use when signing.
