---
name: v4-security-foundations
description: Security-first Uniswap v4 hook development. Use when user mentions "v4 hooks", "hook security", "PoolManager", "beforeSwap", "afterSwap", or asks about V4 hook best practices, vulnerabilities, or audit requirements.
allowed-tools: Read, Glob, Grep, WebFetch, Task(subagent_type:Explore)
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.1.0'
---

# v4 Hook Security Foundations

Security-first guide for building Uniswap v4 hooks. Hook vulnerabilities can drain user funds—understand these concepts before writing any hook code.

## Threat Model

Before writing code, understand the v4 security context:

| Threat Area             | Description                                                | Mitigation                                     |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| **Caller Verification** | Only `PoolManager` should invoke hook functions            | Verify `msg.sender == address(poolManager)`    |
| **Sender Identity**     | `msg.sender` always equals PoolManager, never the end user | Use `sender` parameter for user identity       |
| **Router Context**      | The `sender` parameter identifies the router, not the user | Implement router allowlisting                  |
| **State Exposure**      | Hook state is readable during mid-transaction execution    | Avoid storing sensitive data on-chain          |
| **Reentrancy Surface**  | External calls from hooks can enable reentrancy            | Use reentrancy guards; minimize external calls |

## Permission Flags Risk Matrix

All 14 hook permissions with associated risk levels:

| Permission Flag                   | Risk Level | Description                 | Security Notes                |
| --------------------------------- | ---------- | --------------------------- | ----------------------------- |
| `beforeInitialize`                | LOW        | Called before pool creation | Validate pool parameters      |
| `afterInitialize`                 | LOW        | Called after pool creation  | Safe for state initialization |
| `beforeAddLiquidity`              | MEDIUM     | Before LP deposits          | Can block legitimate LPs      |
| `afterAddLiquidity`               | LOW        | After LP deposits           | Safe for tracking/rewards     |
| `beforeRemoveLiquidity`           | HIGH       | Before LP withdrawals       | Can trap user funds           |
| `afterRemoveLiquidity`            | LOW        | After LP withdrawals        | Safe for tracking             |
| `beforeSwap`                      | HIGH       | Before swap execution       | Can manipulate prices         |
| `afterSwap`                       | MEDIUM     | After swap execution        | Can observe final state       |
| `beforeDonate`                    | LOW        | Before donations            | Access control only           |
| `afterDonate`                     | LOW        | After donations             | Safe for tracking             |
| `beforeSwapReturnDelta`           | CRITICAL   | Returns custom swap amounts | **NoOp attack vector**        |
| `afterSwapReturnDelta`            | HIGH       | Modifies post-swap amounts  | Can extract value             |
| `afterAddLiquidityReturnDelta`    | HIGH       | Modifies LP token amounts   | Can shortchange LPs           |
| `afterRemoveLiquidityReturnDelta` | HIGH       | Modifies withdrawal amounts | Can steal funds               |

### Risk Thresholds

- **LOW**: Unlikely to cause fund loss
- **MEDIUM**: Requires careful implementation
- **HIGH**: Can cause fund loss if misimplemented
- **CRITICAL**: Can enable complete fund theft

## CRITICAL: NoOp Rug Pull Attack

The `BEFORE_SWAP_RETURNS_DELTA` permission (bit 10) is the most dangerous hook permission. A malicious hook can:

1. Return a delta claiming it handled the entire swap
2. PoolManager accepts this and settles the trade
3. Hook keeps all input tokens without providing output
4. User loses entire swap amount

### Attack Pattern

```solidity
// MALICIOUS - DO NOT USE
function beforeSwap(
    address,
    PoolKey calldata,
    IPoolManager.SwapParams calldata params,
    bytes calldata
) external override returns (bytes4, BeforeSwapDelta, uint24) {
    // Claim to handle the swap but steal tokens
    int128 amountSpecified = int128(params.amountSpecified);
    BeforeSwapDelta delta = toBeforeSwapDelta(amountSpecified, 0);
    return (BaseHook.beforeSwap.selector, delta, 0);
}
```

