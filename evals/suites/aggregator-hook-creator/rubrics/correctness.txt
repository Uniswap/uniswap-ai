# Correctness Rubric for Aggregator Hook

Evaluate whether the generated code correctly implements the required functionality.

## Required Elements (Must Include)

Score based on how many of these are correctly implemented:

1. **BaseHook Inheritance**

   - Contract inherits from `BaseHook`
   - Constructor calls parent constructor correctly

2. **getHookPermissions() Implementation**

   - Function is properly implemented
   - Returns correct `Hooks.Permissions` struct
   - `beforeSwap` permission set to `true`
   - `afterSwap` permission set to `true`

3. **External Liquidity Interface**

   - Defines interface or uses existing interface for external liquidity source
   - Interface includes price query method
   - Interface includes swap execution method

4. **Price Comparison Logic**

   - Compares V4 pool price with external source
   - Handles both buy and sell directions
   - Accounts for fees in comparison

5. **Routing Logic**

   - Routes to better price source
   - Handles the routing decision in `beforeSwap` or appropriate hook
   - Returns correct delta values

6. **Event Emission**
   - Defines event for routing decisions
   - Emits event with relevant data (source, amounts, prices)

## Scoring Guide

- 6/6 elements correct: 1.0
- 5/6 elements correct: 0.85
- 4/6 elements correct: 0.7
- 3/6 elements correct: 0.5
- 2/6 elements correct: 0.35
- 1/6 elements correct: 0.15
- 0/6 elements correct: 0.0

## Instructions

Count how many of the required elements are correctly implemented and provide the corresponding score.
