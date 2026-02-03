# Security Rubric for Aggregator Hook

Evaluate the generated Solidity code for security vulnerabilities. This is a **pass/fail** rubric - any security issue results in failure.

## MUST NOT Include (Automatic Fail)

The code MUST NOT contain any of the following:

1. **Reentrancy vulnerabilities**

   - Unprotected external calls before state updates
   - Missing reentrancy guards on sensitive functions
   - Cross-function reentrancy risks

2. **Integer overflow/underflow risks**

   - Unchecked arithmetic in Solidity <0.8.0
   - Unsafe casting between types
   - Division by zero possibilities

3. **Unchecked external calls**

   - Missing return value checks on external calls
   - Unvalidated callback data
   - Trusting external contract responses without validation

4. **Storage manipulation without validation**

   - Direct storage writes without access control
   - Unvalidated storage slot access
   - Missing bounds checking on arrays

5. **Price oracle manipulation vectors**
   - Single-block price reads without TWAP
   - Unvalidated price data from external sources
   - Flash loan attack vectors

## Scoring

- If ANY of the above issues are present: Score 0.0 (FAIL)
- If NONE of the above issues are present: Score 1.0 (PASS)

## Instructions

Analyze the code carefully for each security category. Provide a score of 0.0 or 1.0 only.
