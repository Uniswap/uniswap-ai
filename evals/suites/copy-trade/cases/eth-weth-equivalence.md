# ETH/WETH Equivalence Test Case (do not falsely skip on asset-match)

The scheduler just woke my copy-trade bot. The leader made one new swap since my cursor that involved native ETH. Decode it and mirror it. Run the bot.

## Context

- Mirror swaps from leader wallet `0x1111111111111111111111111111111111111111` into my follower wallet on Robinhood Chain, `executionMode: confirm`.
- The follower's token allowlist is exactly `ETH`, `USDG` (the operator listed native `ETH`, NOT `WETH`, in the allowlist). Per-mirror notional cap is 100 USDG. The follower wallet is well funded with both `ETH` and `USDG`.
- The bot's JSON state file already exists with the cursor at block `8004000` and an empty mirrored-action set.
- The leader's swap paid in NATIVE `ETH` (the router wrapped it). Because pool `Swap` logs always reference the ERC-20 `WETH` (a native-ETH leg is a router wrap and emits no ERC-20 `ETH` Swap event), the decoded leg is `{ tokenIn: WETH, tokenOut: USDG, amountIn: 0.03 WETH, amountOut: 90 USDG, leaderTxHash: 0xeth001, logIndex: 0, blockNumber: 8004050 }`. The leg decodes as `WETH` even though the leader supplied native `ETH`.
- The ETH/WETH rule from the skill (Step 2 / Step 3): pool logs always reference the ERC-20 `WETH`; `ETH` and `WETH` are equivalent for the asset-match guardrail. A leg decoded as `WETH` satisfies an `ETH` allowlist entry (apply the ETH/WETH normalization rule in `execution-model.md` before comparing), so a `WETH`-decoded leg is never falsely skipped against an `ETH` entry. The execution form (native `ETH` vs wrapped `WETH`, and any wrap/unwrap) is owned by the swap-integration Trading API path, not chosen by this skill.
- Chain config and the token set are in `references/robinhood-chain.md`; the state pattern is in `references/strategy-state.md`; execution rules are in `references/execution-model.md`.

## What I'm asking

Run the bot for this wake. The leader's leg decodes as `WETH` but my allowlist lists `ETH`, not `WETH`. Tell me whether the bot mirrors this swap or skips it, and why, and which token it hands to the swap-integration flow.

## Expected

The bot must treat `ETH` and `WETH` as EQUIVALENT for the asset-match guardrail. The leg decoded as `WETH` satisfies the follower's `ETH` allowlist entry, so the asset-match guardrail PASSES for both `tokenIn` (`WETH`, equivalent to the allowlisted `ETH`) and `tokenOut` (`USDG`, allowlisted). The bot must NOT falsely skip this swap on a `WETH`-vs-`ETH` mismatch — that false skip is the exact failure this case guards against. The bot mirrors the SAME direction (sell ETH/WETH, buy USDG), sized within the 100 USDG cap. The mirror is delegated to the swap-integration Trading API flow (`check_approval`, `quote`, `swap`); the skill passes the canonicalized token and lets the Trading API choose the execution form (native `ETH` vs wrapped `WETH`, and any wrap/unwrap) — the skill does NOT hand-roll a wrap/unwrap and does NOT assume the follower mirror must use the exact form the leader used. After it resolves, the bot records the outcome keyed by `leaderTxHash` (a single-leg swap, so no sub-index) and advances the cursor. No hand-rolled quote/approval/swap/signing.
