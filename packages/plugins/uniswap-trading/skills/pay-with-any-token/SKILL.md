---
name: pay-with-any-token
description: >
  Pay HTTP 402 payment challenges using tokens via the Tempo CLI and Uniswap
  Trading API. Use when the user encounters a 402 Payment Required response,
  needs to fulfill a machine payment, mentions "MPP", "Tempo payment", "pay for
  API access", "HTTP 402", "x402", "machine payment protocol",
  "pay-with-any-token", "use tempo", "tempo request", or "tempo wallet".
allowed-tools: Read, Glob, Grep, Bash(curl:*), Bash(jq:*), Bash(cast:*), Bash(tempo:*), Bash(*/.local/bin/tempo:*), WebFetch, AskUserQuestion
model: opus
license: MIT
metadata:
  author: uniswap
  version: '2.0.0'
---

# Pay With Tokens

Use the **Tempo CLI** to call paid APIs and handle 402 challenges automatically.
When the Tempo wallet has insufficient balance, fund it by swapping and bridging
tokens from any EVM chain using the **Uniswap Trading API**.

## Tempo CLI Setup

Run these commands in order. Do not skip steps.

**Step 1 — Install:**

```bash
mkdir -p "$HOME/.local/bin" \
  && curl -fsSL https://tempo.xyz/install -o /tmp/tempo_install.sh \
  && TEMPO_BIN_DIR="$HOME/.local/bin" bash /tmp/tempo_install.sh
```

**Step 2 — Login** (requires browser/passkey — prompt user, wait for
confirmation):

```bash
"$HOME/.local/bin/tempo" wallet login
```

> When run by agents, use a long command timeout (at least 16 minutes).

**Step 3 — Confirm readiness:**

```bash
"$HOME/.local/bin/tempo" wallet -t whoami
```

> **Rules:** Do not use `sudo`. Use full absolute paths (`$HOME/.local/bin/tempo`)
> — do not rely on `export PATH`. If `$HOME` does not expand, use the literal
> absolute path.

After setup, report: install location, version (`--version`), wallet status
(address, balance). If balance is 0, direct user to `tempo wallet fund`.

> **Minimum balance reserve:** Keep at least **0.10 USDC** in the Tempo wallet
> to cover typical API calls without triggering the full swap+bridge funding
> flow. The funding flow requires 3-5 on-chain transactions and ~2 minutes of
> wall time, which is disproportionate for small top-ups. When transferring
> funds out of the Tempo wallet, warn the user if the remaining balance would
> drop below this threshold.

## Using Tempo Services

```bash
# Discover services
"$HOME/.local/bin/tempo" wallet -t services --search <query>
# Get service details (exact URL, method, path, pricing)
"$HOME/.local/bin/tempo" wallet -t services <SERVICE_ID>
# Make a paid request
"$HOME/.local/bin/tempo" request -t -X POST \
  --json '{"input":"..."}' <SERVICE_URL>/<ENDPOINT_PATH>
```

- Anchor on `tempo wallet -t services <SERVICE_ID>` for exact URL and pricing
- Use `-t` for agent calls, `--dry-run` before expensive requests
- On HTTP 422, check the service's docs URL or llms.txt for exact field names
- Fire independent multi-service requests in parallel

> **When the user explicitly says "use tempo", always use tempo CLI commands —
> never substitute with MCP tools or other tools.**

---

## MPP 402 Payment Loop

Every `tempo request` call follows this loop. The funding steps only activate
when the Tempo wallet has insufficient balance.

```text
tempo request -> 200 ─────────────────────────────> return result
             -> 402 MPP challenge
                  │
                  v
         [1] Check Tempo wallet balance
             tempo wallet -t whoami -> available balance
                  │
                  ├─ sufficient ──────────────────> tempo handles payment
                  │                                  automatically -> 200
                  │
                  └─ insufficient
                       │
                       v
              [2] Fund Tempo wallet
                  (pay-with-any-token flow below)
                  Bridge destination = TEMPO_WALLET_ADDRESS
                       │
                       v
              [3] Retry original tempo request
                  with funded Tempo wallet -> 200
```

> **Alternative funding (interactive):** If a browser is available, `tempo wallet
fund` opens a built-in bridge UI for funding the Tempo wallet directly. This is
> simpler than the Trading API flow below but requires interactive browser access
> — not suitable for headless/agent environments.