### Detection

Before interacting with ANY hook that has `beforeSwapReturnDelta: true`:

1. **Audit the hook code** - Verify legitimate use case
2. **Check ownership** - Is it upgradeable? By whom?
3. **Verify track record** - Has it been audited by reputable firms?
4. **Start small** - Test with minimal amounts first

### Legitimate Uses

NoOp patterns are valid for:

- Just-in-time liquidity (JIT)
- Custom AMM curves
- Intent-based trading systems
- RFQ/PMM integrations

But each requires careful implementation and audit.

## Delta Accounting Fundamentals

v4 uses a credit/debit system through the PoolManager:

### Core Invariant

```text
For every transaction: sum(deltas) == 0
```

The PoolManager tracks what each address owes or is owed. At transaction end, all debts must be settled.

### Key Functions

| Function                     | Purpose                             | Direction              |
| ---------------------------- | ----------------------------------- | ---------------------- |
| `take(currency, to, amount)` | Withdraw tokens from PoolManager    | You receive tokens     |
| `settle(currency)`           | Pay tokens to PoolManager           | You send tokens        |
| `sync(currency)`             | Update PoolManager balance tracking | Preparation for settle |

### Settlement Pattern

```solidity
// Correct pattern: sync before settle
poolManager.sync(currency);
currency.transfer(address(poolManager), amount);
poolManager.settle(currency);
```

### Common Mistakes

1. **Forgetting sync**: Settlement fails without sync
2. **Wrong order**: Must sync → transfer → settle
3. **Partial settlement**: Leaves transaction in invalid state
4. **Double settlement**: Causes accounting errors

## Access Control Patterns

### PoolManager Verification

Every hook callback MUST verify the caller:

```solidity
modifier onlyPoolManager() {
    require(msg.sender == address(poolManager), "Not PoolManager");
    _;
}

function beforeSwap(
    address sender,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    bytes calldata hookData
) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
    // Safe to proceed
}
```

### Why This Matters

Without this check:

- Anyone can call hook functions directly
- Attackers can manipulate hook state
- Funds can be drained through fake callbacks

## Router Verification Patterns

The `sender` parameter is the router, not the end user. For hooks that need user identity:

### Allowlisting Pattern

```solidity
mapping(address => bool) public allowedRouters;

function beforeSwap(
    address sender,  // This is the router
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    bytes calldata hookData
) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
    require(allowedRouters[sender], "Router not allowed");
    // Proceed with swap
}
```

### User Identity via hookData

```solidity
function beforeSwap(
    address sender,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    bytes calldata hookData
) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
    // Decode user address from hookData (router must include it)
    address user = abi.decode(hookData, (address));
    // CAUTION: Router must be trusted to provide accurate user
}
```

### msg.sender Trap

```solidity
// WRONG - msg.sender is always PoolManager in hooks
function beforeSwap(...) external {
    require(msg.sender == someUser); // Always fails or wrong
}

// CORRECT - Use sender parameter
function beforeSwap(address sender, ...) external {
    require(allowedRouters[sender], "Invalid router");
}
```

## Token Handling Hazards

Not all tokens behave like standard ERC-20s:

| Token Type          | Hazard                               | Mitigation                          |
| ------------------- | ------------------------------------ | ----------------------------------- |
| **Fee-on-transfer** | Received amount < sent amount        | Measure actual balance changes      |
| **Rebasing**        | Balance changes without transfers    | Avoid storing raw balances          |
| **ERC-777**         | Transfer callbacks enable reentrancy | Use reentrancy guards               |
| **Pausable**        | Transfers can be blocked             | Handle transfer failures gracefully |
| **Blocklist**       | Specific addresses blocked           | Test with production addresses      |
| **Low decimals**    | Precision loss in calculations       | Use appropriate scaling             |

### Safe Balance Check Pattern

