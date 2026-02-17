---
name: configurator
description: Configure CCA (Continuous Clearing Auction) smart contract parameters through an interactive bulk form flow. Use when user says "configure auction", "cca auction", "setup token auction", "auction configuration", "continuous auction", or mentions CCA contracts.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(curl:*), WebFetch, AskUserQuestion, cca-supply-schedule__generate_supply_schedule, cca-supply-schedule__encode_supply_schedule
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# CCA Configuration

Configure Continuous Clearing Auction (CCA) smart contract parameters for fair and transparent token distribution.

> **Runtime Compatibility:** This skill uses `AskUserQuestion` for interactive prompts. If `AskUserQuestion` is not available in your runtime, collect the same parameters through natural language conversation instead.

## Instructions for Claude Code

When the user invokes this skill, guide them through a **bulk interactive form configuration flow** using AskUserQuestion. Collect parameters in batches to minimize user interaction rounds.

### Bulk Interactive Form Rules

1. **Batch questions** - Ask up to 4 questions at once using a single AskUserQuestion call
2. **Allow direct input** - For fields requiring custom values (addresses, numbers):
   - Provide a "Not available yet" or "Skip for now" option
   - The "Other" option (automatically provided) allows direct custom input
   - **NEVER** ask "Do you have X?" as a separate question
3. **Store answers** - Keep track of all collected values in a configuration object
4. **Validate after collection** - After each batch, validate all inputs before proceeding
5. **Show progress** - After each batch, show which parameters are collected and which remain

### Configuration Flow

Collect parameters in these batches:

#### Batch 1: Task Selection (1 question)

**Question 1: Task Type**

- Prompt: "What would you like to do with CCA?"
- Options: "Configure auction parameters", "Generate supply schedule only", "Review existing config", "Deploy existing config"

**After collection:** If not "Configure auction parameters", skip to appropriate section.

---

#### Batch 2: Basic Configuration (4 questions)

**Question 1: Network**

- Prompt: "Which network to deploy on?"
- Options: "Ethereum Mainnet", "Unichain (Mainnet)", "Unichain Sepolia (Testnet)", "Base", "Arbitrum", "Sepolia"
- Store: `chainId`, `blockTime`, `rpcUrl`, `currencyDecimals` (for selected currency)

**Question 2: Token Address**

- Prompt: "Token to be auctioned?"
- Options: "Token not deployed yet" (placeholder), Custom address (via "Other")
- Validation: Must be 42 chars starting with 0x
- Store: `token`

**Question 3: Total Supply**

- Prompt: "How many tokens to auction?"
- Options: "100 million tokens (18 decimals)", "1 billion tokens (18 decimals)", "10 billion tokens (18 decimals)", Custom (via "Other")
- Validation: Must be <= 1e30 wei
- Store: `totalSupply`

**Question 4: Currency**

- Prompt: "What currency should bidders use?"
- Options: "ETH (Native)", "USDC on [network]", "USDT on [network]", Custom ERC20 (via "Other")
- Validation: Must be 42 chars starting with 0x or address(0)
- Store: `currency`

**After collection:** Validate all inputs, show summary of basic configuration.

---

#### Batch 3: Timing & Pricing (4 questions)

**Question 1: Auction Duration**

- Prompt: "How long should the auction run?"
- Options: "1 day", "2 days", "3 days", "7 days", Custom blocks (via "Other")
- Calculate blocks based on network block time
- Store: `auctionBlocks`

**Question 2: Prebid Period**

- Prompt: "Include a prebid period? (time when no tokens are sold)"
- Options: "No prebid period (0 blocks)", "12 hours", "1 day", Custom blocks (via "Other")
- Calculate blocks based on network block time
- Store: `prebidBlocks`

**Question 3: Floor Price**

- Prompt: "Starting floor price? (ratio of currency per token)"
- Options: "0.10x (10% of 1:1 ratio)", "0.01x (1% of 1:1 ratio)", "0.001x (0.1% of 1:1 ratio)", Custom ratio (via "Other")
- Calculate Q96 value accounting for decimal differences: `Q96 * ratio / 10^(tokenDecimals - currencyDecimals)`
- For USDC (6 decimals) and 18-decimal token: `Q96 * ratio / 10^12`
- For native ETH (18 decimals) and 18-decimal token: `Q96 * ratio / 10^0 = Q96 * ratio`
- Store: `floorPriceRatio`, `floorPrice` (Q96), `tokenDecimals`, `currencyDecimals`

