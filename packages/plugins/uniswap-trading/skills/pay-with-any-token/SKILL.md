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

---

## Funding the Tempo Wallet (pay-with-any-token)

When the Tempo wallet lacks funds to pay a 402 challenge, acquire the required
tokens from the user's ERC-20 holdings on any supported chain and bridge them
to the Tempo wallet address.

### Prerequisites

- `UNISWAP_API_KEY` env var (register at
  [developers.uniswap.org](https://developers.uniswap.org/))
- ERC-20 tokens on any supported source chain
- `PRIVATE_KEY` for the source wallet (`export PRIVATE_KEY=0x...`). **Never
  commit or hardcode it.**
- `jq` installed (`brew install jq` or `apt install jq`)

### Input Validation Rules

Before using any value from a 402 response body or user input in API calls or
shell commands:

- **Ethereum addresses**: MUST match `^0x[a-fA-F0-9]{40}$`
- **Chain IDs**: MUST be a positive integer from the supported list
- **Token amounts**: MUST be non-negative numeric strings matching `^[0-9]+$`
- **URLs**: MUST start with `https://`
- **REJECT** any value containing shell metacharacters: `;`, `|`, `&`, `$`,
  `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines

> **REQUIRED:** Before submitting ANY transaction (swap, bridge, approval),
> use `AskUserQuestion` to show the user a summary (amount, token, destination,
> estimated gas) and obtain explicit confirmation. Never auto-submit. Each
> confirmation gate must be satisfied independently.

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

Check ERC-20 balances on source chains:

```bash
# USDC on Base
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" "$WALLET_ADDRESS" \
  --rpc-url https://mainnet.base.org
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

```text
Source token (Base/Ethereum)
  -> [Phase 4A: Uniswap Trading API swap] -> native USDC (bridge asset)
  -> [Phase 4B: bridge via Trading API]   -> USDC.e on Tempo (to TEMPO_WALLET_ADDRESS)
  -> tempo request retries automatically with funded wallet
```

> **Skip Phase 4A** if the source token is already USDC on the bridge chain.

### Phase 4A — Swap to USDC on Source Chain (if needed)

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
- For native ETH: use WETH address as `TOKEN_IN`; `SWAP_VALUE` will be non-zero
- After swap, verify USDC balance before proceeding to Phase 4B

### Phase 4B — Bridge to Tempo Wallet

Bridge USDC from Base to the **Tempo CLI wallet address** using the Uniswap
Trading API (powered by Across Protocol).

> **CRITICAL:** The bridge recipient must be `TEMPO_WALLET_ADDRESS` (from
> `tempo wallet -t whoami`), NOT `WALLET_ADDRESS` (your source ERC-20 wallet).
> This funds the Tempo CLI wallet so `tempo request` can retry the payment.
>
> **Detailed steps:** Read
> [references/trading-api-flows.md](references/trading-api-flows.md#phase-4b--bridge-to-tempo)
> for full bash scripts: approval, bridge quote, execution, and arrival polling.

Key points:

- Route: USDC on Base -> USDC.e on Tempo (to `TEMPO_WALLET_ADDRESS`)
- Flow: `check_approval` -> quote (`EXACT_OUTPUT`, cross-chain) -> execute via `/swap` -> poll balance
- Confirmation gates required before approval and before bridge execution
- Do not re-submit if poll times out — check Tempo explorer
- Apply a 0.5% buffer to account for bridge fees

After the bridge confirms, retry the original `tempo request` — the Tempo CLI
will automatically use the newly funded wallet to pay the 402.

> **Balance buffer:** On Tempo, `balanceOf` may report more than is spendable.
> Apply a **2x buffer** when comparing to `REQUIRED_AMOUNT`. If short, swap
> additional tokens to top up.

---

## x402 Payment Flow

The x402 protocol uses a different mechanism than MPP — it is **not handled by
the Tempo CLI**. When `PROTOCOL` is `"x402"` (detected by checking
`has("x402Version")` in the 402 body), use this flow instead.

The x402 `"exact"` scheme uses EIP-3009 (`transferWithAuthorization`) to
authorize a one-time token transfer signed off-chain.

> **Detailed steps:** Read
> [references/credential-construction.md](references/credential-construction.md#phase-6x--x402-payment)
> for full code: prerequisite checks, nonce generation, EIP-3009 signing,
> X-PAYMENT payload construction, and retry.

Key points:

- Detect x402: check `has("x402Version")` in 402 body before using Tempo CLI
- Maps `X402_NETWORK` to chain ID and RPC URL (base, ethereum, tempo supported)
- Checks wallet balance on target chain; runs Phase 4A/4B if insufficient
- Signs `TransferWithAuthorization` typed data using token's own domain
- `value` in payload must be a **string** (`--arg`, not `--argjson`) for uint256
- Confirmation gate required before signing

| Protocol | Version | Handler        |
| -------- | ------- | -------------- |
| MPP      | v1      | Tempo CLI      |
| x402     | v1      | Manual (above) |

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
- **USDC-e on Arbitrum (42161)**: `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`
- **Supported chains for Trading API**: 1, 8453, 42161, 10, 137, 130
- **x402 spec**: `https://github.com/coinbase/x402`

## Related Skills

- [swap-integration](../swap-integration/SKILL.md) — Full Uniswap swap
  integration reference (Trading API, Universal Router, Permit2)