```solidity
function safeTransferIn(
    IERC20 token,
    address from,
    uint256 amount
) internal returns (uint256 received) {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.safeTransferFrom(from, address(this), amount);
    received = token.balanceOf(address(this)) - balanceBefore;
}
```

## Base Hook Template

Start with all permissions disabled. Enable only what you need:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/base/hooks/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";

contract SecureHook is BaseHook {
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,           // Enable only if needed
            afterSwap: false,            // Enable only if needed
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,      // DANGER: NoOp attack vector
            afterSwapReturnDelta: false,       // DANGER: Can extract value
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // Implement only the callbacks you enabled above
}
```

See [references/base-hook-template.md](references/base-hook-template.md) for a complete implementation template.

## Security Checklist

Before deploying any hook:

| #   | Check                                                 | Status |
| --- | ----------------------------------------------------- | ------ |
| 1   | All hook callbacks verify `msg.sender == poolManager` | [ ]    |
| 2   | Router allowlisting implemented if needed             | [ ]    |
| 3   | No unbounded loops that can cause OOG                 | [ ]    |
| 4   | Reentrancy guards on external calls                   | [ ]    |
| 5   | Delta accounting sums to zero                         | [ ]    |
| 6   | Fee-on-transfer tokens handled                        | [ ]    |
| 7   | No hardcoded addresses                                | [ ]    |
| 8   | Slippage parameters respected                         | [ ]    |
| 9   | No sensitive data stored on-chain                     | [ ]    |
| 10  | Upgrade mechanisms secured (if applicable)            | [ ]    |
| 11  | `beforeSwapReturnDelta` justified if enabled          | [ ]    |
| 12  | Fuzz testing completed                                | [ ]    |
| 13  | Invariant testing completed                           | [ ]    |

## Gas Budget Guidelines

Hook callbacks execute inside the PoolManager's transaction context. Excessive gas consumption can make swaps revert or become economically unviable.

### Gas Budgets by Callback

| Callback                      | Target Budget | Hard Ceiling | Notes                         |
| ----------------------------- | ------------- | ------------ | ----------------------------- |
| `beforeSwap`                  | < 50,000 gas  | 150,000 gas  | Runs on every swap; keep lean |
| `afterSwap`                   | < 30,000 gas  | 100,000 gas  | Analytics/tracking only       |
| `beforeAddLiquidity`          | < 50,000 gas  | 200,000 gas  | May include access control    |
| `afterAddLiquidity`           | < 30,000 gas  | 100,000 gas  | Reward tracking               |
| `beforeRemoveLiquidity`       | < 50,000 gas  | 200,000 gas  | Lock validation               |
| `afterRemoveLiquidity`        | < 30,000 gas  | 100,000 gas  | Tracking/accounting           |
| Callbacks with external calls | < 100,000 gas | 300,000 gas  | External DEX routing, oracles |

### Common Gas Pitfalls

1. **Unbounded loops**: Iterating over dynamic arrays (e.g., all active positions) can exceed block gas limits. Cap array sizes or use pagination.
2. **SSTORE in hot paths**: Each new storage slot costs ~20,000 gas. Prefer transient storage (`tstore`/`tload`) for data that doesn't persist beyond the transaction. Requires Solidity >= 0.8.24 with EVM target set to `cancun` or later.
3. **External calls**: Each cross-contract call adds ~2,600 gas base cost plus the callee's execution. Batch calls where possible.
4. **String operations**: Avoid `string` manipulation in callbacks; use `bytes32` for identifiers.
5. **Redundant reads**: Cache `poolManager` calls — repeated `getSlot0()` or `getLiquidity()` reads cost gas each time.

### Measuring Gas

```bash
# Profile a specific hook callback with Foundry
forge test --match-test test_beforeSwapGas --gas-report

