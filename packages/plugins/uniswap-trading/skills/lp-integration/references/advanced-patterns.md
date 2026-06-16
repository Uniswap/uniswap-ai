# LP API: Advanced Patterns

Deep-dive material referenced from `SKILL.md`. Use this when an integration moves past a basic create/increase/decrease/claim flow.

## Permit and Approval Deep Dive

`/lp/check_approval` returns one or more of:

- `transactions: ApprovalTransactionRequest[]` — onchain ERC-20 / NFT approvals to sign and broadcast. Each is `{ transaction, cancelApproval, action, gasFee? }`. Sign `element.transaction`.
- `v4BatchPermitData?: NullablePermit` — a v4 batch permit (EIP-712 typed data) for a gasless approval.
- `v3NftPermitData?: NullablePermit` — a v3 `NonfungiblePositionManager` NFT permit.

`NullablePermit` shape: `{ domain, values, types }` (all objects). `domain` and `types` feed an EIP-712 typed-data signature; `values` is the message.

### v4 batch permit, signed with viem

```ts
import { type WalletClient } from 'viem';

async function signV4Permit(walletClient: WalletClient, v4BatchPermitData: any): Promise<string> {
  return walletClient.signTypedData({
    account: walletClient.account!,
    domain: v4BatchPermitData.domain,
    types: v4BatchPermitData.types,
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

Some signing libraries require an explicit `EIP712Domain` type in the `types` object. If a signature is rejected onchain, inject it:

```ts
const typesWithDomain = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  ...permitData.types,
};
```

### Permit-as-transaction fallback

If you pass `generatePermitAsTransaction: true` to `/lp/check_approval`, the permit comes back as a standard executable transaction inside `transactions` instead of typed data. Use this when the wallet cannot sign EIP-712 typed data.

## Migration (v3 to v4)

Migration moves liquidity from a v3 pool to a v4 pool within the same pair. There is no dedicated `/lp/migrate` path in the current OpenAPI contract; migration is driven through the approval action:

1. Call `/lp/check_approval` with `action: "MIGRATE"` to obtain the approvals/permits required for the migration.
2. Follow the migration transaction-building flow the LP team documents for your protocol versions.

> **Confirm with the LP team:** the public integration guide references a `/lp/migrate` endpoint, but the OpenAPI spec from PR #6934 does not include it. Verify whether migration is a standalone endpoint or is handled via `action: "MIGRATE"` before building a migration flow.

## NFT Position Manager Quirks

- v3 and v4 concentrated positions are ERC-721 NFTs. `increase` / `decrease` identify the position by `nftTokenId`; `claim_fees` uses `tokenId`; `check_approval` uses `v3NftTokenId` (integer). Same concept, three field names.
- `token0Address` / `token1Address` on `increase` / `decrease` MUST match the canonical order in the existing position. Passing them reversed produces a mismatched dependent amount or a not-found error.
- For v3, calling `/lp/decrease` automatically bundles uncollected fees into the withdrawal (via the SDK's `removeCallParameters`). Returned amounts may exceed the pro-rata liquidity. Do not also call `/lp/claim_fees` for the same v3 decrease.
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
