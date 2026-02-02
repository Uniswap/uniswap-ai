# Curve Integration

Curve pools use the exchange function for swaps. Many variants exist (StableSwap, StableSwap-NG, CryptoSwap). Token indices are pool-specific.

## Interface

```solidity
interface ICurvePool {
    function exchange(
        int128 i,           // Input token index
        int128 j,           // Output token index
        uint256 dx,         // Input amount
        uint256 min_dy      // Minimum output
    ) external returns (uint256);

    // For underlying tokens (e.g., aTokens)
    function exchange_underlying(
        int128 i, int128 j,
        uint256 dx, uint256 min_dy
    ) external returns (uint256);
}
```

## Pool Variants

| Variant       | Use Case                    | Notes                                |
| ------------- | --------------------------- | ------------------------------------ |
| StableSwap    | Stablecoins (USDC/USDT/DAI) | Low slippage for pegged assets       |
| StableSwap-NG | Next-gen stable pools       | Improved gas efficiency              |
| CryptoSwap    | Volatile pairs              | Dynamic fees, concentrated liquidity |

## Key Considerations

- Token indices are **pool-specific** — query the pool to get correct indices
- Some pools use `exchange_underlying` for wrapped assets (e.g., aTokens)
- Function selector for `exchange(int128,int128,uint256,uint256)`: `0x3df02124`