**Question 4: Tick Spacing**

- Prompt: "Tick spacing as percentage of floor price?"
- Options: "1% of floor price (Recommended)", "10% of floor price", "0.1% of floor price", Custom percentage (via "Other")
- Calculate: `tickSpacing = int(floorPrice * percentage)`
- **CRITICAL**: Round floor price DOWN to be evenly divisible by tick spacing:
  - `roundedFloorPrice = (floorPrice // tickSpacing) * tickSpacing`
  - Verify: `roundedFloorPrice % tickSpacing == 0` must be true
- Validate: Tick spacing must be >= 1 basis point of floor price
- Store: `tickSpacingPercentage`, `tickSpacing` (Q96), `roundedFloorPrice`

**After collection:** Validate inputs, verify floor price divisibility, calculate and display Q96 values, show timing summary.

---

#### Batch 4: Recipients & Launch (4 questions)

**Question 1: Tokens Recipient**

- Prompt: "Where should unsold tokens be sent?"
- Options: "Same as funds recipient", Custom address (via "Other")
- Validation: Must be 42 chars starting with 0x
- Store: `tokensRecipient`

**Question 2: Funds Recipient**

- Prompt: "Where should raised funds be sent?"
- Options: "Same as tokens recipient", Custom address (via "Other")
- Validation: Must be 42 chars starting with 0x
- Store: `fundsRecipient`

**Question 3: Start Time**

- Prompt: "When should the auction start?"
- Options: "In 1 hour", "In 6 hours", "In 24 hours", Custom block number (via "Other")
- Fetch current block number from RPC and calculate
- Store: `startBlock`
- Calculate: `endBlock = startBlock + prebidBlocks + auctionBlocks`, `claimBlock = endBlock`

**Question 4: Minimum Funds Required**

- Prompt: "Require minimum currency raised for graduation?"
- Options: "No minimum (0)", "100 ETH", "1000 ETH", Custom amount in wei (via "Other")
- Store: `requiredCurrencyRaised`

**After collection:** Validate addresses, fetch current block from RPC, calculate full block timeline.

---

#### Batch 5: Optional Hook (1 question)

**Question 1: Validation Hook**

- Prompt: "Use a validation hook contract?"
- Options: "No validation hook", Custom hook address (via "Other")
- Validation: Must be 42 chars starting with 0x (if provided)
- Store: `validationHook`

**After collection:** Validate hook address if provided.

---

#### Step 6: Generate Supply Schedule

**If MCP server is not running**, provide instructions to start it:

```bash
# Navigate to MCP server directory
cd packages/plugins/uniswap-cca/mcp-server/supply-schedule

# Run setup script (first time only)
chmod +x setup.sh
./setup.sh

# Start the MCP server
python3 server.py
```

Once the MCP server is running, call the `cca-supply-schedule__generate_supply_schedule` MCP tool with the collected parameters. The tool expects a JSON object:

```json
{
  "auction_blocks": 86400,
  "prebid_blocks": 0
}
```

Replace the values with the actual `auctionBlocks` and `prebidBlocks` collected from the user.

If the MCP tool is unavailable, use the fallback Python algorithm directly (see Supply Schedule Configuration section).

Store: `supplySchedule`

#### Step 7: Generate and Display Configuration

After collecting all parameters and generating the supply schedule, display the complete JSON configuration in the CLI output:

```json
{
  "[chainId]": {
    "token": "...",
    "totalSupply": ...,
    "currency": "...",
    "tokensRecipient": "...",
    "fundsRecipient": "...",
    "startBlock": ...,
    "endBlock": ...,
    "claimBlock": ...,
    "tickSpacing": ...,
    "validationHook": "...",
    "floorPrice": ...,
    "requiredCurrencyRaised": ...,
    "supplySchedule": [...]
  }
}
```

**Do NOT automatically create a file.** Let the user copy the JSON or specify a filepath to save it.

#### Step 8: Display Summary

Show the user a comprehensive formatted summary including:

- Network and chain ID
- Token and currency details
- Block timeline (start, end, claim) with human-readable times
- Pricing (floor price, tick spacing) in both Q96 and ratio formats
- Recipients (tokens, funds)
- Supply schedule summary (total phases, final block percentage)
- Validation checklist (all validation rules passed/failed)

