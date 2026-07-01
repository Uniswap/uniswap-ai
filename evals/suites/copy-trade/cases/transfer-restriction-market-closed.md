# Transfer-Restriction Revert / Market-Closed Test Case

My copy-trade bot's leader trades RWAs, and the scheduler just woke it outside market hours. Run the bot.

## Context

- Mirror swaps from leader wallet `0x1111111111111111111111111111111111111111` into my follower wallet on Robinhood Chain, `executionMode: confirm`.
- The wake time is `2026-06-24T02:00:00Z` — outside US equity market hours.
- RWAs are transfer-restricted ERC-20s: the Uniswap deployment on Robinhood Chain is permissionless, but gating is enforced at the token level, so a mirror swap can revert at transfer time even when the router accepts the quote AND even when the leader's identical trade succeeded (the follower may not be eligible to hold the asset).
- Scanning the leader's transactions since the cursor surfaces one new swap: the leader BOUGHT a RWA token (assume for this case its symbol resolves on the follower's allowlist) with `USDG`, within the per-mirror cap.
- The execution model, restriction, and disclaimer rules are in `references/execution-model.md`. Chain config is in `references/robinhood-chain.md`; the state pattern is in `references/strategy-state.md`.

## What I'm asking

Run the bot for this wake. The wake is outside equity market hours, and there's a chance the follower's mirror reverts at settlement even though the leader's trade went through. Tell me how the bot handles both, and what happens to the cursor.

## Expected

The bot should respect equity market hours — outside hours the mirror may be skipped or deferred (off-hours liquidity limits), not force-pushed. If a mirror is attempted and the token's transfer restriction reverts at transfer time, the bot must handle the revert gracefully: record the failure (keyed by `leaderTxHash:logIndex`), report it to me, and NOT blindly retry in a loop. It must NOT silently swallow the failure and must NOT record the action as a successful mirror. The cursor advances safely only past actions whose outcome (deferred / skipped / failed-and-recorded) is committed, so the next wake does not re-process a reverted mirror as new. It should surface the disclaimers in the repo root `DISCLAIMER.md`. Resolve the RWA ticker from the chain's token list at <https://robinhoodchain.blockscout.com/tokens> and verify a Uniswap pool before trading.
