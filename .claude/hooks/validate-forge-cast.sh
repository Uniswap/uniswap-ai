#!/usr/bin/env bash
# PreToolUse hook: validates forge/cast commands for security
# Receives tool input as JSON on stdin
#
# Security findings addressed:
#   H-2: Enforces programmatic validation for Bash(forge:*) and Bash(cast:*)
#        instead of relying solely on glob-based prefix matching.
#   M-2: Restricts cast to read-only subcommands only.
set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only process Bash tool calls
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# Skip if not a forge or cast command
if ! echo "$COMMAND" | grep -qE '^(forge|cast)\b'; then
  exit 0
fi

# Block --private-key in any forge/cast command
if echo "$COMMAND" | grep -qE -- '--private-key'; then
  echo '{"decision":"block","reason":"BLOCKED: --private-key flag detected. Use --account (encrypted keystore) or --ledger (hardware wallet) instead."}'
  exit 0
fi

# For cast commands: only allow read-only subcommands
if echo "$COMMAND" | grep -qE '^cast\b'; then
  SUBCOMMAND=$(echo "$COMMAND" | sed -E 's/^cast[[:space:]]+//' | awk '{for(i=1;i<=NF;i++) if($i !~ /^-/) {print $i; exit}}')

  # Read-only cast subcommands (no state changes, no transactions)
  ALLOWED_CAST="code abi-encode abi-decode call interface sig chain-id client block-number gas-price estimate lookup-address resolve-name namehash keccak etherscan-source 4byte 4byte-decode 4byte-event storage proof age balance tx receipt rpc logs to-ascii to-utf8 to-hex to-dec to-base to-wei from-wei wallet"

  if ! echo " $ALLOWED_CAST " | grep -q " $SUBCOMMAND "; then
    echo "{\"decision\":\"block\",\"reason\":\"BLOCKED: 'cast $SUBCOMMAND' is not in the allowed read-only subcommand list. Allowed: $ALLOWED_CAST\"}"
    exit 0
  fi
fi

# For forge commands: block direct contract creation (use forge script instead)
if echo "$COMMAND" | grep -qE '^forge\b'; then
  SUBCOMMAND=$(echo "$COMMAND" | sed -E 's/^forge[[:space:]]+//' | awk '{for(i=1;i<=NF;i++) if($i !~ /^-/) {print $i; exit}}')

  BLOCKED_FORGE="create"

  if echo " $BLOCKED_FORGE " | grep -q " $SUBCOMMAND "; then
    echo "{\"decision\":\"block\",\"reason\":\"BLOCKED: 'forge $SUBCOMMAND' is not allowed. Use 'forge script' for deployments instead.\"}"
    exit 0
  fi
fi

exit 0