#### Step 9: Next Steps

Ask the user what they want to do:

- "Save to file" (ask for filepath, default: `script/auction-config.json`)
- "View deployment instructions" (suggest using the deployer skill)
- "Modify configuration"
- "Exit" (just end, they can copy the JSON from CLI output)

### Important Notes

- **Validate in batches** - Validate all inputs after each batch collection
- **Fetch current block number** from RPC when calculating start/end blocks
- **Calculate Q96 values** correctly for floor price and tick spacing:
  - **CRITICAL**: Account for decimal differences: `Q96 * ratio / 10^(tokenDecimals - currencyDecimals)`
  - USDC is 6 decimals on all networks - divide by 10^12 for 18-decimal tokens
  - Native ETH is 18 decimals - no adjustment needed for 18-decimal tokens
- **Round floor price** to be evenly divisible by tick spacing:
  - `roundedFloorPrice = (floorPrice // tickSpacing) * tickSpacing`
  - **MUST verify**: `roundedFloorPrice % tickSpacing == 0`
- **Use the MCP tool** for supply schedule generation (provide setup instructions if not running)
- **Minimize interaction rounds** - Collect as many params as reasonable per batch

### Network-Specific Constants

Store these for quick reference:

```typescript
const NETWORKS = {
  1: {
    name: 'Mainnet',
    blockTime: 12,
    rpc: 'https://ethereum-rpc.publicnode.com',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  130: {
    name: 'Unichain',
    blockTime: 1,
    rpc: 'https://mainnet.unichain.org',
    usdc: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
  },
  1301: {
    name: 'Unichain Sepolia (Testnet)',
    blockTime: 2,
    rpc: 'https://sepolia.unichain.org',
    usdc: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
  },
  8453: {
    name: 'Base',
    blockTime: 2,
    rpc: 'https://mainnet.base.org',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  42161: {
    name: 'Arbitrum',
    blockTime: 2,
    rpc: 'https://arb1.arbitrum.io/rpc',
    usdc: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  },
  11155111: {
    name: 'Sepolia',
    blockTime: 12,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
};

// Q96 = 2^96 (JavaScript BigInt notation)
const Q96 = 79228162514264337593543950336n;
```

Python equivalent:

```python
# Q96 = 2**96
Q96 = 79228162514264337593543950336
```

## Overview

CCA (Continuous Clearing Auction) is a novel auction mechanism that generalizes the uniform-price auction into continuous time. It provides fair price discovery for bootstrapping initial liquidity while eliminating timing games and encouraging early participation.

Key features:

- **Fair price discovery**: Continuous clearing with no timing games
- **Transparent distribution**: Supply released on a predetermined schedule
- **Flexible configuration**: Customizable auction parameters and schedules
- **Multi-chain support**: Canonical deployment across EVM chains
- **Factory deployment**: Consistent addresses via CREATE2

## Quick Decision Guide

| Task...                      | Use This Section              |
| ---------------------------- | ----------------------------- |
| Configure auction parameters | Configuration Guide           |
| Generate supply schedule     | Supply Schedule Configuration |
| Understand auction mechanics | Technical Overview            |

---

## Configuration Guide

### Auction Parameters

CCA auctions are configured through the `AuctionParameters` struct:

```solidity
struct AuctionParameters {
    address currency;              // Token to raise funds in (address(0) for ETH)
    address tokensRecipient;       // Address to receive leftover tokens
    address fundsRecipient;        // Address to receive all raised funds
    uint64 startBlock;             // Block when auction starts
    uint64 endBlock;               // Block when auction ends
    uint64 claimBlock;             // Block when tokens can be claimed
    uint256 tickSpacing;           // Fixed granularity for prices (Q96)
    address validationHook;        // Optional hook (use 0x0 if none)
    uint256 floorPrice;            // Starting floor price (Q96)
    uint128 requiredCurrencyRaised; // Minimum funds to graduate
    bytes auctionStepsData;        // Packed supply issuance schedule
}
```

### Configuration File Format

Create a JSON configuration file (e.g., `script/auction-config.json`):

