# v4 Hook Pre-Deployment Audit Checklist

Comprehensive checklist for auditing Uniswap v4 hooks before deployment.

## 1. Access Control

### 1.1 PoolManager Verification

- [ ] All hook callbacks verify `msg.sender == address(poolManager)`
- [ ] Verification uses modifier or explicit check at function start
- [ ] No code paths bypass the verification

### 1.2 Router Authorization

- [ ] Router allowlisting implemented if hook restricts callers
- [ ] Allowlist modifications are admin-protected
- [ ] Cannot add zero address to allowlist

### 1.3 Admin Functions

- [ ] Admin role transfer is two-step (propose/accept) or timelock-protected
- [ ] Critical admin functions have event emissions
- [ ] Admin cannot brick the contract (e.g., renounce without safeguards)

## 2. Delta Accounting

### 2.1 Balance Invariants

- [ ] All returned deltas are backed by actual token movements
- [ ] `take()` calls match returned delta values
- [ ] `settle()` calls properly account for received tokens
- [ ] Invariant: `sum(all deltas) == 0` for every transaction

### 2.2 Token Handling

- [ ] Fee-on-transfer tokens handled (measure actual received amounts)
- [ ] Rebasing tokens handled or explicitly blocked
- [ ] ERC-777 reentrancy considered
- [ ] Token decimals not assumed (queried from token)

### 2.3 Settlement Flow

- [ ] Correct order: `sync()` -> `transfer()` -> `settle()`
- [ ] No partial settlements left hanging
- [ ] Error handling doesn't leave accounting in bad state

## 3. Permissions Review

### 3.1 Enabled Permissions Audit

For each enabled permission, document:

| Permission                      | Enabled | Justification | Risk Level |
| ------------------------------- | ------- | ------------- | ---------- |
| beforeInitialize                | [ ]     |               |            |
| afterInitialize                 | [ ]     |               |            |
| beforeAddLiquidity              | [ ]     |               |            |
| afterAddLiquidity               | [ ]     |               |            |
| beforeRemoveLiquidity           | [ ]     |               |            |
| afterRemoveLiquidity            | [ ]     |               |            |
| beforeSwap                      | [ ]     |               |            |
| afterSwap                       | [ ]     |               |            |
| beforeDonate                    | [ ]     |               |            |
| afterDonate                     | [ ]     |               |            |
| beforeSwapReturnDelta           | [ ]     |               |            |
| afterSwapReturnDelta            | [ ]     |               |            |
| afterAddLiquidityReturnDelta    | [ ]     |               |            |
| afterRemoveLiquidityReturnDelta | [ ]     |               |            |

### 3.2 Delta Return Permissions (Critical Review)

If any delta return permission is enabled:

- [ ] NoOp attack vector analyzed and mitigated
- [ ] All code paths returning non-zero deltas reviewed
- [ ] Deltas are always backed by liquidity provision
- [ ] Multiple independent reviewers have verified

## 4. Reentrancy Protection

### 4.1 External Calls

- [ ] All external calls identified and documented
- [ ] Reentrancy guards applied where needed
- [ ] State changes follow checks-effects-interactions pattern
- [ ] No callbacks to untrusted contracts

### 4.2 Token Callbacks

- [ ] ERC-777 `tokensReceived` hook considered
- [ ] ERC-721/1155 callbacks considered if applicable
- [ ] Flash loan callbacks considered

## 5. Gas and DoS

### 5.1 Loop Bounds

- [ ] All loops have maximum iteration limits
- [ ] Limits are appropriate for block gas limit
- [ ] User-controllable arrays bounded

### 5.2 Gas Estimation

- [ ] Gas usage tested for worst-case scenarios
- [ ] No operations that could exceed block gas limit
- [ ] External call gas limits are reasonable

### 5.3 DoS Vectors

- [ ] No unbounded array iterations
- [ ] No unbounded mapping iterations
- [ ] Failed external calls don't block hook functionality
- [ ] Griefing attacks considered

## 6. Input Validation

### 6.1 Parameter Validation

- [ ] All external inputs validated
- [ ] hookData properly decoded and validated
- [ ] No assumptions about parameter ranges
- [ ] Overflow/underflow protection (Solidity 0.8.x or SafeMath)

### 6.2 Pool Key Validation

