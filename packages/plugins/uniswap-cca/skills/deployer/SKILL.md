---
name: deployer
description: Deploy CCA (Continuous Clearing Auction) smart contracts using the Factory pattern. Use when user says "deploy auction", "deploy cca", "factory deployment", or wants to deploy a configured auction.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(forge:*), Bash(cast:*), Bash(curl:*), AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
---

# CCA Deployment

Deploy Continuous Clearing Auction (CCA) smart contracts using the `ContinuousClearingAuctionFactory` with CREATE2 for consistent addresses across chains.

> **Runtime Compatibility:** This skill uses `AskUserQuestion` for interactive prompts. If `AskUserQuestion` is not available in your runtime, collect the same parameters through natural language conversation instead.

## Instructions for Claude Code

When the user invokes this skill, guide them through the CCA deployment process with appropriate safety warnings and validation.

### Pre-Deployment Requirements

Before proceeding with deployment, you MUST:

1. **Show educational disclaimer** and get user acknowledgment
2. **Validate configuration file** if provided
3. **Verify factory address** for the target network
4. **Confirm deployment parameters** with user

### Deployment Workflow

1. **Show Educational Disclaimer** (REQUIRED)
2. **Load or Request Configuration**
3. **Validate Configuration**
4. **Display Deployment Plan**
5. **Get User Confirmation**
6. **Provide Deployment Commands**
7. **Post-Deployment Steps**

---

## ⚠️ Educational Use Disclaimer

**IMPORTANT: Before proceeding with deployment, you must acknowledge:**

This tool and all deployment instructions are provided **for educational purposes only**. AI-generated deployment commands may contain errors or security vulnerabilities.

**You must:**

1. ✅ **Review all configurations carefully** before deploying
2. ✅ **Verify all parameters** (addresses, pricing, schedules) are correct
3. ✅ **Test on testnets first** before deploying to mainnet
4. ✅ **Audit your contracts** before deploying with real funds

**Use AskUserQuestion to confirm the user acknowledges these warnings before proceeding with deployment steps.**

---

## 🔐 Private Key Security

**CRITICAL: Handling private keys safely is essential for secure deployments.**

### ⚠️ Never Do These

- ❌ **Never** store private keys in git repositories or config files
- ❌ **Never** paste private keys directly in command line (visible in shell history)
- ❌ **Never** share private keys or store them in shared environments
- ❌ **Never** use mainnet private keys on untrusted computers

### ✅ Recommended Practices

#### Option 1: Hardware Wallets (Most Secure)

Use Ledger or Trezor hardware wallets with the `--ledger` flag:

```bash
forge script script/Example.s.sol:ExampleScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --ledger
```

#### Option 2: Encrypted Keystore

Create an encrypted keystore with `cast wallet import`:

```bash
# Import private key to encrypted keystore (one-time setup)
cast wallet import deployer --interactive

# Use keystore for deployment
forge script script/Example.s.sol:ExampleScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --account deployer \
  --sender $DEPLOYER_ADDRESS
```

#### Option 3: Environment Variables (For Testing Only)

If using environment variables, ensure they are:

- Set in a secure `.env` file (never committed to git)
- Loaded via `source .env` or `dotenv`
- Only used on trusted, secure computers
- Use testnet keys for development

**Example:**

```bash
# .env file (add to .gitignore)
PRIVATE_KEY=0x...
RPC_URL=https://...

# Load environment
source .env

# Deploy
forge script ... --private-key $PRIVATE_KEY
```

### Testnet First

**Always test on testnets before mainnet:**

- Sepolia (testnet): Get free ETH from faucets
- Base Sepolia: Free ETH for testing on Base
- Deploy and verify full workflow on testnet
- Only deploy to mainnet after thorough testing

---

## Deployment Guide

### Factory Deployment

CCA instances are deployed via the `ContinuousClearingAuctionFactory` contract, which uses CREATE2 for consistent addresses across chains.

#### Factory Addresses

| Version | Address                                      | Status          |
| ------- | -------------------------------------------- | --------------- |
| v1.1.0  | `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5` | **Recommended** |

### Deploying an Auction Instance

#### Step 0: Clone the CCA Repository

If you don't already have the CCA contracts locally, clone the repository and install dependencies:

```bash
git clone https://github.com/Uniswap/continuous-clearing-auction.git
cd continuous-clearing-auction
forge install
```

This gives you access to the deployment scripts, contract ABIs, and test helpers referenced in later steps.

#### Step 1: Prepare Configuration