```json
{
  "1": {
    "token": "0x...",
    "totalSupply": 1e29,
    "currency": "0x0000000000000000000000000000000000000000",
    "tokensRecipient": "0x...",
    "fundsRecipient": "0x...",
    "startBlock": 24321000,
    "endBlock": 24327001,
    "claimBlock": 24327001,
    "tickSpacing": 79228162514264337593543950,
    "validationHook": "0x0000000000000000000000000000000000000000",
    "floorPrice": 7922816251426433759354395000,
    "requiredCurrencyRaised": 0,
    "supplySchedule": [
      { "mps": 1000, "blockDelta": 6000 },
      { "mps": 4000000, "blockDelta": 1 }
    ]
  }
}
```

### Parameter Details

#### Basic Configuration

| Parameter         | Type    | Description                                       |
| ----------------- | ------- | ------------------------------------------------- |
| `token`           | address | Token being auctioned                             |
| `totalSupply`     | number  | Total tokens to auction (wei/smallest unit)       |
| `currency`        | address | Purchase token (USDC, etc.) or address(0) for ETH |
| `tokensRecipient` | address | Where unsold tokens go                            |
| `fundsRecipient`  | address | Where raised funds go                             |

#### Block Configuration

| Parameter    | Type   | Description                | Constraint             |
| ------------ | ------ | -------------------------- | ---------------------- |
| `startBlock` | number | When auction starts        | startBlock < endBlock  |
| `endBlock`   | number | When auction ends          | endBlock <= claimBlock |
| `claimBlock` | number | When tokens can be claimed | claimBlock >= endBlock |

**Block times by network:**

- Mainnet, Sepolia: 12s per block
- Unichain, Base, Arbitrum: 2s per block

#### Pricing Parameters

| Parameter                | Type    | Description                                    |
| ------------------------ | ------- | ---------------------------------------------- |
| `floorPrice`             | number  | Minimum price (Q96 format)                     |
| `tickSpacing`            | number  | Price tick increment (Q96 format)              |
| `validationHook`         | address | Optional validation contract (use 0x0 if none) |
| `requiredCurrencyRaised` | number  | Minimum funds needed (0 if no minimum)         |

#### Supply Schedule

| Parameter        | Type  | Description                        |
| ---------------- | ----- | ---------------------------------- |
| `supplySchedule` | array | Array of {mps, blockDelta} objects |

---

## Price Calculations (Q96 Format)

CCA uses Q96 fixed-point format for precise pricing. The base value `2^96` (79228162514264337593543950336) represents a 1:1 price ratio.

### Floor Price Calculation

**CRITICAL: Account for decimal differences between token and currency.**

```python
# Base value for 1:1 ratio
Q96 = 79228162514264337593543950336

# Formula: Q96 * (human price ratio) / 10^(token_decimals - currency_decimals)

# Example 1: USDC (6 decimals) per 18-decimal token at $0.10 ratio
token_decimals = 18
currency_decimals = 6  # USDC has 6 decimals
decimal_adjustment = 10 ** (token_decimals - currency_decimals)  # 10^12

floorPrice = Q96 * 0.1 / decimal_adjustment
# Result: 7922816251426433759354395 (approximately)

# Example 2: Native ETH (18 decimals) per 18-decimal token at 0.1 ratio
token_decimals = 18
currency_decimals = 18  # Native ETH has 18 decimals
decimal_adjustment = 10 ** (18 - 18)  # 10^0 = 1

floorPrice = Q96 * 0.1 / 1
# Result: 7922816251426433759354395034
```

**Key Point:** USDC has 6 decimals on all networks, so you must divide by 10^12 when using USDC with 18-decimal tokens.

### Tick Spacing Calculation

Tick spacing governs where bids can be placed. Choose **AT LEAST 1 basis point of the floor price**. 1% or 10% is also reasonable.

```python
# Example: 1% of floor price
tickSpacing = int(floorPrice * 0.01)

# For floorPrice = 7922816251426433759354395000
# Result: 79228162514264337593543950
```

### Rounding Floor Price (CRITICAL)

**Floor price MUST be evenly divisible by tick spacing.** Round DOWN to ensure exact divisibility:

```python
# Calculate tick spacing first
tickSpacing = int(floorPrice * 0.01)  # 1% of floor price

# Round floor price DOWN to be evenly divisible
roundedFloorPrice = (floorPrice // tickSpacing) * tickSpacing

# VERIFY divisibility (must be True)
assert roundedFloorPrice % tickSpacing == 0, "Floor price must be divisible by tick spacing!"
```

**Example:**

