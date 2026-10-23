# Aggregator Hook Creator Eval Suite

Evaluation suite for the `aggregator-hook-creator` skill, which covers Uniswap v4 aggregator hooks:
hooks whose pools execute swaps on an external venue.

## Overview

The cases check the skill against Uniswap's public aggregator-hook code (`v4-hooks-public`), not
against the earlier design that compared prices on-chain and used arbitrary-call `hookData`.

| Case                                | Description                                                     | Key Assertions                                                  |
| ----------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `implement-base-aggregator-hook.md` | Skeleton hook in the `BaseAggregatorHook` style                 | Overrides `_conductSwap` and `_rawQuote`; no after-swap hook    |
| `integrator-quote.md`               | Router prices a swap and tracks depth                           | `quote`, `pseudoTotalValueLocked`, static call, router slippage |
| `min-dy-zero-security.md`           | Why `min_dy = 0` is acceptable only with router slippage checks | Router enforces limits; no TWAP in the hook                     |
| `callback-validation-security.md`   | Protecting a V3-style swap callback                             | Sender checks, active-swap check, reentrancy guard              |
| `paths-and-disclosures.md`          | Corrects false assumptions about recommendations and audits     | No audit, AGPL `ProtocolFees`, TokenJar fee                     |

## Architecture

`prompt-wrapper.txt` injects `SKILL.md` plus three reference files (`base-aggregator-hook.md`,
`integrator-guide.md`, `implementations.md`) so cases can be answered from the skill's own content.
Each case overrides `case_content`.

## Rubrics

All rubrics use the `.txt` extension required by Promptfoo's grader. No rubric rewards the after-swap
permission, on-chain price comparison, arbitrary-call `hookData`, or hook-side TWAP or minimum-output
checks, and none rewards claiming Uniswap recommends subclassing `BaseAggregatorHook`.

| Rubric                    | Threshold | Purpose                                              |
| ------------------------- | --------- | ---------------------------------------------------- |
| `implementation.txt`      | 0.8       | Hook follows the `BaseAggregatorHook` pattern        |
| `integrator.txt`          | 0.8       | Quoting and routing guidance for integrators         |
| `security.txt`            | 0.8       | Slippage and callback reasoning matches the source   |
| `honesty-disclosures.txt` | 0.8       | Corrects false premises, states required disclosures |

## Running

```bash
nx run eval-suite-aggregator-hook-creator:eval
nx run eval-suite-aggregator-hook-creator:eval --skip-nx-cache
nx run evals:eval:view
```
