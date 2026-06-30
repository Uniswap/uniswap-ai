# LP API: Advanced Patterns

Deep-dive material referenced from `SKILL.md`. Use this when an integration moves past a basic create/increase/decrease/claim flow.

## Permit and Approval Deep Dive

`/lp/check_approval` returns one or more of:

- `transactions: ApprovalTransactionRequest[]` — onchain ERC-20 / NFT approvals to sign and broadcast. Each is `{ transaction, cancelApproval, action, gasFee? }`. Sign `element.transaction`.
- `v4BatchPermitData?: NullablePermit` — a v4 batch permit (EIP-712 typed data) for a gasless approval. It can be returned **together with** onchain `transactions` (ERC-20 → Permit2 approvals), not only instead of them — execute those approvals first.
- `v3NftPermitData?: NullablePermit` — a v3 `NonfungiblePositionManager` NFT permit.

`NullablePermit` shape: `{ domain, values, types }`. **Caution — the JSON is proto-encoded, not viem-ready:** `domain.chainId` is the chain **enum name** (e.g. `"UNICHAIN"`) rather than a number, and each `types` entry is wrapped as `{ fields: [...] }` instead of a bare `[...]` array. Normalize both before passing to `signTypedData` (see below); `values` is the EIP-712 message and can be used as-is.

### v4 batch permit, signed with viem

```ts
import { type WalletClient } from 'viem';

// chainId is the NUMERIC chain id (e.g. 130) — NOT the `"UNICHAIN"` enum-name string the API returns.
async function signV4Permit(
  walletClient: WalletClient,
  v4BatchPermitData: any,
  chainId: number
): Promise<string> {
  // Unwrap each `{ fields: [...] }` into the bare array viem expects.
  const types = Object.fromEntries(
    Object.entries(v4BatchPermitData.types).map(([k, v]) => [k, (v as any).fields])
  );
  return walletClient.signTypedData({
    account: walletClient.account!,
    domain: { ...v4BatchPermitData.domain, chainId }, // override the "UNICHAIN" string with a number
    types,
    primaryType: 'PermitBatch', // confirm the primaryType key your permit uses
    message: v4BatchPermitData.values,
  });
}
```

Pass the result back into the LP action. The field name differs by endpoint:

```ts
// /lp/create expects `batchPermitData`
const createBody = { ...createParams, batchPermitData: v4BatchPermitData, signature };

// /lp/increase expects `v4BatchPermitData`
const increaseBody = { ...increaseParams, v4BatchPermitData, signature };
```

### v3 NFT permit

For v3 positions, `check_approval` may return `v3NftPermitData` for the `NonfungiblePositionManager`. Sign it the same way as the v4 permit and pass it through in the call your flow requires.

### EIP712Domain edge case

Some signing libraries require an explicit `EIP712Domain` type in the `types` object. If a signature is rejected, inject it — but match the domain's actual fields, and spread the **unwrapped** types (`.fields` already stripped, per above), not the raw proto shape. Note the Permit2 domain is `{ name, chainId, verifyingContract }` with **no `version`**, so omit the `version` entry unless `domain.version` is actually present:

```ts
const typesWithDomain = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    // include `{ name: 'version', type: 'string' }` ONLY if domain.version exists (Permit2 has none)
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  ...types, // the unwrapped types object, not the raw permitData.types
};
```

### Permit-as-transaction fallback

If you pass `generatePermitAsTransaction: true` to `/lp/check_approval`, the permit comes back as a standard executable transaction inside `transactions` instead of typed data. Use this when the wallet cannot sign EIP-712 typed data.

## Migration

Migration moves liquidity between protocol versions within the same pair (e.g. v3 → v4). The current LP API has **no REST `/lp/migrate` endpoint** (confirmed against the live `liquidity.api.uniswap.org` service); migration begins at `/lp/check_approval`:

1. Call `/lp/check_approval` with `action: "MIGRATE"` to obtain the approvals/permits required for the migration.
2. Build and execute the migration transaction. The migrate operations exist in the service's gRPC/Connect contract (`MigrateV2ToV3LPPosition`; a separate `MigrateV3ToV4LPPosition` lives only on the older v1 service) but are **not** exposed under a clean `/lp/*` REST alias, so confirm the supported migration path and its transaction-building flow with the LP team before building it.

> The older `trade-api.gateway.uniswap.org/v1` LP surface _did_ expose a standalone `POST /lp/migrate`; the newer `liquidity.api.uniswap.org` API does not. Do not port a `/lp/migrate` call from the old guide.

## NFT Position Manager Quirks

- v3 and v4 concentrated positions are ERC-721 NFTs. `increase` / `decrease` identify the position by `nftTokenId`; `claim_fees` uses `tokenId`; `check_approval` uses `v3NftTokenId` (integer). Same concept, three field names.
- `token0Address` / `token1Address` on `increase` / `decrease` MUST match the canonical order in the existing position. Passing them reversed produces a mismatched dependent amount or a not-found error.
- For v3, the `decrease` calldata automatically bundles uncollected fees into the withdrawal (via the SDK's `removeCallParameters`), so do not also call `/lp/claim_fees` for the same v3 decrease. The response `token0` / `token1` amounts reflect only the pro-rata liquidity removed; the swept fees are encoded in the calldata, not added to those amounts.
- For v4 fee claims, the API generates a zero-liquidity decrease via the v4 `PositionManager` followed by `TAKE_PAIR` to sweep fees.

## v4 Hooks in newPool

When creating a v4 position in a new pool, `newPool` accepts an optional `hooks` address. Hook compatibility (lifecycle permissions, fee behavior) is the caller's responsibility. Validate the hook address (`^0x[a-fA-F0-9]{40}$`) and confirm it is a hook the user trusts before generating the transaction. See the **uniswap-hooks** plugin for hook semantics.

## Error Recovery and Reliability

### Retry with exponential backoff

```ts
async function lpFetchWithRetry(
  baseUrl: string,
  path: string,
  body: object,
  apiKey: string,
  maxRetries = 3
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        continue;
      }
    }
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  throw new Error('Max retries exceeded');
}
```

### Cache repeated reads

`/lp/pool_info` and repeated `check_approval` calls for the same position can be cached briefly to avoid 429s:

```ts
const cache = new Map<string, { data: unknown; at: number }>();
async function cachedRead(key: string, fetcher: () => Promise<unknown>, ttlMs = 15_000) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const data = await fetcher();
  cache.set(key, { data, at: Date.now() });
  return data;
}
```

### Pre-broadcast checklist

Before broadcasting any LP transaction:

1. `data` is a non-empty hex string (not `''` or `'0x'`).
2. `to` and `from` are valid checksummed addresses.
3. Not both `maxFeePerGas` and `gasPrice` are set.
4. The user holds sufficient token and native balances at broadcast time.
5. The transaction was built within the freshness window (refetch if stale).
6. Approvals are still in place (re-run `/lp/check_approval` if in doubt — a prior approval may have been consumed).
7. The user has explicitly confirmed the action via AskUserQuestion.

### Transaction revert triage

If a transaction reverts onchain: re-check approvals, confirm the quote has not gone stale, verify slippage tolerance for the pair's volatility, check the deadline encoded in the calldata, and rule out a nonce collision.

## Monitoring

Track per-attempt metrics (endpoint, protocol, chainId, txHash, success, error, `requestId` from the response) so failures can be correlated with the API's `requestId` when reporting issues to the LP team.