```python
Q96 = 79228162514264337593543950336
raw_floor_price = int(Q96 * 0.0001)  # 0.0001 ETH per token
# Result: 7922816251426434139029504

tick_spacing = int(raw_floor_price * 0.01)  # 1%
# Result: 79228162514264350785536

rounded_floor_price = (raw_floor_price // tick_spacing) * tick_spacing
# Result: 7843588088912170727768064

# Verify: 7843588088912170727768064 / 79228162514264350785536 = 99 (exact)
# Remainder: 0 ✓
```

**Warning**: Setting too small of a tick spacing will make the auction extremely gas inefficient and can result in DoS attacks.

---

## Supply Schedule Configuration

### Understanding MPS (Milli-Basis Points)

Supply schedules use **MPS = 1e7** (10 million), where each unit represents one thousandth of a basis point.

The supply schedule defines the token issuance rate over time. Each step contains:

- `mps`: Tokens released per block (in mps units)
- `blockDelta`: Number of blocks this rate applies

### Standard Schedule Generator

The plugin includes an MCP server that generates supply schedules using a **normalized convex curve** with the following properties:

- **12 steps** (default, configurable) for gradual release
- **Equal token amounts** per step (5.8333% for 70% gradual release)
- **Decreasing block durations** (convex curve property)
- **Large final block** receives remaining tokens (~30%, configurable 20-40%)
- **Total**: Always exactly 10,000,000 MPS

Use the MCP tool `generate_supply_schedule` to generate this standard distribution:

**MCP Tool Call:**

```json
{
  "auction_blocks": 86400,
  "prebid_blocks": 0
}
```

The algorithm automatically calculates:

1. Equal token amounts per step (e.g., 5.8333% for 12 steps with 70% gradual)
2. Time boundaries from normalized curve C(t) = t^α (default α = 1.2)
3. Block durations that DECREASE over time (convex curve property)
4. Final block adjustment to hit exactly 10,000,000 MPS total

### Example: 2-day auction on Base

Base uses 2s blocks, so 2 days = 86400 blocks.

Call `generate_supply_schedule` with:

```json
{
  "auction_blocks": 86400,
  "prebid_blocks": 0
}
```

**Output (normalized convex distribution):**

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

**Notice:**

- Block durations DECREASE: 10894 → 8517 → 7803 → ... → 6043
- Token amounts per step are approximately equal (~5.8333% each)
- Final block contains 29.88% of all tokens
- Total is exactly 10,000,000 MPS

### Example: With prebid period

Add a prebid period where no tokens are released (mps=0). The prebid is prepended to the schedule.

Call `generate_supply_schedule` with:

```json
{
  "auction_blocks": 86400,
  "prebid_blocks": 43200
}
```

**Output:**

```json
{
  "schedule": [
    { "mps": 0, "blockDelta": 43200 },
    { "mps": 54, "blockDelta": 10894 },
    { "mps": 68, "blockDelta": 8517 },
    ...
    { "mps": 2988006, "blockDelta": 1 }
  ],
  "auction_blocks": 86400,
  "prebid_blocks": 43200,
  "total_phases": 14,
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

**Notice:** The prebid phase is simply prepended with `mps: 0`. The auction portion still uses the same normalized convex distribution.

### Custom Schedule

For custom distribution, manually define the schedule:

```json
{
  "supplySchedule": [
    { "mps": 100, "blockDelta": 5000 },
    { "mps": 200, "blockDelta": 5000 },
    { "mps": 500, "blockDelta": 4400 }
  ]
}
```

**Important**: The last block should sell a significant amount of tokens (typically 30%+) to prevent price manipulation.

---

## Encoding Supply Schedule for Onchain Deployment

After generating a supply schedule, it must be encoded into a bytes format for the onchain `AuctionParameters` struct. The encoding packs each `{mps, blockDelta}` element into a uint64.

### Encoding Algorithm

For each element in the supply schedule:

1. **Create uint64** (64 bits / 8 bytes) where:
   - First 24 bits: `mps` value (left padded)
   - Next 40 bits: `blockDelta` value (left padded)
2. **Pack all uint64s** together via `encodePacked` (concatenate bytes)
3. **Return** as hex bytes string with `0x` prefix

### Encoding Formula

```solidity
// Solidity equivalent
uint64 packed = (uint64(mps) << 40) | uint64(blockDelta);
bytes memory auctionStepsData = abi.encodePacked(packed1, packed2, ...);
```

### Value Constraints

- **mps**: Must fit in 24 bits (max: 16,777,215)
- **blockDelta**: Must fit in 40 bits (max: 1,099,511,627,775)

### Using the MCP Tool

Use the `encode_supply_schedule` MCP tool to encode a supply schedule:

**Input:**

```json
{
  "schedule": [
    { "mps": 0, "blockDelta": 43200 },
    { "mps": 54, "blockDelta": 10894 },
    { "mps": 68, "blockDelta": 8517 }
  ]
}
```

**Output:**

```json
{
  "encoded": "0x0000000000a8c00000003600002aa60000004400002145...",
  "length_bytes": 112,
  "num_elements": 14
}
```

### Manual Encoding Example (Python)

```python
def encode_supply_schedule(schedule):
    """Encode supply schedule to bytes."""
    encoded_bytes = b''

    for item in schedule:
        mps = item['mps']
        block_delta = item['blockDelta']

        # Validate bounds
        assert mps < 2**24, f"mps {mps} exceeds 24-bit max"
        assert block_delta < 2**40, f"blockDelta {block_delta} exceeds 40-bit max"

        # Pack into uint64: mps (24 bits) << 40 | blockDelta (40 bits)
        packed = (mps << 40) | block_delta

        # Convert to 8 bytes (big-endian)
        encoded_bytes += packed.to_bytes(8, byteorder='big')

    return '0x' + encoded_bytes.hex()

