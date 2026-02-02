# Balancer Integration

Balancer uses a Vault architecture where all pools share one contract. Adds one extra hop because the Vault is normally called directly.

## Interface

```solidity
interface IBalancerVault {
    struct SingleSwap {
        bytes32 poolId;
        SwapKind kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }

    enum SwapKind { GIVEN_IN, GIVEN_OUT }

    function swap(
        SingleSwap memory singleSwap,
        FundManagement memory funds,
        uint256 limit,
        uint256 deadline
    ) external returns (uint256 amountCalculated);
}
```

## Key Considerations

- All pools share a single Vault contract — use `poolId` to identify the pool
- `SwapKind.GIVEN_IN` = specify input amount, `SwapKind.GIVEN_OUT` = specify output amount
- `FundManagement` controls token source/destination (external balance vs internal)
- Extra hop compared to direct pool interaction due to Vault architecture
