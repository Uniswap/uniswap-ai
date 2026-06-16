---
title: LP Integration
order: 12
---

# LP Integration

Integrate Uniswap liquidity provisioning into frontends, backends, and bots using the Uniswap LP API, a transaction-building REST service for creating and managing v2, v3, and v4 positions.

## Invocation

```text
/lp-integration
```

Or describe your requirements naturally:

```text
Help me create a Uniswap v3 liquidity position from my backend using the LP API
```

## What It Does

This skill helps you:

- **Choose the right endpoint**: create, create_classic (v2), increase, decrease, claim_fees, check_approval, and pool_info
- **Build LP flows**: approval and EIP-712 permit handling, then position create/manage transactions
- **Handle the contract correctly**: the LP API's exact request/response field names, which differ from the narrative integration guide in several places
- **Avoid common pitfalls**: signing the wrapped approval transaction, using `adjustedMinPrice`/`adjustedMaxPrice`, wei-denominated amounts, and quote freshness

## How the LP API Works

The LP API is a transaction-building service. You POST position parameters; the API fetches live pool state, computes the dependent token amount, and returns a fully-formed, unsigned transaction. Your application signs and broadcasts it. The API never holds keys or moves funds.

## Endpoints

| Endpoint             | Purpose                                  | Protocols  |
| -------------------- | ---------------------------------------- | ---------- |
| `/lp/check_approval` | Check / return approval transactions     | V2, V3, V4 |
| `/lp/create`         | Create a concentrated-liquidity position | V3, V4     |
| `/lp/create_classic` | Create a full-range position             | V2         |
| `/lp/increase`       | Add liquidity to an existing position    | V2, V3, V4 |
| `/lp/decrease`       | Remove a percentage of liquidity         | V2, V3, V4 |
| `/lp/claim_fees`     | Collect accumulated trading fees         | V3, V4     |
| `/lp/pool_info`      | Read live pool state                     | V2, V3, V4 |

## Key Topics Covered

- LP API reference with request/response examples for every endpoint
- Approval and EIP-712 permit flow (v4 batch permit, v3 NFT permit)
- Contract-vs-guide field-name reconciliation
- A complete viem create-position example
- Companion SDKs (`@uniswap/sdk-core`, `v3-sdk`, `v4-sdk`, `v2-sdk`)
- Error handling, retries, and a pre-broadcast checklist

## Related Resources

- [Uniswap Trading Plugin](/plugins/uniswap-trading) - Parent plugin
- [Swap Integration](/skills/swap-integration) - Sibling skill for token swaps
- [viem Integration](/skills/viem-integration) - Prerequisite EVM blockchain setup
- [LP API Getting Started](https://developers.uniswap.org/docs/liquidity/liquidity-provisioning-api/getting-started) - Official documentation
- [Uniswap Developer Platform](https://developers.uniswap.org/dashboard) - Get an API key
