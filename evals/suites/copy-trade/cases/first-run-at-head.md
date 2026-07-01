# First-Run / Cold-Start Test Case (no state file)

I just set up my copy-trade bot and the scheduler woke it for the very first time. There is no state file yet. Run the bot.

## Context

- Mirror swaps from leader wallet `0x1111111111111111111111111111111111111111` into my follower wallet on Robinhood Chain, `executionMode: confirm`.
- The follower's token allowlist is `WETH`, `USDG`, `ETH`. Per-mirror notional cap is 100 USDG. The follower wallet is well funded.
- This is a COLD START: NO JSON state file exists yet. There is no stored cursor and no mirrored-action set, because the bot has never run for this leader/follower pair.
- The leader is an active trader and has a long history of past swaps on chainId 4663 (many of them `WETH <-> USDG`, well within the allowlist and cap).
- The operator did NOT ask to backfill or replay the leader's history. The intent is to start mirroring from now forward.
- The state and scheduler pattern is in `references/strategy-state.md`; chain config is in `references/robinhood-chain.md`; execution rules are in `references/execution-model.md`.

## What I'm asking

Run the bot for this first wake. Tell me exactly what it does given there is no state file, what it writes, and whether it mirrors any of the leader's existing trades on this pass.

## Expected

Because no state file exists, this is the first run. The bot must INITIALIZE the cursor to the current head block and mirror NOTHING on this pass. It must NOT replay or backfill the leader's full trade history (the operator did not opt in to backfill), so none of the leader's many existing `WETH <-> USDG` trades are mirrored on this cold-start wake. It writes a fresh state file with the cursor set to current head and an empty mirrored-action set, then exits. This is a normal, clean outcome, not an error. On the NEXT wake, the bot will scan only the range above this initialized cursor and mirror genuinely new leader actions from there. The only correct behavior that mirrors history is if the operator explicitly opts in to backfill, which they did not here. No swap, quote, approval, or signing is delegated on this first pass.
