---
title: V4 Security Foundations
order: 3
---

# V4 Security Foundations

Security-first guide for building Uniswap V4 hooks. Hook vulnerabilities can drain user funds -- understand these concepts before writing any hook code.

## Invocation

```text
/v4-security-foundations
```

Or describe your requirements naturally:

```text
Review the security of my V4 hook before deployment
```

## What It Does

This skill helps you:

- **Understand the V4 threat model**: Caller verification, sender identity, router context, state exposure, and reentrancy surfaces
- **Assess permission risk**: All 14 hook permissions mapped to risk levels from LOW to CRITICAL
- **Prevent NoOp rug pull attacks**: Detect and avoid the most dangerous hook vulnerability (`beforeSwapReturnDelta`)
- **Implement access control**: PoolManager verification, router allowlisting, and user identity patterns
- **Audit before deployment**: Pre-deployment checklist with risk scoring and audit tier recommendations

## Threat Model

| Threat Area             | Description                                                     | Mitigation                                     |
| ----------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| **Caller Verification** | Only `PoolManager` should invoke hook functions                 | Verify `msg.sender == address(poolManager)`    |
| **Sender Identity**     | `msg.sender` always equals PoolManager, never the end user      | Use `sender` parameter for user identity       |
| **Router Context**      | The `sender` parameter identifies the router, not the user      | Implement router allowlisting                  |
| **State Exposure**      | Hook state is readable during mid-transaction execution         | Avoid storing sensitive data on-chain          |
| **Reentrancy Surface**  | External calls from hooks can enable reentrancy                 | Use reentrancy guards; minimize external calls |
| **tx.origin Phishing**  | `tx.origin` exposes the original signer, enabling relay attacks | Never use `tx.origin` for authorization        |

## Permission Flags Risk Matrix

| Permission Flag                   | Risk Level | Security Notes                |
| --------------------------------- | ---------- | ----------------------------- |
| `beforeInitialize`                | LOW        | Validate pool parameters      |
| `afterInitialize`                 | LOW        | Safe for state initialization |
| `beforeAddLiquidity`              | MEDIUM     | Can block legitimate LPs      |
| `afterAddLiquidity`               | LOW        | Safe for tracking/rewards     |
| `beforeRemoveLiquidity`           | HIGH       | Can trap user funds           |
| `afterRemoveLiquidity`            | LOW        | Safe for tracking             |
| `beforeSwap`                      | HIGH       | Can manipulate prices         |
| `afterSwap`                       | MEDIUM     | Can observe final state       |
| `beforeDonate`                    | LOW        | Access control only           |
| `afterDonate`                     | LOW        | Safe for tracking             |
| `beforeSwapReturnDelta`           | CRITICAL   | NoOp attack vector            |
| `afterSwapReturnDelta`            | HIGH       | Can extract value             |
| `afterAddLiquidityReturnDelta`    | HIGH       | Can shortchange LPs           |
| `afterRemoveLiquidityReturnDelta` | HIGH       | Can steal funds               |

## Key Topics Covered

- **NoOp rug pull attacks**: How `BEFORE_SWAP_RETURNS_DELTA` can be exploited, detection methods, and legitimate use cases (JIT liquidity, custom AMM curves, intent-based trading)
- **Delta accounting**: The credit/debit system, settlement patterns, and common mistakes
- **Access control patterns**: PoolManager verification, router allowlisting, and the `msg.sender` trap
- **Token handling hazards**: Fee-on-transfer, rebasing, ERC-777, pausable, and low-decimal tokens
- **Security checklist**: 13-point pre-deployment checklist covering all critical areas
- **Risk scoring**: Calculate your hook's risk score (0-33) with audit tier recommendations

## Related Resources

- [Uniswap Hooks Plugin](/plugins/uniswap-hooks) - Parent plugin
- [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/overview) - Official documentation
- [v4-core Repository](https://github.com/Uniswap/v4-core) - Source code
- [Hook Permissions Guide](https://docs.uniswap.org/contracts/v4/concepts/hooks) - Permission reference