Ensure you have a valid configuration file (generated via the `configurator` skill or manually created).

Example configuration file structure:

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

#### Step 2: Validate Configuration

Before deployment, verify the configuration passes all validation rules (see Validation Rules section).

#### Step 3: Deploy via Factory

The factory has a simple interface:

```solidity
function initializeDistribution(
    address token,
    uint256 amount,
    bytes calldata configData,
    bytes32 salt
) external returns (IDistributionContract);
```

Where:

- `token`: Address of the token to be sold
- `amount`: Amount of tokens to sell in the auction
- `configData`: ABI-encoded `AuctionParameters` struct
- `salt`: Optional bytes32 value for vanity address mining

#### Step 3.5: Encode Configuration to configData

The factory's `initializeDistribution` expects `configData` as ABI-encoded `AuctionParameters`. Convert your JSON config to encoded bytes:

**Using cast (Foundry CLI):**

```bash
# Encode the AuctionParameters struct
cast abi-encode "initializeDistribution(address,uint256,bytes,bytes32)" \
  "$TOKEN_ADDRESS" \
  "$TOTAL_SUPPLY" \
  "$(cast abi-encode "(address,address,address,uint64,uint64,uint64,uint256,address,uint256,uint128,bytes)" \
    "$CURRENCY" \
    "$TOKENS_RECIPIENT" \
    "$FUNDS_RECIPIENT" \
    "$START_BLOCK" \
    "$END_BLOCK" \
    "$CLAIM_BLOCK" \
    "$TICK_SPACING" \
    "$VALIDATION_HOOK" \
    "$FLOOR_PRICE" \
    "$REQUIRED_CURRENCY_RAISED" \
    "$ENCODED_SUPPLY_SCHEDULE")" \
  "0x0000000000000000000000000000000000000000000000000000000000000000"
```

**Using a Foundry Script:**

```solidity
// script/DeployAuction.s.sol
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface ICCAFactory {
    function initializeDistribution(
        address token,
        uint256 amount,
        bytes calldata configData,
        bytes32 salt
    ) external returns (address);
}

contract DeployAuction is Script {
    function run() external {
        // Load config values
        address token = vm.envAddress("TOKEN");
        uint256 amount = vm.envUint("TOTAL_SUPPLY");

        // Encode AuctionParameters
        bytes memory configData = abi.encode(
            vm.envAddress("CURRENCY"),
            vm.envAddress("TOKENS_RECIPIENT"),
            vm.envAddress("FUNDS_RECIPIENT"),
            uint64(vm.envUint("START_BLOCK")),
            uint64(vm.envUint("END_BLOCK")),
            uint64(vm.envUint("CLAIM_BLOCK")),
            vm.envUint("TICK_SPACING"),
            vm.envAddress("VALIDATION_HOOK"),
            vm.envUint("FLOOR_PRICE"),
            uint128(vm.envUint("REQUIRED_CURRENCY_RAISED")),
            vm.envBytes("ENCODED_SUPPLY_SCHEDULE")
        );

        vm.startBroadcast();

        // Approve token transfer to factory
        IERC20(token).approve(
            0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5,
            amount
        );

        // Deploy auction
        address auction = ICCAFactory(
            0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5
        ).initializeDistribution(
            token,
            amount,
            configData,
            bytes32(0) // salt
        );

        vm.stopBroadcast();

        console.log("Auction deployed at:", auction);
    }
}
```

**Important:** You must approve the token transfer to the factory before calling `initializeDistribution`. The factory will transfer `amount` tokens from your address to the newly created auction contract.

#### Step 4: Using Foundry Script

```bash
# Deploy factory (if needed on new network)
forge script script/deploy/DeployContinuousAuctionFactory.s.sol:DeployContinuousAuctionFactoryScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY

# Deploy auction instance
forge script script/Example.s.sol:ExampleScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY
```

#### Step 5: Post-Deployment

After deployment, you **must** call `onTokensReceived()` to notify the auction that tokens have been transferred:

```bash
cast send $AUCTION_ADDRESS "onTokensReceived()" --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

This is a required prerequisite before the auction can accept bids.

### Alternative: Deploy via Constructor

You can also deploy directly via the constructor:

```solidity
constructor(
    address token,
    uint128 amount,
    AuctionParameters memory parameters
) {}
```

This approach doesn't require a salt parameter but won't benefit from CREATE2's deterministic addressing.

### Verification on Block Explorers

Generate standard JSON input for verification:

```bash
forge verify-contract $AUCTION_ADDRESS \
  src/ContinuousClearingAuction.sol:ContinuousClearingAuction \
  --rpc-url $RPC_URL \
  --show-standard-json-input > standard-json-input.json