# Snapshot gas usage across all tests
forge snapshot --match-contract MyHookTest
```

---

## Risk Scoring System

Calculate your hook's risk score (0-33):

| Category              | Points | Criteria                                 |
| --------------------- | ------ | ---------------------------------------- |
| **Permissions**       | 0-14   | Sum of enabled permission risk levels    |
| **External Calls**    | 0-5    | Number and type of external interactions |
| **State Complexity**  | 0-5    | Amount of mutable state                  |
| **Upgrade Mechanism** | 0-5    | Proxy, admin functions, etc.             |
| **Token Handling**    | 0-4    | Non-standard token support               |

### Audit Tier Recommendations

| Score | Risk Level | Recommendation                 |
| ----- | ---------- | ------------------------------ |
| 0-5   | Low        | Self-audit + peer review       |
| 6-12  | Medium     | Professional audit recommended |
| 13-20 | High       | Professional audit required    |
| 21-33 | Critical   | Multiple audits required       |

## Absolute Prohibitions

**Never do these things in a hook:**

1. **Never trust `msg.sender` for user identity** - It's always PoolManager
2. **Never enable `beforeSwapReturnDelta` without understanding NoOp attacks**
3. **Never store passwords, keys, or PII on-chain**
4. **Never use `transfer()` for ETH** - Use `call{value:}("")`
5. **Never assume token decimals** - Always query the token
6. **Never use `block.timestamp` for randomness**
7. **Never hardcode gas limits in calls**
8. **Never ignore return values from external calls**
9. **Never use `tx.origin` for authorization** - It's a phishing vector; malicious contracts can relay calls with the original user's `tx.origin`

## Pre-Deployment Audit Checklist

| #   | Item                                      | Required For             |
| --- | ----------------------------------------- | ------------------------ |
| 1   | Code review by security-focused developer | All hooks                |
| 2   | Unit tests for all callbacks              | All hooks                |
| 3   | Fuzz testing with Foundry                 | All hooks                |
| 4   | Invariant testing                         | Hooks with delta returns |
| 5   | Fork testing on mainnet                   | All hooks                |
| 6   | Gas profiling                             | All hooks                |
| 7   | Formal verification                       | Critical hooks           |
| 8   | Slither/Mythril analysis                  | All hooks                |
| 9   | External audit                            | Medium+ risk hooks       |
| 10  | Bug bounty program                        | High+ risk hooks         |
| 11  | Monitoring/alerting setup                 | All production hooks     |

See [references/audit-checklist.md](references/audit-checklist.md) for detailed audit requirements.

## Production Hook References

Learn from audited, production hooks:

| Project        | Description           | Notable Security Features     |
| -------------- | --------------------- | ----------------------------- |
| **Flaunch**    | Token launch platform | Multi-sig admin, timelocks    |
| **EulerSwap**  | Lending integration   | Isolated risk per market      |
| **Zaha TWAMM** | Time-weighted AMM     | Gradual execution reduces MEV |
| **Bunni**      | LP management         | Concentrated liquidity guards |

## External Resources

### Official Documentation

- [v4-core Repository](https://github.com/Uniswap/v4-core)
- [v4-periphery Repository](https://github.com/Uniswap/v4-periphery)
- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [Hook Permissions Guide](https://docs.uniswap.org/contracts/v4/concepts/hooks)

### Security Resources

- [Trail of Bits Audits](https://github.com/trailofbits/publications)
- [Certora v4 Analysis](https://www.certora.com/)
- [ABDK Consulting](https://abdk.consulting/)

### Community

- [v4-hooks-skill by @igoryuzo](https://github.com/igoryuzo/uniswapV4-hooks-skill) - Community skill that inspired this guide
- [v4hooks.dev](https://www.v4hooks.dev) - Community hook resources

---

## Additional References

- [Base Hook Template](references/base-hook-template.md) - Complete implementation starter
- [Vulnerabilities Catalog](references/vulnerabilities-catalog.md) - Common patterns and mitigations
- [Audit Checklist](references/audit-checklist.md) - Detailed pre-deployment checklist