- [ ] Hook is authorized for the pool
- [ ] Currency addresses validated
- [ ] Fee tier validated if relevant

## 7. State Management

### 7.1 Storage

- [ ] No sensitive data stored on-chain
- [ ] Storage slots don't collide (if using assembly)
- [ ] Transient storage used appropriately
- [ ] Storage variables initialized correctly

### 7.2 State Transitions

- [ ] All state transitions have valid preconditions
- [ ] No invalid intermediate states possible
- [ ] State can be recovered from errors

## 8. Upgrade Safety (if applicable)

### 8.1 Proxy Patterns

- [ ] Upgrade mechanism is access-controlled
- [ ] Timelock or governance required for upgrades
- [ ] Storage layout documented
- [ ] Upgrade path tested

### 8.2 Migration Safety

- [ ] Old state can be migrated to new implementation
- [ ] No loss of funds during migration
- [ ] Rollback plan exists

## 9. Testing Requirements

### 9.1 Unit Tests

- [ ] Every public/external function tested
- [ ] Every require/revert condition tested
- [ ] Edge cases tested (zero amounts, max values, etc.)
- [ ] All code paths covered

### 9.2 Fuzz Testing

- [ ] Foundry fuzz tests for all state-changing functions
- [ ] Minimum 10,000 fuzz runs
- [ ] Custom fuzz invariants defined
- [ ] No failures in extended fuzzing

### 9.3 Invariant Testing

- [ ] Core invariants defined and tested
- [ ] Delta accounting invariants tested
- [ ] Balance invariants tested
- [ ] Access control invariants tested

### 9.4 Integration Testing

- [ ] Fork tests against mainnet state
- [ ] Tests with real pool addresses
- [ ] Tests with various token types
- [ ] End-to-end swap flow tested

## 10. Static Analysis

### 10.1 Automated Tools

- [ ] Slither analysis completed (all findings addressed)
- [ ] Mythril analysis completed
- [ ] Solhint linting passed
- [ ] Custom detectors for v4-specific issues

### 10.2 Manual Review

- [ ] Line-by-line code review completed
- [ ] Business logic reviewed against specification
- [ ] Comparison with similar audited hooks

## 11. Documentation

### 11.1 Code Documentation

- [ ] NatSpec comments for all public functions
- [ ] Complex logic explained in comments
- [ ] Assumptions documented

### 11.2 External Documentation

- [ ] Architecture diagram
- [ ] Threat model document
- [ ] Deployment procedure
- [ ] Emergency procedures

## 12. Deployment Preparation

### 12.1 Pre-Deployment

- [ ] Hook address mined with correct permission bits
- [ ] Constructor parameters verified
- [ ] Deployment script reviewed and tested
- [ ] Gas estimation for deployment

### 12.2 Post-Deployment

- [ ] Verify source code on block explorer
- [ ] Verify permissions match expected
- [ ] Test transaction on mainnet
- [ ] Monitoring and alerting configured

## Audit Sign-Off

| Role              | Name | Date | Signature |
| ----------------- | ---- | ---- | --------- |
| Lead Auditor      |      |      |           |
| Security Reviewer |      |      |           |
| Code Owner        |      |      |           |

## Risk Assessment Summary

| Category         | Risk Level | Notes |
| ---------------- | ---------- | ----- |
| Access Control   |            |       |
| Delta Accounting |            |       |
| Reentrancy       |            |       |
| DoS              |            |       |
| Upgrade Safety   |            |       |
| **Overall**      |            |       |

## Findings Log

| ID  | Severity | Description | Status | Resolution |
| --- | -------- | ----------- | ------ | ---------- |
|     |          |             |        |            |
|     |          |             |        |            |
|     |          |             |        |            |

---

## Audit Tier Guidelines

Based on risk assessment, determine required audit level:

### Tier 1: Self-Audit (Risk Score 0-5)

- Internal code review
- Full test coverage
- Static analysis tools

### Tier 2: Peer Audit (Risk Score 6-12)

- Tier 1 requirements
- External developer review
- Extended fuzz testing

### Tier 3: Professional Audit (Risk Score 13-20)

- Tier 2 requirements
- Audit by security firm
- Bug bounty program

### Tier 4: Multi-Audit (Risk Score 21+)

- Tier 3 requirements
- Multiple independent audits
- Formal verification considered
- Extended bug bounty with significant rewards
