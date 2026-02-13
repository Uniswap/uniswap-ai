# CLAUDE.md - uniswap-cca

## Overview

This plugin provides skills and MCP servers for configuring and deploying Continuous Clearing Auction (CCA) smart contracts. CCA is a novel auction mechanism for fair and transparent token distribution that generalizes the uniform-price auction into continuous time.

## Plugin Components

### Skills (./skills/)

- **configurator**: Interactive bulk form configuration flow for CCA auction parameters. Collects all parameters in efficient batches (up to 4 questions at once), generates supply schedules via MCP tool, and outputs JSON configuration files.

- **deployer**: Deployment guidance for CCA contracts via Factory pattern. Provides safety warnings, validation checklists, Foundry script examples, and post-deployment steps.

### MCP Servers (./.mcp.json)

| Server                  | Description                                                                            | Type  |
| ----------------------- | -------------------------------------------------------------------------------------- | ----- |
| **cca-supply-schedule** | Generate and encode supply schedules using normalized convex curve (C(t) = t^α, α=1.2) | stdio |

## File Structure

```text
uniswap-cca/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── configurator/
│   │   └── SKILL.md
│   └── deployer/
│       └── SKILL.md
├── mcp-server/
│   ├── README.md
│   └── supply-schedule/
│       ├── server.py                # Python MCP server
│       ├── requirements.txt         # Python dependencies
│       ├── setup.sh                 # Setup script
│       ├── test_logic.py            # Test suite
│       ├── __init__.py
│       └── README.md                # Algorithm documentation
├── .mcp.json                        # MCP server configuration
├── project.json
├── package.json
├── CLAUDE.md
└── README.md
```

## Skill Workflow

The skills are designed to be used in sequence:

```text
configurator (configure parameters)
        ↓
    JSON config file
        ↓
deployer (deploy via Factory)
```

1. **configurator**: User runs the configuration flow, provides auction parameters through efficient bulk form prompts, generates supply schedule via MCP tool, and gets a JSON configuration file.
2. **deployer**: User provides the JSON config, validates parameters, and deploys via `ContinuousClearingAuctionFactory` using Foundry scripts.

## Configurator Skill

Interactive configuration tool that collects CCA auction parameters through a **bulk form prompting flow**. Minimizes user interaction rounds by asking up to 4 questions at once.

### Configuration Flow (5 Batches)

1. **Batch 1: Task Selection** (1 question) - What to do with CCA?
2. **Batch 2: Basic Configuration** (4 questions) - Network, token, supply, currency
3. **Batch 3: Timing & Pricing** (4 questions) - Duration, prebid, floor price, tick spacing
4. **Batch 4: Recipients & Launch** (4 questions) - Token recipient, fund recipient, start time, minimum funds
5. **Batch 5: Optional Hook** (1 question) - Validation hook address

### Key Features

- **Efficient Prompting**: Collects up to 4 parameters per batch
- **Direct Input**: "Other" option allows custom values without multi-step confirmation
- **Smart Defaults**: Network-specific addresses (USDC, USDT) and timing options
- **Live Block Data**: Fetches current block from public RPCs
- **Q96 Price Calculations**: Automatic conversion with decimal adjustment
- **Supply Schedule Generation**: Uses MCP tool for standard distribution
- **Batch Validation**: Validates inputs after each collection batch
- **JSON Output**: Generates ready-to-deploy configuration file

### MCP Tool Integration

The configurator uses two MCP tools from the `cca-supply-schedule` server:

#### 1. generate_supply_schedule

Generates supply schedules using the normalized convex curve algorithm.

**Input:**

- `auction_blocks`: Total blocks for auction
- `prebid_blocks`: Prebid period blocks (optional)

**Output:**

- Standard normalized convex curve distribution
- 12 steps (default) with equal token amounts (~5.8333% each)
- Decreasing block durations (convex curve property)
- ~30% in final block
- Always exactly 10,000,000 MPS total

#### 2. encode_supply_schedule

Encodes supply schedules to bytes for onchain deployment.

**Input:**

- `schedule`: Array of `{mps, blockDelta}` objects

**Output:**

- Hex-encoded bytes string (0x prefix)
- Each element packed as uint64: mps (24 bits) | blockDelta (40 bits)
- Ready for Factory's `initializeDistribution` configData parameter

### Network Support

- Ethereum Mainnet (chain ID: 1, 12s blocks)
- Unichain Mainnet (chain ID: 130, 1s blocks)
- Unichain Sepolia (chain ID: 1301, 2s blocks)
- Base (chain ID: 8453, 2s blocks)
- Arbitrum (chain ID: 42161, 2s blocks)
- Sepolia (chain ID: 11155111, 12s blocks)

## Deployer Skill

Deployment guidance tool that provides safety warnings, validation checklists, Foundry script examples, and post-deployment steps for CCA contracts.

### Workflow

1. **Educational Disclaimer** - User acknowledges educational nature and risks
2. **Load Configuration** - Read JSON config file
3. **Validate Configuration** - Check all validation rules
4. **Display Deployment Plan** - Show what will be deployed
5. **Get Confirmation** - User explicitly confirms deployment
6. **Provide Commands** - Foundry script examples
7. **Post-Deployment** - `onTokensReceived()` call instruction

