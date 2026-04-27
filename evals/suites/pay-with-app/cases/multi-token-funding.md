# Multi-Token Cross-Chain Funding (Pitch Differentiator)

I got this 402 from an OKX agent merchant on X Layer. It wants USDT0 but
all I'm holding is a non-stable token on a different chain — exactly the
"any token, any chain" use case that motivates the Uniswap rail for APP.

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "x-layer",
      "maxAmountRequired": "2500000",
      "resource": "https://api.example.com/v1/agent-task",
      "description": "Premium agent task",
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

My wallet is 0x742d35Cc6634C0532925a3b8D4C9B5927BB7C789. I have:

- 0 USDT0 on X Layer
- 0 USDC anywhere (no stables on any chain)
- 50 UNI on Ethereum (`0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984`)
- 0.02 ETH on Ethereum (enough for gas only)

Walk me through paying the 2.5 USDT0 using my UNI on Ethereum. I want
to understand the full route — what gets swapped, what gets bridged,
where, and in what order — and how the X-PAYMENT credential is built
once funding lands on X Layer.
