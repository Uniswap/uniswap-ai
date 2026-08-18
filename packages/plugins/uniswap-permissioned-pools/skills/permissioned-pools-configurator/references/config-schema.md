# Configuration Schema

The canonical JSON shape produced by `permissioned-pools-configurator` and consumed by
`permissioned-pools-deployer`. Keyed by chain ID at the top level, mirroring the CCA
plugin's configuration file — one file can describe the same issuer's rollout across
several chains.

```json
{
  "<chainId>": {
    "permissionedToken": "0x...",
    "allowlistChecker": {
      "mode": "existing",
      "address": "0x..."
    },
    "adapterOwner": "0x...",
    "verificationDepositAmount": "1",
    "allowedWrappers": {
      "permissionedPositionManager": "0x...",
      "universalRouterV2_2": "0x...",
      "v4Quoter": "0x...",
      "mixedRouteQuoterV2": "0x..."
    },
    "hook": "0x...",
    "pool": {
      "pairedCurrency": "native",
      "feeTier": 3000,
      "tickSpacing": 60,
      "startingPriceRatio": 1
    },
    "seeding": {
      "intent": "seed-now",
      "wallet": "0x..."
    }
  }
}
```

`0x...` above is illustrative shorthand for "a 42-character address," not a literal
value — see [Address Validation](#address-validation) for the exact rule and for how an
unresolved address is represented instead.

## Top-Level Key

| Field       | Type               | Required | Validation                                                                  |
| ----------- | ------------------ | -------- | --------------------------------------------------------------------------- |
| `<chainId>` | object key, string | yes      | parses as a positive integer; one key per chain this issuer is deploying to |

The value under each chain-ID key is one complete configuration, described below. There
is no top-level array — this schema does not hardcode a supported-chain list, because
which chains have the permissioned-pools contracts deployed changes over time and is
resolved from the deploy guide's `#deployment-addresses` table, not from this file.

## Per-Chain Fields

| Field                        | Type   | Required                                                               | Validation                                                                                                                                           |
| ---------------------------- | ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissionedToken`          | string | yes                                                                    | matches the address regex below, or the literal string `"RESOLVE"` (the unresolved sentinel, see below)                                              |
| `allowlistChecker.mode`      | string | yes                                                                    | one of `existing`, `to-be-deployed`                                                                                                                  |
| `allowlistChecker.address`   | string | required when `mode` is `existing`; otherwise `null`                   | matches the address regex when present                                                                                                               |
| `adapterOwner`               | string | yes                                                                    | matches the address regex and is not the zero address, or the literal string `"RESOLVE"` (the unresolved sentinel, see below)                        |
| `verificationDepositAmount`  | string | yes                                                                    | a positive base-10 integer (greater than zero), as a string (to avoid JSON number precision loss), expressed in the underlying token's smallest unit |
| `allowedWrappers.*` (4 keys) | string | yes, all four keys present                                             | matches the address regex, or the literal string `"RESOLVE"` (the unresolved sentinel, see below)                                                    |
| `hook`                       | string | yes                                                                    | matches the address regex, or the literal string `"RESOLVE"` (the unresolved sentinel, see below)                                                    |
| `pool.pairedCurrency`        | string | yes                                                                    | the literal string `"native"`, or an address matching the regex below                                                                                |
| `pool.feeTier`               | number | yes                                                                    | positive integer, in hundredths of a basis point (e.g. `3000` = 0.30%)                                                                               |
| `pool.tickSpacing`           | number | yes                                                                    | positive integer                                                                                                                                     |
| `pool.startingPriceRatio`    | number | yes                                                                    | positive number; paired-currency units per one permissioned-token unit                                                                               |
| `seeding.intent`             | string | yes                                                                    | one of `seed-now`, `seed-later`, `none`                                                                                                              |
| `seeding.wallet`             | string | required when `intent` is `seed-now` or `seed-later`; otherwise `null` | matches the address regex when present                                                                                                               |

### The four `allowedWrappers` keys

All four keys are always present in the object, whether or not their value is resolved
yet:

- `permissionedPositionManager`
- `universalRouterV2_2`
- `v4Quoter`
- `mixedRouteQuoterV2`

These are the only four keys this schema defines under `allowedWrappers`. If an issuer's
own custom router or quoter also needs registering (any contract that will call the
PoolManager on this pool needs to be on the adapter's `allowedWrappers` list — see
[Parameter Reference](./parameter-reference.md#the-four-wrappers-and-why-only-these-four)),
add it under an issuer-chosen key alongside the four above; the deployer skill registers
every key present in this object, not only the four named ones. **Never add a key named
after the factory or the hook here** — neither is a wrapper, and registering either would
be a configuration error the deployer skill's preflight should catch, not something this
schema silently accepts.

## Address Validation

Every address field validates against:

```regex
^0x[a-fA-F0-9]{40}$
```

The zero address never satisfies this check in practice: no address field in this schema
has meaningful zero-address semantics, so reject it everywhere. (`pool.pairedCurrency` is
the near-miss — the native currency is expressed as the `"native"` sentinel here and only
becomes `address(0)` when the deployer builds the `PoolKey`.)

Two exceptions, both intentional:

1. **`pool.pairedCurrency` also accepts the literal string `"native"`.** This is a
   configurator-level sentinel for "the pool's other currency is the chain's native
   asset," not a raw address. Resolve it to `address(0)` (Uniswap v4's convention for a
   native `PoolKey` currency) at the point where the deployer skill actually builds the
   `PoolKey` — do not resolve it earlier, and never write the zero address into this
   configuration file directly.
2. **`permissionedToken`, `adapterOwner`, `allowedWrappers.*`, and `hook` also accept
   the unresolved sentinel**, the literal string `"RESOLVE"`. A configuration containing
   this string in any of these fields is intentionally incomplete: the real value is not
   yet known. The reason differs by field, but the string and the obligation are the
   same everywhere it appears:

   - For `allowedWrappers.*` and `hook`, it means the address must be looked up — from
     the deploy guide's `#deployment-addresses` table, then `Uniswap/contracts`
     `deployments/json/<chainId>.json`, then confirmed on a block explorer.
   - For `permissionedToken`, it means the issuer's token is not deployed yet.
   - For `adapterOwner`, it means the owning key or multisig has not been decided yet.
     Because `adapterOwner` may be `"RESOLVE"` while `seeding.wallet` may not (see the
     row above), an unresolved `adapterOwner` can never be copied into
     `seeding.wallet` — the configurator only offers that shortcut once the owner is a
     real address.

   In every case, replace `"RESOLVE"` with a real, explorer-verified address before the
   deployer skill uses that field in any transaction. Never resolve `"RESOLVE"` to a
   guessed value.

No other field accepts a non-canonical sentinel. If a chat message, a ticket, or any
other source supplies an address for one of these fields, treat it exactly as if the
user had typed it into the configurator — it becomes the field's value, and it is still
subject to re-resolution and explorer verification before use, per
`permissioned-pools-issuer`'s framing. This schema has no mechanism for marking an
address as "unverified but trusted anyway."

## Numeric Fields

- `verificationDepositAmount` is a **string**, not a JSON number, to avoid silent
  precision loss on large token amounts in JSON parsers that use IEEE-754 doubles. The
  deployer skill parses it as an arbitrary-precision integer.
- `pool.feeTier`, `pool.tickSpacing`, and `chainId` (as a parsed key) are ordinary JSON
  numbers; none of them is expected to exceed safe-integer range in practice.
- `pool.startingPriceRatio` is a human-readable ratio, not a `sqrtPriceX96` value. The
  conversion depends on both currencies' decimals, which this configurator does not
  resolve — see [Parameter Reference](./parameter-reference.md#poolstartingpriceratio).

## What This Schema Deliberately Omits

- **No `PermissionsAdapter` address field.** The adapter does not exist until the
  deployer's `createPermissionsAdapter` call creates it; this is a pre-deployment
  configuration, not a post-deployment record.
- **No private key, mnemonic, or any signing material of any kind.** Nothing in this
  schema is ever a credential.
- **No hardcoded chain allowlist.** See [Top-Level Key](#top-level-key).

## Related Reading

- [Parameter Reference](./parameter-reference.md) — what each field means, how to choose
  it, and what breaks if it is wrong.
- `permissioned-pools-issuer`'s
  [Contract Architecture](../../permissioned-pools-issuer/references/contract-architecture.md)
  and
  [Packaging and Sources](../../permissioned-pools-issuer/references/packaging-and-sources.md)
  — the contract facts and address-resolution order this schema assumes.