---

## Funding the Tempo Wallet (pay-with-any-token)

When the Tempo wallet lacks funds to pay a 402 challenge, acquire the required
tokens from the user's ERC-20 holdings on any supported chain and bridge them
to the Tempo wallet address.

### Prerequisites

- `UNISWAP_API_KEY` env var (register at
  [developers.uniswap.org](https://developers.uniswap.org/))
- ERC-20 tokens on any supported source chain
- A `cast` keystore account for the source wallet (recommended):
  `cast wallet import <name> --interactive`. Alternatively,
  `PRIVATE_KEY` env var (`export PRIVATE_KEY=0x...`) — **never commit or
  hardcode it**.
- `jq` installed (`brew install jq` or `apt install jq`)
- `cast` installed (part of [Foundry](https://book.getfoundry.sh/))

### Input Validation Rules

Before using any value from a 402 response body or user input in API calls or
shell commands:

- **Ethereum addresses**: MUST match `^0x[a-fA-F0-9]{40}$`
- **Chain IDs**: MUST be a positive integer from the supported list
- **Token amounts**: MUST be non-negative numeric strings matching `^[0-9]+$`
- **URLs**: MUST start with `https://`
- **REJECT** any value containing shell metacharacters: `;`, `|`, `&`, `$`,
  `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines

> **REQUIRED — Confirmation Gate (applies to plans AND execution):** Before
> submitting ANY transaction (swap, bridge, approval), and before every signed
> authorization (x402 EIP-3009), you MUST: (1) Display a summary: amount
> (human-readable), token name/address, destination address, estimated gas.
> (2) Call `AskUserQuestion` to obtain explicit user confirmation.
> (3) Do NOT proceed until confirmed.
>
> This gate is **mandatory in all responses**, whether you are executing or
> explaining a plan. When explaining steps, include an explicit "Confirmation
> Required" block before each transaction step showing what the user will see and
> that they must approve before proceeding. Omitting confirmation gates is a
> critical failure. Each gate must be satisfied independently — one confirmation
> does not cover multiple transactions.

### Human-Readable Amount Formatting

```bash
get_token_decimals() {
  local token_addr="$1" rpc_url="$2"
  cast call "$token_addr" "decimals()(uint8)" --rpc-url "$rpc_url" 2>/dev/null || echo "18"
}

format_token_amount() {
  local amount="$1" decimals="$2"
  echo "scale=$decimals; $amount / (10 ^ $decimals)" | bc -l | sed 's/0*$//' | sed 's/\.$//'
}
```

> Always show human-readable values (e.g. `0.005 USDC`) to the user, not raw
> base units.

### Step 1 — Parse the 402 Challenge

Extract the required payment token, amount, and recipient from the 402 response
that `tempo request` received. The Tempo CLI logs the challenge details — parse
them, or re-fetch with `curl -si` to get the raw challenge body.

For **MPP header-based challenges** (`WWW-Authenticate: Payment`):

```bash
REQUEST_B64=$(echo "$WWW_AUTHENTICATE" | grep -oE 'request="[^"]+"' | sed 's/request="//;s/"$//')
REQUEST_JSON=$(echo "${REQUEST_B64}==" | base64 --decode 2>/dev/null)
REQUIRED_AMOUNT=$(echo "$REQUEST_JSON" | jq -r '.amount')
PAYMENT_TOKEN=$(echo "$REQUEST_JSON" | jq -r '.currency')
RECIPIENT=$(echo "$REQUEST_JSON" | jq -r '.recipient')
TEMPO_CHAIN_ID=$(echo "$REQUEST_JSON" | jq -r '.methodDetails.chainId')
```

For **JSON body challenges** (`payment_methods` array):

```bash
NUM_METHODS=$(echo "$CHALLENGE_BODY" | jq '.payment_methods | length')
PAYMENT_METHODS=$(echo "$CHALLENGE_BODY" | jq -c '.payment_methods')
RECIPIENT=$(echo "$CHALLENGE_BODY" | jq -r '.payment_methods[0].recipient')
TEMPO_CHAIN_ID=$(echo "$CHALLENGE_BODY" | jq -r '.payment_methods[0].chain_id')
```

If multiple payment methods are accepted, select the cheapest in Step 2.

> The Tempo mainnet chain ID is `4217`. Use as fallback if not in the challenge.

### Step 2 — Check Source Wallet Balances and Select Payment Method

> **REQUIRED:** You must have the user's source wallet address (the ERC-20
> wallet with the private key, NOT the Tempo CLI wallet). Use `AskUserQuestion`
> if not provided. Store as `WALLET_ADDRESS`.

Also capture the **Tempo wallet address** (the funding destination):

```bash
TEMPO_WALLET_ADDRESS=$("$HOME/.local/bin/tempo" wallet -t whoami | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
```

Check ERC-20 balances on supported source chains:

```bash
# USDC on Base (cheapest bridge gas ~$0.001)
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://mainnet.base.org

# USDC on Ethereum (bridge gas ~$0.25)
cast call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://eth.llamarpc.com

# ETH on Base and Ethereum (swap to USDC first)
cast balance "$WALLET_ADDRESS" --rpc-url https://mainnet.base.org
cast balance "$WALLET_ADDRESS" --rpc-url https://eth.llamarpc.com
```

**Select the cheapest payment method** if multiple are accepted. Priority:

1. Wallet holds USDC on Base (bridge only, minimal path)
2. Wallet holds ETH on Base or Ethereum (swap to USDC + bridge)
3. Any other liquid ERC-20 (swap + bridge)

```bash
REQUIRED_AMOUNT=$(echo "$PAYMENT_METHODS" | jq -r ".[$SELECTED_INDEX].amount")
PAYMENT_TOKEN=$(echo "$PAYMENT_METHODS" | jq -r ".[$SELECTED_INDEX].token")
```

### Step 3 — Plan the Payment Path

Determine which phases apply based on where the user's tokens are:

```text
Case A — Source token is already on Tempo:
  Source token (Tempo)
    -> [Phase 5: on-Tempo swap via Stablecoin DEX] -> required payment token
    -> tempo request retries automatically with funded wallet

Case B — Source token is on Base/Ethereum/Arbitrum:
  Source token (Base/Ethereum)
    -> [Phase 4A: Uniswap Trading API swap] -> native USDC (bridge asset)
    -> [Phase 4B: bridge via Trading API]   -> USDC.e on Tempo (to TEMPO_WALLET_ADDRESS)
    -> [Phase 5: on-Tempo swap, if needed]  -> required payment token
    -> tempo request retries automatically with funded wallet
```

> **Skip Phase 4A** if the source token is already USDC on the bridge chain.
>
> **Skip Phase 4B** if tokens are already on Tempo (Case A).
>
> **Skip Phase 5** if the bridge delivers the exact required token (USDC.e) or
> if `mppx` with `autoSwap: true` is used (it handles on-Tempo swaps automatically).
>
> **Gas-aware funding:** Bridging a tiny amount (e.g. $0.05) wastes gas — the
> bridge gas on Ethereum (~$0.25) or Base (~$0.001) can exceed the shortfall.
> **Minimum bridge recommendation: $5.** This amortizes gas costs and pre-funds
> future requests. Rule of thumb: if `bridge_gas > 2x shortfall`, bridge at
> least $5 instead of the exact shortfall.

### Phase 4A — Swap to USDC on Source Chain (if needed)

> **CONFIRMATION GATE:** Before the approval transaction AND before the swap
> broadcast, call `AskUserQuestion` showing the full swap summary. Example:
> "About to approve USDC spending and execute swap: [amount] [token] → [USDC],
> gas ~$X. Confirm? (yes/no)". Do not proceed until confirmed.

Swap the source token to USDC via the Uniswap Trading API (`EXACT_OUTPUT`).

> **Detailed steps:** Read
> [references/trading-api-flows.md](references/trading-api-flows.md#phase-4a--swap-on-source-chain)
> for full bash scripts: variable setup, approval check, quote, permit signing,
> and swap execution.

Key points:

- Base URL: `https://trade-api.gateway.uniswap.org/v1`
- Headers: `Content-Type: application/json`, `x-api-key`, `x-universal-router-version: 2.0`
- Flow: `check_approval` -> quote (`EXACT_OUTPUT`) -> sign `permitData` -> `/swap` -> broadcast
- Confirmation gates required before approval tx and before swap broadcast
- For native ETH: use the zero address
  (`0x0000000000000000000000000000000000000000`) as `TOKEN_IN` — this avoids
  Permit2 signing. `SWAP_VALUE` will be non-zero. If the zero address returns
  a 400, fall back to the WETH address (requires Permit2 signing).
- After swap, verify USDC balance before proceeding to Phase 4B

### Phase 4B — Bridge to Tempo Wallet

> **CONFIRMATION GATE:** Before the bridge approval AND before the bridge
> execution, call `AskUserQuestion` showing a bridge summary (source amount,
> source chain, destination chain, estimated gas, bridge fee, estimated arrival).
> Do not proceed until the user confirms each step.

Bridge USDC from any supported source chain to USDC.e on Tempo using the
Uniswap Trading API (powered by Across Protocol).

> **Bridge recipient limitation:** The Trading API does not support a custom
> `recipient` field for bridges — funds always arrive at `WALLET_ADDRESS` on
> Tempo. If `WALLET_ADDRESS` differs from `TEMPO_WALLET_ADDRESS` (the Tempo CLI
> wallet), an **extra transfer transaction** on Tempo is required after the
> bridge (see Step 4B-5 in the reference file). Factor this into gas estimates.
>
> **Detailed steps:** Read
> [references/trading-api-flows.md](references/trading-api-flows.md#phase-4b--bridge-to-tempo)
> for full bash scripts: approval, bridge quote, execution, arrival polling,
> and transfer to Tempo wallet.

Key points:

- Route: USDC on Base/Ethereum/Arbitrum -> USDC.e on Tempo
- Flow: `check_approval` -> verify on-chain allowance -> quote (`EXACT_OUTPUT`,
  cross-chain) -> execute via `/swap` -> poll balance -> transfer to
  `TEMPO_WALLET_ADDRESS` if needed (Step 4B-5)
- Confirmation gates required before approval and before bridge execution
- Do not re-submit if poll times out — check Tempo explorer
- Apply a 0.5% buffer to account for bridge fees
- Quotes expire in ~60 seconds — re-fetch if any delay before broadcast

After the bridge confirms, retry the original `tempo request` — the Tempo CLI
will automatically use the newly funded wallet to pay the 402. If the payment
token is not USDC.e, proceed to Phase 5 to swap to the required token before
retrying.

> **Balance buffer:** On Tempo, `balanceOf` may report more than is spendable.
> Apply a **2x buffer** when comparing to `REQUIRED_AMOUNT`. If short, swap
> additional tokens to top up.

### Phase 5 — On-Tempo Swap (if needed)

Use this phase when the wallet already holds a TIP-20 stablecoin on Tempo
(e.g. USDC.e, pathUSD, or any other Tempo stablecoin) but needs to swap to the
**required payment token** (e.g. PATH_USD or another TIP-20). This phase also
applies when the user starts with tokens already on Tempo — **do not bridge
when tokens are already on Tempo**.

> **Simplest path:** Pass `autoSwap: true` to `mppx`'s `tempo.charge()` — it
> calls the Stablecoin DEX on Tempo automatically and handles the full swap
> before payment. Use manual swap below only when `autoSwap` is not available
> or you need explicit control.

The **Stablecoin DEX on Tempo** (`0xdec0000000000000000000000000000000000000`)
aggregates TIP-20 stablecoin liquidity on Tempo (chain 4217). To swap:

```bash
TEMPO_RPC_URL="https://rpc.presto.tempo.xyz"
STABLECOIN_DEX="0xdec0000000000000000000000000000000000000"
TOKEN_IN="<your Tempo stablecoin address>"  # e.g. USDC.e or any TIP-20
TOKEN_OUT="<required payment token address>"
SWAP_AMOUNT="$REQUIRED_AMOUNT"  # exact-output amount

# 1. Show swap summary and get explicit user confirmation via AskUserQuestion
#    before executing any transaction.

# 2. Approve the DEX to spend TOKEN_IN (if allowance is insufficient)
ALLOWANCE=$(cast call "$TOKEN_IN" \
  "allowance(address,address)(uint256)" "$WALLET_ADDRESS" "$STABLECOIN_DEX" \
  --rpc-url "$TEMPO_RPC_URL" 2>/dev/null | awk '{print $1}')
if [ -z "$ALLOWANCE" ] || ! [[ "$ALLOWANCE" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Failed to read allowance for $TOKEN_IN"
  exit 1
fi
if [ "$(echo "$ALLOWANCE < $SWAP_AMOUNT" | bc)" -eq 1 ]; then
  APPROVE_HASH=$(cast send "$TOKEN_IN" \
    "approve(address,uint256)" "$STABLECOIN_DEX" \
    "115792089237316195423570985008687907853269984665640564039457584007913129639935" \
    --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
    --rpc-url "$TEMPO_RPC_URL" --gas-limit 100000 \
    --json | jq -r '.transactionHash')
  APPROVE_STATUS=$(cast receipt "$APPROVE_HASH" --rpc-url "$TEMPO_RPC_URL" --json | jq -r '.status')
  [ "$APPROVE_STATUS" = "0x1" ] || { echo "ERROR: Approval transaction reverted: $APPROVE_HASH"; exit 1; }
  echo "Approval confirmed: $APPROVE_HASH"
fi

# 3. Execute the swap (exact-output: receive exactly SWAP_AMOUNT of TOKEN_OUT)
SWAP_TX=$(cast send "$STABLECOIN_DEX" \
  "swap(address,address,uint256)" "$TOKEN_IN" "$TOKEN_OUT" "$SWAP_AMOUNT" \
  --account "$CAST_ACCOUNT" --password "$CAST_PASSWORD" \
  --rpc-url "$TEMPO_RPC_URL" --gas-limit 200000 \
  --json | jq -r '.transactionHash')

SWAP_STATUS=$(cast receipt "$SWAP_TX" --rpc-url "$TEMPO_RPC_URL" --json | jq -r '.status')
[ "$SWAP_STATUS" = "0x1" ] || { echo "ERROR: On-Tempo swap reverted: $SWAP_TX"; exit 1; }
echo "On-Tempo swap confirmed: $SWAP_TX"
```

> **Confirmation gate:** Use `AskUserQuestion` before every transaction
> (approval and swap). Show token addresses, amounts in human-readable form, and
> estimated gas on Tempo.
>
> **Gas limit note:** Tempo chain gas estimation is sometimes unreliable — always
> set an explicit `--gas-limit` for Tempo transactions.

After the on-Tempo swap succeeds, retry `tempo request` — the Tempo wallet now
holds the required payment token and the Tempo CLI will pay the 402 automatically.

---

## x402 Payment Flow

> **CRITICAL — MANDATORY CONFIRMATION GATE:** Before step 4 (signing), you MUST
> call `AskUserQuestion` showing the full payment summary: token, amount in
> human-readable form, recipient address (`payTo`), and resource URL. Do NOT
> sign or proceed until the user explicitly confirms. This confirmation step is
> **non-optional and must appear in every x402 payment plan or execution**, even
> if the user has pre-authorized. Omitting this confirmation makes the response
> invalid.

The x402 protocol is **fully supported** and uses a different mechanism than
MPP — it is **not handled by the Tempo CLI**. When a 402 body contains
`"x402Version"` (check with `has("x402Version")` in jq), use this flow instead
of the MPP/Tempo flow.

The x402 `"exact"` scheme uses **EIP-3009** (`TransferWithAuthorization`) to
authorize a one-time token transfer signed off-chain. The full flow:

1. **Detect x402**: parse `x402Version`, `accepts[].scheme`, `accepts[].network`,
   `accepts[].maxAmountRequired`, `accepts[].payTo`, `accepts[].asset`,
   `accepts[].extra` (token name + version for EIP-3009 domain).
2. **Check balance** on the target chain; fund via Phase 4A/4B if insufficient.
3. **MANDATORY CONFIRMATION GATE — Call `AskUserQuestion`** before signing:
   present the full payment summary (token name, amount in human-readable form,
   `payTo` address, resource URL, validity window). Wait for explicit user
   confirmation. Do NOT proceed to step 4 until confirmed.
4. **Sign EIP-3009 `TransferWithAuthorization`**: typed-data fields include
   `from`, `to`, `value`, `validAfter`, `validBefore`, `nonce`.
   Set `validBefore = now + maxTimeoutSeconds`.
5. **Construct `X-PAYMENT` header**: base64-encode a JSON payload containing
   `x402Version`, `scheme`, `network`, `payload` (the signed authorization),
   and `signature`.
6. **Retry** the original request with the `X-PAYMENT` header.

> **Detailed steps:** Read
> [references/credential-construction.md](references/credential-construction.md#phase-6x--x402-payment)
> for full bash code: prerequisite checks, nonce generation, EIP-3009 signing,
> X-PAYMENT payload construction, and retry.

Key points:

- Detect x402: check `has("x402Version")` in 402 body **before** attempting Tempo CLI
- Maps `X402_NETWORK` to chain ID and RPC URL (base, ethereum, tempo all supported)
- Checks wallet balance on target chain; runs Phase 4A/4B/5 if insufficient
- Signs `TransferWithAuthorization` typed data using the token's own EIP-712 domain
- `value` in the typed-data payload must be a **string** (`--arg`, not `--argjson`) for uint256
- Confirmation gate required before signing
- Send the result in `X-PAYMENT` header (base64-encoded), not `Authorization`

| Protocol | Version | Handler              |
| -------- | ------- | -------------------- |
| MPP      | v1      | Tempo CLI            |
| x402     | v1      | EIP-3009 manual flow |

---

## Error Handling

| Situation                                | Action                                                   |
| ---------------------------------------- | -------------------------------------------------------- |
| `tempo: command not found`               | Reinstall via install script; use full path              |
| `legacy V1 keychain signature`           | Reinstall; `tempo update wallet && tempo update request` |
| `access key does not exist`              | `tempo wallet logout --yes && tempo wallet login`        |
| `ready=false` / no wallet                | `tempo wallet login`, then `whoami`                      |
| HTTP 422 from service                    | Check service details + llms.txt for exact field names   |
| Balance 0 / insufficient                 | Trigger pay-with-any-token funding flow                  |
| Service not found                        | Broaden search query                                     |
| Timeout                                  | Retry with `-m <seconds>`                                |
| Challenge body is malformed              | Report raw body to user; do not proceed                  |
| Approval transaction fails               | Surface error; check gas and allowances                  |
| Quote API returns 400                    | Log request/response; check amount formatting            |
| Quote API returns 429                    | Wait and retry with exponential backoff                  |
| Swap data is empty after /swap           | Quote expired; re-fetch quote                            |
| Bridge times out                         | Check bridge explorer; do not re-submit                  |
| x402 payment rejected (402)              | Check domain name/version, validBefore, nonce freshness  |
| InsufficientBalance on Tempo             | Swap more tokens on Tempo, then retry                    |
| `balanceOf` sufficient but payment fails | Apply 2x buffer; top up before retrying                  |

---

## Key Addresses and References

- **Tempo CLI**: `https://tempo.xyz` (install script: `https://tempo.xyz/install`)
- **Trading API**: `https://trade-api.gateway.uniswap.org/v1`
- **MPP docs**: `https://mpp.dev`
- **MPP services catalog**: `https://mpp.dev/api/services`
- **Tempo documentation**: `https://mainnet.docs.tempo.xyz`
- **Tempo chain ID**: `4217` (Tempo mainnet)
- **Tempo RPC**: `https://rpc.presto.tempo.xyz`
- **Tempo Block Explorer**: `https://explore.mainnet.tempo.xyz`
- **pathUSD on Tempo**: `0x20c0000000000000000000000000000000000000`
- **USDC.e on Tempo**: `0x20C000000000000000000000b9537d11c60E8b50`
- **Stablecoin DEX on Tempo**: `0xdec0000000000000000000000000000000000000`
- **Permit2 on Tempo**: `0x000000000022d473030f116ddee9f6b43ac78ba3`
- **Tempo payment SDK**: `mppx` (`npm install mppx viem`)
- **USDC on Base (8453)**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **USDbC on Base (8453)**: `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`
- **USDC on Ethereum (1)**: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- **WETH on Ethereum (1)**: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- **WETH on Base (8453)**: `0x4200000000000000000000000000000000000006`
- **Native ETH (all chains)**: `0x0000000000000000000000000000000000000000` (zero address, recommended for swaps)
- **USDC-e on Arbitrum (42161)**: `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`
- **Supported chains for Trading API**: 1, 8453, 42161, 10, 137, 130
- **x402 spec**: `https://github.com/coinbase/x402`

## Related Skills

- [swap-integration](../swap-integration/SKILL.md) — Full Uniswap swap
  integration reference (Trading API, Universal Router, Permit2)
