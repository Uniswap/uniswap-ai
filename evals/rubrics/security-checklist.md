# Universal Security Checklist for Solidity/Smart Contract Code

This rubric evaluates generated smart contract code for security vulnerabilities.
Use this for any skill that generates Solidity or blockchain-related code.

## Critical Vulnerabilities (Automatic Fail)

The code MUST NOT contain any of the following:

### 1. Reentrancy Vulnerabilities

- [ ] External calls made before state updates (Checks-Effects-Interactions pattern violated)
- [ ] Missing reentrancy guards on state-changing functions
- [ ] Cross-function reentrancy possibilities
- [ ] Read-only reentrancy vectors

### 2. Access Control Issues

- [ ] Missing `onlyOwner` or role-based access on privileged functions
- [ ] Unprotected initialization functions
- [ ] Missing zero-address checks on critical parameters
- [ ] Privilege escalation vectors

### 3. Integer Safety

- [ ] Unchecked arithmetic in Solidity <0.8.0 without SafeMath
- [ ] Unsafe downcasting (e.g., uint256 to uint128)
- [ ] Division by zero possibilities
- [ ] Multiplication overflow before division

### 4. External Call Safety

- [ ] Missing return value checks on external calls
- [ ] Unbounded external calls in loops
- [ ] Unchecked low-level calls (call, delegatecall, staticcall)
- [ ] Missing gas limits on external calls

### 5. Oracle/Price Manipulation

- [ ] Single-block price reads (flash loan vulnerable)
- [ ] Missing TWAP or time-weighted checks
- [ ] Unvalidated external price data
- [ ] Missing staleness checks on oracle data

### 6. Front-running Vulnerabilities

- [ ] Predictable outcomes based on pending transactions
- [ ] Missing commit-reveal schemes where needed
- [ ] Sandwich attack vectors
- [ ] MEV extraction opportunities

### 7. Storage Safety

- [ ] Uninitialized storage pointers
- [ ] Storage collision in upgradeable contracts
- [ ] Missing storage gap in base contracts
- [ ] Direct storage manipulation without validation

### 8. Token Safety

- [ ] Missing approval race condition handling
- [ ] Assuming tokens return true (ERC20 non-compliance)
- [ ] Missing hooks for tokens with callbacks (ERC777, ERC1155)
- [ ] Not accounting for fee-on-transfer tokens

## Scoring

- **Any critical vulnerability found**: Score 0.0 (FAIL)
- **No critical vulnerabilities found**: Score 1.0 (PASS)

## Instructions

Carefully analyze the code for each category above. If ANY issue from ANY category is present, the score must be 0.0. Only if the code passes all checks should the score be 1.0.

This is a binary rubric - there is no partial credit for security.