# Example
schedule = [
    {"mps": 0, "blockDelta": 43200},
    {"mps": 54, "blockDelta": 10894}
]
encoded = encode_supply_schedule(schedule)
print(encoded)  # 0x0000000000a8c00000003600002aa6
```

### Integration with Configuration Flow

When using the configurator skill:

1. **Generate schedule** via `generate_supply_schedule` MCP tool
2. **Encode schedule** via `encode_supply_schedule` MCP tool
3. **Include encoded bytes** in final configuration output
4. **Pass to deployment** script as `auctionStepsData` parameter

The encoded bytes string is what gets passed to the Factory's `initializeDistribution` function as part of the `configData` parameter.

---

## Getting Current Block Number

Use public RPCs to fetch current block for `startBlock` configuration:

### Available Public RPCs

| Network  | RPC URL                                       |
| -------- | --------------------------------------------- |
| Mainnet  | <https://ethereum-rpc.publicnode.com>         |
| Unichain | <https://unichain-rpc.publicnode.com>         |
| Base     | <https://mainnet.base.org>                    |
| Arbitrum | <https://arb1.arbitrum.io/rpc>                |
| Sepolia  | <https://ethereum-sepolia-rpc.publicnode.com> |

### Fetch Block Number

```bash
curl -X POST "https://mainnet.base.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_blockNumber",
    "params": [],
    "id": 1
  }'
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x123abc"
}
```

Convert hex to decimal for block number.

---

## Validation Rules

Before generating configuration, ensure:

1. **Block constraints**: `startBlock < endBlock <= claimBlock`
2. **Valid addresses**: All addresses are valid Ethereum addresses (0x + 40 hex chars)
3. **Non-negative values**: All numeric values >= 0
4. **Floor price alignment**: Floor price must be a multiple of tick spacing
5. **Tick spacing**: At least 1 basis point of floor price (1%, 10% recommended)
6. **Supply schedule**: Last block sells significant tokens (~30%+)
7. **Total supply bounds**: Max 1e30 wei (1 trillion 18-decimal tokens)
8. **No FoT tokens**: Fee-on-transfer tokens not supported
9. **Minimum decimals**: Do not use tokens with < 6 decimals

---

## Additional Resources

- **CCA Repository**: <https://github.com/Uniswap/continuous-clearing-auction>
- **Technical Documentation**: See `docs/TechnicalDocumentation.md` in repo
- **Deployment Guide**: See `docs/DeploymentGuide.md` in repo
- **Whitepaper**: See `docs/assets/whitepaper.pdf` in repo
- **Audits**: See `docs/audits/README.md` in repo
- **Uniswap Docs**: <https://docs.uniswap.org/contracts/liquidity-launchpad/CCA>
- **Bug Bounty**: <https://cantina.xyz/code/f9df94db-c7b1-434b-bb06-d1360abdd1be/overview>
