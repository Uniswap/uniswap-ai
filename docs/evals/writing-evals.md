# Writing Evals

Learn how to create comprehensive evaluations for AI skills.

## Eval Case Structure

Each eval case consists of two files:

### 1. Test Case (`cases/*.md`)

The prompt/scenario to test:

```markdown
# Case Name

Description of what to create.

## Context

- Relevant context
- Environment details
- Constraints

## Requirements

1. Specific requirement
2. Another requirement
3. Third requirement
```

### 2. Expected Behaviors (`expected/*.md`)

What the output should include:

```markdown
# Expected Behaviors

## Must Include (Required)

- [ ] Required element 1
- [ ] Required element 2

## Should Include (Expected)

- [ ] Expected element 1
- [ ] Expected element 2

## Must Not Include (Automatic Fail)

- [ ] Security vulnerability
- [ ] Anti-pattern
```

## Creating a New Eval Suite

### Step 1: Create Directory Structure

```bash
mkdir -p evals/suites/my-skill/cases
mkdir -p evals/suites/my-skill/expected
```

### Step 2: Create Configuration

```typescript
// evals/suites/my-skill/eval.config.ts
import type { EvalConfig } from '../../framework/types.js';

export const config: EvalConfig = {
  name: 'my-skill',
  skill: 'my-skill',
  models: ['claude-sonnet-4-5', 'claude-opus-4-6'],
  timeout: 60000,
  retries: 2,
  thresholds: {
    accuracy: 0.8,
    completeness: 0.85,
    safety: 1.0,
  },
};
```

### Step 3: Write Test Cases

Create cases that test different scenarios:

- **Happy path**: Normal usage
- **Edge cases**: Boundary conditions
- **Error cases**: Invalid inputs
- **Complex cases**: Multi-step requirements

### Step 4: Define Expected Behaviors

Be specific about what constitutes success:

- **Must Include**: Required for passing
- **Should Include**: Expected but not required
- **Should Not Include**: Negative indicators
- **Must Not Include**: Automatic failures

## Best Practices

### 1. Test the Edges

```markdown
## Edge Case: Zero Liquidity

Create a hook that handles pools with zero liquidity.

## Requirements

1. Check liquidity before routing
2. Revert gracefully if no liquidity
3. Emit appropriate error event
```

### 2. Be Specific About Security

```markdown
## Must Not Include

- [ ] Unchecked external calls
- [ ] Integer overflow risks
- [ ] Reentrancy vulnerabilities
- [ ] Hardcoded secrets
```

### 3. Version Your Evals

Track changes to evals alongside skill changes to maintain consistency.

### 4. Document Failures

When an eval fails, document why:

```markdown
## Known Issues

- v1.0.0: Fails on pools with < 1e6 liquidity (fixed in v1.1.0)
```

## Example: Complete Eval Case

### Case File

```markdown
# Dynamic Fee Hook

Create a hook that adjusts fees based on volatility.

## Context

- Pool: WETH/USDC
- Chain: Ethereum mainnet
- Volatility source: On-chain oracle

## Requirements

1. Read volatility from oracle
2. Calculate fee based on volatility brackets
3. Apply fee in beforeSwap
4. Track fee revenue
```

### Expected File

```markdown
# Expected Behaviors

## Must Include

- [ ] Implements beforeSwap callback
- [ ] Reads from volatility oracle
- [ ] Applies fee adjustment logic
- [ ] Emits FeeAdjusted event

## Should Include

- [ ] Handles oracle failures gracefully
- [ ] Uses appropriate data types
- [ ] Includes NatSpec documentation

## Must Not Include

- [ ] Hardcoded volatility values
- [ ] Unbounded fee calculations
- [ ] Missing access controls
```
