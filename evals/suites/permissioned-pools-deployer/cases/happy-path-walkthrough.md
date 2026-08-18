# Ready To Go, Let's Start The Deployment

We just ran the configurator and got a full config for chain ID 1. Here it is:

```json
{
  "1": {
    "permissionedToken": "0x111111111111111111111111111111111111111a",
    "allowlistChecker": {
      "mode": "existing",
      "address": "0x222222222222222222222222222222222222222b"
    },
    "adapterOwner": "0x333333333333333333333333333333333333333c",
    "verificationDepositAmount": "1",
    "allowedWrappers": {
      "permissionedPositionManager": "0x444444444444444444444444444444444444444d",
      "universalRouterV2_2": "0x555555555555555555555555555555555555555e",
      "v4Quoter": "0x666666666666666666666666666666666666666f",
      "mixedRouteQuoterV2": "0x777777777777777777777777777777777777777a"
    },
    "hook": "0x888888888888888888888888888888888888888b",
    "pool": {
      "pairedCurrency": "native",
      "feeTier": "3000",
      "tickSpacing": "60",
      "startingPriceRatio": "1"
    },
    "seeding": { "intent": "seed-now", "wallet": "0x333333333333333333333333333333333333333c" }
  }
}
```

We're rehearsing on Sepolia (chain ID 11155111) first, using the same addresses shown above since
the permissioned-pools contracts are already deployed there for our testing.

Earlier in this session you showed me the five safety points and asked whether I acknowledge them
and want to continue. I chose "Yes, I have reviewed the points above and want to continue."

Walk me through Step 1 through Step 4 — confirming our existing checker, creating the permissions
adapter, allowlisting and funding it, and verifying it. Show me the commands in order and what to
check after each one.
