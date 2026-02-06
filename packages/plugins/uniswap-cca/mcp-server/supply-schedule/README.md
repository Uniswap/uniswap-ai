# CCA Supply Schedule MCP Server

An MCP (Model Context Protocol) server that generates supply schedules for Continuous Clearing Auction (CCA) contracts using a normalized convex curve.

## Overview

This server provides a tool to generate supply schedules for CCA auctions using a moderately convex distribution curve.

**Key Properties:**

- **Equal token distribution**: Each step releases the same token amount
- **Decreasing time intervals**: Block durations decrease over time (convex curve property)
- **Large final block**: ~30% of tokens reserved for final block (configurable 20-40%)
- **Normalized curve**: Based on C(t) = t^α where α ≈ 1.2 (moderately convex)
- **Exact accuracy**: Always sums to exactly 10,000,000 MPS

## Algorithm

The supply schedule generation follows this approach:

### 1. Configuration

Default parameters (all configurable):

- **num_steps**: 12 steps for gradual release
- **final_block_pct**: 30% reserved for final block
- **alpha**: 1.2 (convexity exponent)
- **TOTAL_TARGET**: 10,000,000 MPS

### 2. Equal Token Distribution

Each step releases equal token amounts:

- Main supply: 70% (= 1 - final_block_pct)
- Per step: 5.8333% (= 70% / 12 steps)

### 3. Time Boundaries from Normalized Curve

Calculate time boundaries using C(t) = t^α:

- For step i, cumulative supply = i × step_tokens
- Time boundary: t_i = (i × step_tokens / main_supply)^(1/α)
- Convert to blocks: block_i = round(t_i × auction_blocks)

**Example for 86400 blocks:**

| Step | Normalized Time | Blocks    | Duration | Token % |
| ---- | --------------- | --------- | -------- | ------- |
| 1    | 0.000 → 0.126   | 0 → 10894 | 10894    | 5.83%   |
| 2    | 0.126 → 0.225   | 10894+    | 8517     | 5.83%   |
| 3    | 0.225 → 0.315   | 19411+    | 7803     | 5.83%   |
| ...  | ...             | ...       | ...      | ...     |
| 12   | 0.930 → 1.000   | 80357+    | 6043     | 5.83%   |
| 13   | Final block     | 86399+    | 1        | 29.88%  |

Note: Block durations **DECREASE** (10894 → 8517 → 7803 → ... → 6043), while token amounts remain **EQUAL**.

### 4. Optional Rounding

Round block boundaries to round numbers (e.g., nearest 100):

- Improves readability in deployment scripts
- Preserves overall distribution
- Example: 10894 → 10900, 19411 → 19400

### 5. Final Block Adjustment

The final block receives remaining tokens to ensure exactly TOTAL_TARGET:

- Calculated as: `TOTAL_TARGET - sum(all previous mps × blockDelta)`
- Typically ~30% of total supply

## Mathematical Details

**Why do time intervals decrease?**

The key insight: **equal token amounts + convex supply curve = decreasing time intervals**.

Given:

- Convex curve: C(t) = t^α where α > 1 (e.g., 1.2)
- Equal token amounts per step: Δs = constant

Then:

- Early intervals cover more time: t_1 - t_0 is large
- Later intervals cover less time: t_12 - t_11 is small

This is because the curve accelerates - more tokens released per unit time as t increases.

**Contrast with old implementation:**

- Old: Block durations GREW exponentially (1.2x each step)
- New: Block durations DECREASE following convex curve
- Old: Token amounts varied per step
- New: Token amounts are EQUAL per step

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

The server is automatically configured when you install the `uniswap-builder` plugin. The tool is available as `generate_supply_schedule`.

### Tool: generate_supply_schedule

Generates a CCA supply schedule using a normalized convex curve.

**Parameters:**

- `auction_blocks` (required): Total number of blocks for the auction
  - Example: 86400 for 2 days on Base (2s blocks)
  - Example: 14400 for 1 day on Mainnet (12s blocks)
- `prebid_blocks` (optional): Number of blocks for prebid period with 0 mps
  - Default: 0
- `num_steps` (optional): Number of steps for gradual release
  - Default: 12
- `final_block_pct` (optional): Percentage of supply for final block (as decimal)
  - Default: 0.30 (30%)
  - Recommended range: 0.20 to 0.40 (20-40%)
- `alpha` (optional): Convexity exponent for curve C(t) = t^alpha
  - Default: 1.2 (moderately convex)
  - Range: 1.0 (linear) to 2.0 (highly convex)
- `round_to_nearest` (optional): Round block boundaries to nearest N blocks
  - Default: None (no rounding)
  - Example: 100 (round to nearest 100 blocks)

**Returns:**

JSON object with:

