# uniswap-cca

Configure and deploy Continuous Clearing Auction (CCA) smart contracts for fair and transparent token distribution.

## Overview

CCA (Continuous Clearing Auction) is a novel auction mechanism that generalizes the uniform-price auction into continuous time. This plugin provides AI-powered skills for configuring auction parameters and deploying CCA contracts via the Factory pattern.

**Key Features:**

- **Interactive Configuration**: Efficient bulk form prompting (up to 4 questions at once)
- **Supply Schedule Generation**: Automated supply schedule using normalized convex curve
- **Q96 Price Calculations**: Automatic conversion with decimal adjustment
- **Multi-chain Support**: Ethereum, Unichain, Base, Arbitrum, Sepolia
- **Factory Deployment**: CREATE2-based deployment for consistent addresses
- **Validation & Safety**: Comprehensive validation rules and educational disclaimers

## Installation

This plugin is part of the `uniswap-ai` monorepo and will be available through the Claude Code plugin marketplace.

### Prerequisites

- **Python 3.10+** (for MCP server)
- **Claude Code** (latest version)

### MCP Server Setup

The plugin includes an MCP server for supply schedule generation. To set it up:

```bash
# Navigate to MCP server directory
cd packages/plugins/uniswap-cca/mcp-server/supply-schedule

# Run setup script (first time only)
chmod +x setup.sh
./setup.sh

# Start the MCP server
python3 server.py
```

The MCP server will run in the background and provide the `generate_supply_schedule` tool.

## Skills

### `/configurator`

Interactive configuration skill for CCA auction parameters.

**What it does:**

- Collects auction parameters through efficient bulk form prompts
- Fetches current block numbers from public RPCs
- Calculates Q96 prices with decimal adjustment
- Generates supply schedules via MCP tool
- Outputs JSON configuration file

**Usage:**

```text
Configure a CCA auction for a new token launch
```

**Triggers:**

- "configure auction"
- "cca auction"
- "setup token auction"
- "auction configuration"
- "continuous auction"

**Configuration Flow:**

1. Task selection
2. Basic configuration (network, token, supply, currency)
3. Timing & pricing (duration, prebid, floor price, tick spacing)
4. Recipients & launch (token recipient, fund recipient, start time, minimum funds)
5. Optional hook
6. Supply schedule generation
7. JSON output

### `/deployer`

Deployment guidance skill for CCA contracts via Factory pattern.

**What it does:**

- Shows educational disclaimers and safety warnings
- Validates configuration files
- Provides Foundry script examples
- Guides through Factory deployment
- Explains post-deployment steps

**Usage:**

```text
Deploy my configured CCA auction
```

**Triggers:**

- "deploy auction"
- "deploy cca"
- "factory deployment"

**Deployment Steps:**

1. Educational disclaimer acknowledgment
2. Configuration validation
3. Deployment plan review
4. Foundry script examples
5. Post-deployment `onTokensReceived()` call

## MCP Server

### cca-supply-schedule

Generates supply schedules using a normalized convex curve.

**Algorithm:**

- **Curve**: C(t) = t^α where α = 1.2 (moderately convex)
- **Distribution**: Equal token amounts per step (~5.8333% for 12 steps)
- **Time Intervals**: Decrease over time (convex curve property)
- **Final Block**: ~30% of tokens (configurable 20-40%)
- **Total**: Always exactly 10,000,000 MPS

**Tool:** `cca-supply-schedule__generate_supply_schedule`

**Input:**

```json
{
  "auction_blocks": 86400,
  "prebid_blocks": 0
}
```

**Output:**

```json
{
  "schedule": [
    { "mps": 54, "blockDelta": 10894 },
    { "mps": 68, "blockDelta": 8517 },
    ...
    { "mps": 2988006, "blockDelta": 1 }
  ],
  "summary": {
    "total_mps": 10000000,
    "final_block_percentage": 29.88,
    "num_steps": 12,
    "alpha": 1.2
  }
}
```

## Supported Networks

| Network  | Chain ID | Block Time | Factory Address                              |
| -------- | -------- | ---------- | -------------------------------------------- |
| Mainnet  | 1        | 12s        | `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5` |
| Unichain | 1301     | 2s         | `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5` |
| Base     | 8453     | 2s         | `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5` |
| Arbitrum | 42161    | 2s         | `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5` |
| Sepolia  | 11155111 | 12s        | `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5` |

## Configuration File Format

Example JSON configuration:

```json
{
  "1": {
    "token": "0x...",
    "totalSupply": 100000000000000000000000000,
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
      { "mps": 54, "blockDelta": 10894 },
      { "mps": 68, "blockDelta": 8517 },
      ...
      { "mps": 2988006, "blockDelta": 1 }
    ]
  }
}
```

## Validation Rules

Before deployment, ensure:

1. Block constraints: `startBlock < endBlock <= claimBlock`
2. Valid Ethereum addresses (0x + 40 hex chars)
3. Non-negative values
4. Floor price divisible by tick spacing
5. Tick spacing >= 1 basis point of floor price
6. Last supply step sells ~30%+ tokens
7. Total supply <= 1e30 wei
8. No fee-on-transfer tokens
9. Token decimals >= 6

## Educational Use Disclaimer

⚠️ **IMPORTANT**: This plugin and all generated configurations are provided **for educational purposes only**. AI-generated content may contain errors, inaccuracies, or suboptimal settings.

**You must:**

- ✅ Review all configurations carefully before deploying
- ✅ Verify all parameters are correct for your use case
- ✅ Test on testnets first before mainnet deployment
- ✅ Audit your contracts before deploying with real funds

## Examples

### Example 1: Configure a 2-day auction on Base

```text
User: Configure a CCA auction for my new token on Base

Agent: [Runs configurator skill]
- Network: Base
- Token: [user provides address]
- Supply: 1 billion tokens (18 decimals)
- Currency: USDC on Base
- Duration: 2 days (86400 blocks)
- Floor Price: 0.01x (1% of 1:1 ratio)
- Tick Spacing: 1% of floor price

[Generates supply schedule via MCP]
[Outputs JSON configuration]
```

### Example 2: Deploy configured auction

```text
User: Deploy my configured CCA auction

Agent: [Runs deployer skill]
- Shows educational disclaimer
- Validates configuration
- Provides Foundry script examples
- Explains post-deployment steps
```

## Troubleshooting

### MCP Server Not Running

If the supply schedule generation fails:

```bash
cd packages/plugins/uniswap-cca/mcp-server/supply-schedule
python3 server.py
```

### Invalid Configuration

Common issues:

- Floor price not divisible by tick spacing → Round floor price down
- Tick spacing too small → Use at least 1% of floor price
- Invalid block sequence → Ensure `startBlock < endBlock <= claimBlock`

## Additional Resources

- **CCA Repository**: <https://github.com/Uniswap/continuous-clearing-auction>
- **Technical Documentation**: See CCA repo `docs/TechnicalDocumentation.md`
- **Deployment Guide**: See CCA repo `docs/DeploymentGuide.md`
- **Whitepaper**: See CCA repo `docs/assets/whitepaper.pdf`
- **Audits**: See CCA repo `docs/audits/README.md`
- **Uniswap Docs**: <https://docs.uniswap.org/contracts/liquidity-launchpad/CCA>
- **Bug Bounty**: <https://cantina.xyz/code/f9df94db-c7b1-434b-bb06-d1360abdd1be/overview>

## License

MIT
