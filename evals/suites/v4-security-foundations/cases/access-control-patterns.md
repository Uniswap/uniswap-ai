# Access Control Pattern Recognition

You are reviewing a Uniswap V4 hook for access control vulnerabilities.

## Context

A developer has submitted the following hook code for security review:

```solidity
contract MyHook is BaseHook {
    mapping(address => uint256) public userRewards;

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Track rewards for the swapper
        userRewards[msg.sender] += 10;

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function claimRewards() external {
        uint256 amount = userRewards[msg.sender];
        userRewards[msg.sender] = 0;
        // Transfer rewards...
    }
}
```

## Questions

1. Identify the critical access control vulnerability in this code.
2. Explain why using `msg.sender` to identify users in hooks is incorrect.
3. What is the correct pattern for caller verification in V4 hooks?
4. How should the developer track user identity if they need it for rewards?

## Requirements

Your response should:

1. Identify the msg.sender trap in V4 hooks
2. Explain that msg.sender is always the PoolManager in hook callbacks
3. Provide the correct onlyPoolManager verification pattern
4. Explain router allowlisting and hookData approaches for user identity

## Expected Output

A security analysis that identifies the vulnerability and provides correct implementation patterns.