- `schedule`: Array of {mps, blockDelta} objects
- `auction_blocks`: Input auction blocks
- `prebid_blocks`: Input prebid blocks
- `total_phases`: Number of phases in the schedule
- `summary`: Summary statistics including:
  - `total_mps`: Actual total (always 10,000,000)
  - `target_mps`: Target total (10,000,000)
  - `final_block_mps`: Tokens in final block
  - `final_block_percentage`: Percentage in final block
  - `num_steps`: Number of steps used
  - `alpha`: Convexity exponent used
  - `main_supply_pct`: Percentage distributed gradually (e.g., 70%)
  - `step_tokens_pct`: Percentage per step (e.g., 5.8333%)

**Example Output (Default Parameters):**

```json
{
  "schedule": [
    { "mps": 54, "blockDelta": 10894 },
    { "mps": 68, "blockDelta": 8517 },
    { "mps": 75, "blockDelta": 7803 },
    { "mps": 79, "blockDelta": 7373 },
    { "mps": 83, "blockDelta": 7068 },
    { "mps": 85, "blockDelta": 6835 },
    { "mps": 88, "blockDelta": 6647 },
    { "mps": 90, "blockDelta": 6490 },
    { "mps": 92, "blockDelta": 6356 },
    { "mps": 94, "blockDelta": 6238 },
    { "mps": 95, "blockDelta": 6136 },
    { "mps": 97, "blockDelta": 6043 },
    { "mps": 2988006, "blockDelta": 1 }
  ],
  "auction_blocks": 86400,
  "prebid_blocks": 0,
  "total_phases": 13,
  "summary": {
    "total_mps": 10000000,
    "target_mps": 10000000,
    "final_block_mps": 2988006,
    "final_block_percentage": 29.88,
    "num_steps": 12,
    "alpha": 1.2,
    "main_supply_pct": 70.0,
    "step_tokens_pct": 5.8333
  }
}
```

**Example with Rounding:**

```json
{
  "auction_blocks": 86400,
  "round_to_nearest": 100,
  "schedule": [
    { "mps": 53, "blockDelta": 10900 },
    { "mps": 68, "blockDelta": 8500 },
    { "mps": 75, "blockDelta": 7800 }
    // ... rounded block boundaries
  ]
}
```

## Properties

### Decreasing Block Durations

Block durations decrease over time (convex curve property):

| Step | Blocks | Ratio from Previous |
| ---- | ------ | ------------------- |
| 1    | 10,894 | -                   |
| 2    | 8,517  | 0.78x               |
| 3    | 7,803  | 0.92x               |
| 4    | 7,373  | 0.94x               |
| 5    | 7,068  | 0.96x               |
| ...  | ...    | ...                 |
| 12   | 6,043  | 0.98x               |

### Equal Token Distribution

Each step releases approximately equal token amounts:

| Step | MPS | Token % | Cumulative % |
| ---- | --- | ------- | ------------ |
| 1    | 54  | 5.88%   | 5.88%        |
| 2    | 68  | 5.79%   | 11.67%       |
| 3    | 75  | 5.85%   | 17.52%       |
| ...  | ... | ...     | ...          |
| 12   | 97  | 5.86%   | 70.12%       |
| 13   | 3M+ | 29.88%  | 100%         |

## MPS Units

MPS = Milli-Basis Points = 1e7 (10 million)

Each MPS represents one thousandth of a basis point. The target total is always 10,000,000 MPS (1e7).

## Running Standalone

For testing, you can run the server directly:

```bash
python server.py
```

Or run the comprehensive test suite:

```bash
python test_logic.py
```

The test suite includes:

- Basic schedule generation
- Validation against canonical sample schedule
- Rounding behavior
- Prebid period handling
- Different auction durations
- Custom parameters

## Configuration

The normalized curve parameters are configurable via function arguments:

- `num_steps`: Number of steps (default: 12)
- `final_block_pct`: Final block percentage (default: 0.30)
- `alpha`: Convexity exponent (default: 1.2)
- `TOTAL_TARGET`: Target MPS (constant: 10,000,000)

## Design Rationale

A well-designed supply schedule achieves three goals:

1. **Creates meaningful incentives to participate early**
2. **Keeps the auction attractive for late arrivals**
3. **Anchors a robust final clearing price**

This is achieved with a **moderately convex supply curve** that releases supply gradually, combined with a **large final block** of tokens.

**Why equal token amounts per step?**

- Simplifies reasoning about incentives
- Each step has the same "value" to bidders
- Reduces complexity in auction analysis

**Why decreasing time intervals?**

- Natural consequence of convex curve + equal tokens
- Early bidders face longer intervals (more time to accumulate bids)
- Later intervals compress as supply rate accelerates

**Why large final block (20-40%)?**

- **Robust price discovery**: Final price reflects broad demand
- **Anti-manipulation**: Large capital required to move final price
- **Sustained participation**: Meaningful supply remains for late bidders

## License

MIT
