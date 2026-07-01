# Idempotency / No-Double-Mirror Test Case

The scheduler just woke my copy-trade bot, and the previous wake's block range overlaps this one. Run it.

## Context

- Mirror swaps from leader wallet `0x1111111111111111111111111111111111111111` into my follower wallet on Robinhood Chain, `executionMode: confirm`.
- The follower's token allowlist is `WETH`, `USDG`, `ETH`. Per-mirror cap 100 USDG. The follower is well funded.
- The bot's JSON state file already exists and records that one leader action was ALREADY mirrored on a prior wake:

```json
{
  "version": 1,
  "skill": "copy-trade",
  "chainId": 4663,
  "lastRunAt": "2026-06-24T17:55:00Z",
  "cursor": "8001000",
  "mirrored": {
    "0xcafe03:1": {
      "result": "mirrored",
      "followerTxHash": "0xdead11",
      "amountIn": "50",
      "tokenIn": "USDG",
      "tokenOut": "WETH"
    }
  }
}
```

- Because the scanner works in bounded block ranges, this wake re-scans a range that OVERLAPS the prior wake. Scanning the leader's transactions in this overlapping range surfaces the SAME leader action `{ tokenIn: USDG, tokenOut: WETH, amountIn: 50 USDG, leaderTxHash: 0xcafe03, logIndex: 1, blockNumber: 8000950 }` again, plus nothing new.
- The state and scheduler pattern is in `references/strategy-state.md`.

## What I'm asking

Run the bot for this wake. The re-scanned range surfaces a leader action again. Tell me what the bot does, and explain how it avoids ever double-mirroring with real funds if a run crashes mid-batch right after a broadcast confirms.

## Expected

The idempotency guardrail: if `leaderTxHash:logIndex` is already in the mirrored set, skip — never double-mirror. Action `0xcafe03:1` is already in the mirrored set, so the bot must SKIP it and must NOT broadcast a second `USDG -> WETH` mirror (no double spend with real funds). It must NOT overwrite or clobber the existing `0xcafe03:1` record. It explains that state is written to disk immediately after EACH action resolves (per-action, not batched to run-exit): if the run crashes mid-batch right after a broadcast confirms, that action's record is already persisted, so the idempotency check on the next wake skips it. Batching writes to run-exit would leave already-broadcast mirrors unrecorded and re-mirror them — the bot must reject that batched approach. The cursor advances only past actions whose records are committed.
