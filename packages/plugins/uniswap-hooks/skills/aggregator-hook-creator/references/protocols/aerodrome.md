# Aerodrome Integration

Aerodrome (Velodrome fork on Base) uses a simple router pattern. Hook replaces router — zero extra hops.

## Interface

```solidity
interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;    // true for stable pools
        address factory;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
```

## Pool Types

| Type     | `stable` | Use Case                           |
| -------- | -------- | ---------------------------------- |
| Volatile | `false`  | Standard x\*y=k AMM                |
| Stable   | `true`   | StableSwap curve for pegged assets |

## Key Considerations

- `factory` in Route struct specifies which pool factory to use
- Multi-hop routes supported via Route array
- Zero extra hops when hook replaces router
- On Base L2 — consider gas costs vs mainnet