### Factory Deployment

Uses `ContinuousClearingAuctionFactory` (v1.1.0) at canonical address:

- **Factory Address**: `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5`
- **Deployment Method**: CREATE2 for consistent addresses across chains
- **Interface**: `initializeDistribution(address token, uint256 amount, bytes configData, bytes32 salt)`

### Validation Rules

Before deployment, ensures:

1. Block constraints: `startBlock < endBlock <= claimBlock`
2. Valid Ethereum addresses (0x + 40 hex chars)
3. Non-negative values
4. Floor price divisible by tick spacing
5. Tick spacing >= 1 basis point of floor price
6. Last supply step sells ~30%+ tokens
7. Total supply <= 1e30 wei
8. No fee-on-transfer tokens
9. Token decimals >= 6

### Post-Deployment Steps

**CRITICAL**: After deployment, must call `onTokensReceived()` to notify the auction that tokens have been transferred. This is required before the auction can accept bids.

```bash
cast send $AUCTION_ADDRESS "onTokensReceived()" --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## MCP Server: cca-supply-schedule

This server provides two tools for working with CCA supply schedules.

### Tool 1: generate_supply_schedule

Generates supply schedules using a **normalized convex curve**:

- **Curve**: C(t) = t^α where α = 1.2 (default, configurable)
- **Distribution**: Equal token amounts per step
- **Time Intervals**: Decrease over time (convex curve property)
- **Final Block**: ~30% of tokens (configurable 20-40%)
- **Total**: Always exactly 10,000,000 MPS

**Input Parameters:**

- `auction_blocks` (required): Total blocks for auction
- `prebid_blocks` (optional): Prebid period blocks (default: 0)
- `num_steps` (optional): Number of steps (default: 12)
- `final_block_pct` (optional): Final block percentage (default: 0.30)
- `alpha` (optional): Convexity exponent (default: 1.2)
- `round_to_nearest` (optional): Round block boundaries to N blocks

### Tool 2: encode_supply_schedule

Encodes a supply schedule to bytes for onchain deployment.

- **Encoding**: Each `{mps, blockDelta}` packed as uint64
- **Format**: mps (24 bits) << 40 | blockDelta (40 bits)
- **Output**: Hex string with 0x prefix
- **Usage**: Pass to Factory's `initializeDistribution` as `auctionStepsData`

**Input Parameters:**

- `schedule` (required): Array of `{mps, blockDelta}` objects

**Output:**

- `encoded`: Hex-encoded bytes string
- `length_bytes`: Total byte length
- `num_elements`: Number of schedule elements

**Constraints:**

- mps must fit in 24 bits (max: 16,777,215)
- blockDelta must fit in 40 bits (max: 1,099,511,627,775)

### Setup

```bash
cd mcp-server/supply-schedule
chmod +x setup.sh
./setup.sh
python3 server.py
```

### Dependencies

- Python 3.10+
- `mcp>=1.2.0`
- `pydantic>=2.0.0`

## Key Concepts

### Q96 Fixed-Point Format

CCA uses Q96 fixed-point arithmetic for precise pricing:

- **Q96**: 2^96 = 79228162514264337593543950336
- **Price**: Q96 fixed-point number representing ratio
- **Formula**: `Q96 * ratio / 10^(tokenDecimals - currencyDecimals)`

**Example (USDC/18-decimal token):**

```python
Q96 = 79228162514264337593543950336
ratio = 0.1  # 10% of 1:1 ratio
token_decimals = 18
currency_decimals = 6  # USDC

floorPrice = Q96 * ratio / (10 ** (18 - 6))
# Result: 7922816251426433759354395
```

### MPS (Milli-Basis Points)

Supply schedules use MPS = 1e7 (10 million):

- Each MPS unit = one thousandth of a basis point
- Target total: Always 10,000,000 MPS
- Each schedule step: `{mps: N, blockDelta: N}`

### Supply Schedule Properties

**Default Schedule (12 steps, α=1.2, 30% final):**

- Block durations DECREASE: 10894 → 8517 → 7803 → ... → 6043
- Token amounts EQUAL: ~5.8333% per step
- Final block: ~30% of total supply
- Total: Exactly 10,000,000 MPS

## Important Notes

### Educational Use

**CRITICAL**: All skills and MCP tools are provided for educational purposes only. Users must:

- Review all configurations carefully
- Verify parameters are correct
- Test on testnets first
- Audit contracts before mainnet deployment
- Acknowledge educational disclaimer before deployment

### Validation is Key

The configurator validates inputs after each batch. The deployer validates the full configuration before deployment. Both skills emphasize validation to prevent deployment errors.

### No Automatic File Creation

The configurator displays JSON output but does NOT automatically create files. Users must explicitly request file creation or copy the JSON from CLI output.

## Additional Resources

- **CCA Repository**: <https://github.com/Uniswap/continuous-clearing-auction>
- **Uniswap Docs**: <https://docs.uniswap.org/contracts/liquidity-launchpad/CCA>
- **Bug Bounty**: <https://cantina.xyz/code/f9df94db-c7b1-434b-bb06-d1360abdd1be/overview>
