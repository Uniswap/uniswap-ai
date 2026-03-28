#!/usr/bin/env bash
# PreToolUse hook: validates forge/cast commands for security
# Receives tool input as JSON on stdin
#
# Security threats blocked:
#   - --private-key flag anywhere in the command
#   - Raw 64-char hex strings (broad detection) unless in a known-safe context
#   - forge create (use forge script for deployments instead)
#
# Allowlisted contexts (known false positives for the 64-char hex check):
#   - cast receipt/tx/block -- argument is a transaction hash
#   - --data/--calldata flags -- hex is ABI-encoded calldata
#   - cast call -- read-only, no signing
#   - cast send <40-char-address> -- 64-char hex after address is calldata
#
# Bypass mitigations:
#   - Strips leading env var assignments (VAR=val prefixes)
#   - Resolves base binary name (strips absolute/relative paths)
#   - Scans the ENTIRE command for dangerous patterns (not just prefix)
set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only process Bash tool calls
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# --- Global checks: scan the ENTIRE command for dangerous patterns ---
# These apply regardless of what binary is being invoked, to catch
# semicolon chains, subshells, pipes, etc.

PK_FLAG="--private-key"
# Block --private-key flag anywhere in the command
if echo "$COMMAND" | grep -qF -- "$PK_FLAG"; then
  echo '{"decision":"block","reason":"BLOCKED: --private-key flag detected. Use --account (encrypted keystore) or --ledger (hardware wallet) instead."}'
  exit 0
fi

# Block raw 64-char hex values (broad detection) with allowlist for known safe contexts.
# Private keys, raw key strings, and exfiltration payloads all match 0x[0-9a-fA-F]{64}.
# We keep the broad check and carve out specific patterns that are never private keys.
if echo "$COMMAND" | grep -qE '0x[0-9a-fA-F]{64}'; then
  # Allowlist: tx hash lookup -- cast receipt/tx/block take a tx hash as argument
  if echo "$COMMAND" | grep -qE 'cast[[:space:]]+(receipt|tx|block)[[:space:]]'; then
    : # allow -- hex is a transaction hash, not a private key
  # Allowlist: explicit calldata/data flag -- hex is ABI-encoded calldata
  elif echo "$COMMAND" | grep -qE '--(data|calldata)[[:space:]]'; then
    : # allow -- hex is calldata passed via an explicit flag
  # Allowlist: cast call (read-only eth_call, no signing required)
  elif echo "$COMMAND" | grep -qE 'cast[[:space:]]+call[[:space:]]'; then
    : # allow -- cast call is read-only and cannot expose a private key
  # Allowlist: cast send with a 40-char address -- hex after address is calldata
  elif echo "$COMMAND" | grep -qE 'cast[[:space:]]+send[[:space:]]+0x[0-9a-fA-F]{40}[[:space:]]'; then
    : # allow -- 64-char hex following the target address is calldata, not a key
  else
    echo '{"decision":"block","reason":"BLOCKED: Raw 64-char hex detected -- possible private key exposure. Use --account (encrypted keystore) or --ledger (hardware wallet) instead."}'
    exit 0
  fi
fi

# --- Command-specific checks ---
# Strip leading env var assignments: FOO=bar BAZ="qux" command args -> command args
STRIPPED_COMMAND=$(echo "$COMMAND" | sed -E 's/^([A-Za-z_][A-Za-z_0-9]*=(["'"'"'][^"'"'"']*["'"'"']|[^ ]*) +)+//')

# Extract the first word (the binary) and resolve its base name
BINARY=$(echo "$STRIPPED_COMMAND" | awk '{print $1}')
BASE_BINARY=$(basename "$BINARY" 2>/dev/null || echo "$BINARY")

# Check if this is a forge or cast command (after normalization)
case "$BASE_BINARY" in
  forge)
    # Block forge create - must use forge script for deployments
    SUBCOMMAND=$(echo "$STRIPPED_COMMAND" | awk '{for(i=2;i<=NF;i++) if($i !~ /^-/) {print $i; exit}}')
    if [ "$SUBCOMMAND" = "create" ]; then
      echo '{"decision":"block","reason":"BLOCKED: '\''forge create'\'' is not allowed. Use '\''forge script'\'' for deployments instead."}'
      exit 0
    fi
    ;;
  cast)
    # cast send is allowed (deployer needs it for post-deployment onTokensReceived)
    # The global flag and raw hex key checks above protect against key exposure
    ;;
  *)
    # Not a forge/cast command at the top level - nothing more to check
    ;;
esac

exit 0
