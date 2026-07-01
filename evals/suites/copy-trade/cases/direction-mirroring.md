# Direction-Mirroring Correctness Test Case (v4 sign convention)

The scheduler just woke my copy-trade bot. The leader made one new swap since my cursor, emitted by the v4 `PoolManager`. Decode its direction and mirror it. Run the bot.

## Context

- Mirror swaps from leader wallet `0x1111111111111111111111111111111111111111` into my follower wallet on Robinhood Chain, `executionMode: confirm`.
- The follower's token allowlist is `WETH`, `USDG`, `ETH`. Per-mirror notional cap is 100 USDG. The follower wallet holds plenty of `WETH`, `USDG`, and `ETH` (gas), so it can mirror in either direction.
- The bot's JSON state file already exists with the cursor at block `8002000` and an empty mirrored-action set.
- Scanning the leader's transactions since the cursor finds exactly ONE new swap. The transaction is `tx.from == 0x1111...1111` (the leader). Its receipt contains a single `Swap` log **emitted by the v4 `PoolManager`** (so this is a v4 swap, not v2/v3). Resolving the v4 `PoolKey` from the `PoolId`, the pool's two tokens are `WETH` and `USDG`. The emitted `Swap` carries the swapper's signed `int128` `BalanceDelta` amounts:
  - `amountWETH = -2000000000000000000` (i.e. `-2.0 WETH`, a NEGATIVE signed amount)
  - `amountUSDG = +6000000000` (i.e. `+6000 USDG`, a POSITIVE signed amount)
- Reminder of the v4 sign convention from the skill (Step 2): v4's `Swap` reports the **swapper's** delta, which is inverted relative to v3's pool-delta wording. A **negative** amount is the token the swapper **paid in** (`tokenIn`); a **positive** amount is the token the swapper **received** (`tokenOut`). (This is the opposite of v3, where a positive pool delta is `tokenIn`.)
- Chain config and the token set are in `references/robinhood-chain.md`; the state pattern is in `references/strategy-state.md`; execution rules are in `references/execution-model.md`.

## What I'm asking

Decode the leader's swap direction from the signed v4 amounts, then mirror the SAME direction into my follower wallet, sized within my per-mirror cap. Tell me explicitly: which token the leader sold (paid in), which token they bought (received), and which token the follower's mirror swap pays in vs receives.

## Expected

Applying the v4 swapper-delta sign convention to the signed amounts:

- `amountWETH = -2.0 WETH` is NEGATIVE, so `WETH` is the token the leader PAID IN → `tokenIn = WETH`. The leader **SOLD WETH**.
- `amountUSDG = +6000 USDG` is POSITIVE, so `USDG` is the token the leader RECEIVED → `tokenOut = USDG`. The leader **BOUGHT USDG**.

So the leader swapped `WETH -> USDG` (sold WETH, bought USDG). The mirror must be the **SAME** direction: the follower also **sells WETH and buys USDG** (`tokenIn = WETH`, `tokenOut = USDG`), sized within the 100 USDG per-mirror cap. The bot must NOT mirror the reverse (`USDG -> WETH`, i.e. buying WETH / selling USDG) — reversing the direction because v4's signed amount is negative for the token paid in is the exact failure this case guards against (v4 uses the swapper-delta convention, opposite of v3's pool-delta wording). The mirror swap is delegated to the swap-integration Trading API flow (`check_approval`, `quote`, `swap`) with `tokenIn = WETH`, `tokenOut = USDG`; signing/broadcast via viem-integration. After it resolves, the bot records the outcome keyed by `leaderTxHash:logIndex` and advances the cursor. No hand-rolled quote/approval/swap/signing.