```

Upload this file to block explorers for verification.

---

## Validation Rules

Before deployment, ensure:

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

## Technical Overview

### Q96 Fixed-Point Math

The auction uses Q96 fixed-point arithmetic:

```solidity
library FixedPoint96 {
    uint8 internal constant RESOLUTION = 96;
    uint256 internal constant Q96 = 0x1000000000000000000000000; // 2^96
}
```

- **Price**: Q96 fixed-point number for fractional price ratios
- **Demand**: Currency amounts scaled by Q96

### Auction Steps (Supply Issuance)

Steps are packed into bytes, where each step is a `uint64`:

- First 24 bits: `mps` (per-block issuance rate in MPS)
- Last 40 bits: `blockDelta` (number of blocks)

```solidity
function parse(bytes8 data) internal pure returns (uint24 mps, uint40 blockDelta) {
    mps = uint24(bytes3(data));
    blockDelta = uint40(uint64(data));
}
```

The data is deployed to an external SSTORE2 contract for cheaper reads.

### Key Contract Functions

#### submitBid()

Users submit bids with:

- `maxPrice`: Maximum price willing to pay (Q96)
- `amount`: Currency amount to bid
- `owner`: Address to receive tokens/refunds
- `prevTickPrice`: Hint for gas optimization
- `hookData`: Optional data for validation hooks

#### checkpoint()

Auction is checkpointed once per block with a new bid. Checkpoints determine token allocations.

#### exitBid() / exitPartiallyFilledBid()

Bids can be exited when outbid or when auction ends (only after graduation).

#### isGraduated()

Returns true if `currencyRaised >= requiredCurrencyRaised`. No bids can exit before graduation.

#### claimTokens()

Users claim purchased tokens after `claimBlock` (only for graduated auctions).

#### sweepCurrency() / sweepUnsoldTokens()

After auction ends:

- `sweepCurrency()`: Withdraw raised currency (graduated only)
- `sweepUnsoldTokens()`: Withdraw unsold tokens

---

## Supported Chains

CCA is deployed to canonical addresses across select EVM chains:

| Chain ID | Network          | Block Time |
| -------- | ---------------- | ---------- |
| 1        | Mainnet          | 12s        |
| 130      | Unichain         | 1s         |
| 1301     | Unichain Sepolia | 2s         |
| 8453     | Base             | 2s         |
| 42161    | Arbitrum         | 2s         |
| 11155111 | Sepolia          | 12s        |

---

## Troubleshooting

### Common Issues

| Issue                     | Solution                                            |
| ------------------------- | --------------------------------------------------- |
| "Invalid block sequence"  | Ensure startBlock < endBlock <= claimBlock          |
| "Floor price not aligned" | Round floor price to multiple of tick spacing       |
| "Tick spacing too small"  | Use at least 1% of floor price                      |
| "Total supply too large"  | Max 1e30 wei (1 trillion 18-decimal tokens)         |
| "Gas inefficiency"        | Increase tick spacing                               |
| "Invalid address"         | Verify addresses are 42 characters starting with 0x |

### Validation Checklist

Before deployment:

- [ ] Block sequence is valid (start < end <= claim)
- [ ] Floor price is multiple of tick spacing
- [ ] Tick spacing >= 1% of floor price
- [ ] All addresses are valid Ethereum addresses
- [ ] Total supply <= 1e30 wei
- [ ] Currency is more valuable than token
- [ ] Block times match network (12s mainnet, 2s L2s)
- [ ] Recipients addresses are set (not placeholders)
- [ ] Currency address is correct for network
- [ ] Last supply step sells ~30%+ of tokens
- [ ] No fee-on-transfer tokens used
- [ ] Token decimals >= 6
- [ ] `onTokensReceived()` called post-deployment

---

## Additional Resources

- **CCA Repository**: <https://github.com/Uniswap/continuous-clearing-auction>
- **Technical Documentation**: See `docs/TechnicalDocumentation.md` in repo
- **Deployment Guide**: See `docs/DeploymentGuide.md` in repo
- **Whitepaper**: See `docs/assets/whitepaper.pdf` in repo
- **Audits**: See `docs/audits/README.md` in repo
- **Uniswap Docs**: <https://docs.uniswap.org/contracts/liquidity-launchpad/CCA>
- **Bug Bounty**: <https://cantina.xyz/code/f9df94db-c7b1-434b-bb06-d1360abdd1be/overview>
