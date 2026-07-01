# Multi-Hop Route Collapse Test Case (one net intent, not two mirrors)

The scheduler just woke my copy-trade bot. The leader made one new transaction since my cursor, and its receipt has TWO `Swap` logs. Decode it and mirror it. Run the bot.

## Context

- Mirror swaps from leader wallet `0x1111111111111111111111111111111111111111` into my follower wallet on Robinhood Chain, `executionMode: confirm`.
- The operator's token allowlist for this leader is `USDG`, `WETH`, `ETH`, and `AAAx` (the operator explicitly added the RWA `AAAx` to their allowlist; assume `AAAx` resolves on chainId 4663 and is tradable for this case). Asset resolvability and listing of `AAAx` are out of scope here; only the route-collapse behavior is tested. Per-mirror notional cap is 100 USDG of notional. The follower wallet is well funded.
- The bot's JSON state file already exists with the cursor at block `8003000` and an empty mirrored-action set.
- Scanning the leader's transactions since the cursor finds exactly ONE new transaction where `tx.from == 0x1111...1111` (the leader): `leaderTxHash = 0xroute01`, `blockNumber = 8003050`. Its receipt contains TWO `Swap` logs forming a single route:
  - `logIndex 0`: leg A on a `USDG/WETH` pool — leader pays in `USDG`, receives `WETH`. Decoded leg: `{ tokenIn: USDG, tokenOut: WETH, amountIn: 60 USDG, amountOut: 0.02 WETH }`.
  - `logIndex 1`: leg B on a `WETH/AAAx` pool — leader pays in `WETH`, receives `AAAx`. Decoded leg: `{ tokenIn: WETH, tokenOut: AAAx, amountIn: 0.02 WETH, amountOut: 5 AAAx }`.
- Leg A's `tokenOut` (`WETH`) equals leg B's `tokenIn` (`WETH`), so these two legs chain into one route `USDG -> WETH -> AAAx`. `WETH` is the intermediate token, not an endpoint the leader actually wanted to hold.
- The route-collapse rule from the skill (Step 2): chain legs by matching `tokenOut -> tokenIn` within the same tx in `logIndex` order; a maximal chain collapses to ONE net intent (`tokenIn` = first leg's `tokenIn`, `tokenOut` = last leg's `tokenOut`), and the intermediate legs are dropped. The whole route is keyed at the transaction level by `leaderTxHash` so it mirrors at most once.
- Chain config and the token set are in `references/robinhood-chain.md`; the state pattern is in `references/strategy-state.md`; execution rules are in `references/execution-model.md`.

## What I'm asking

Run the bot for this wake. The one new leader transaction has two `Swap` logs. Tell me exactly what the bot mirrors: how many mirror swaps it produces, what `tokenIn`/`tokenOut` each mirror uses, and what it does with the intermediate `WETH` leg.

## Expected

The two `Swap` logs chain into a single route (`USDG -> WETH -> AAAx`), so the bot collapses them to ONE net intent: `tokenIn = USDG`, `tokenOut = AAAx`, `amountIn = 60 USDG` (the first leg's `amountIn`), `amountOut = 5 AAAx` (the last leg's `amountOut`), sized within the per-mirror cap. It produces exactly ONE mirror, `USDG -> AAAx`. The bot must NOT mirror the intermediate leg (`USDG -> WETH` or `WETH -> AAAx`) on its own, and must NOT produce TWO mirrors — mirroring both legs would wrongly buy the intermediate `WETH` and then spend it again (double-counting and acquiring an asset the leader never meant to hold). The single net intent is keyed at the transaction level by `leaderTxHash` (`0xroute01`), so the whole route mirrors at most once even if the range is re-scanned. The mirror is delegated to the swap-integration Trading API flow (`check_approval`, `quote`, `swap`) with `tokenIn = USDG`, `tokenOut = AAAx`; signing/broadcast via viem-integration. After it resolves, the bot records the outcome and advances the cursor. No hand-rolled quote/approval/swap/signing.
