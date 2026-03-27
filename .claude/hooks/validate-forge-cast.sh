#!/usr/bin/env bash
# PreToolUse hook: validates forge/cast commands for security
# Receives tool input as JSON on stdin
#
# Security threats blocked:
#   - --private-key flag anywhere in the command
#   - Raw hex private keys in key-assignment contexts (PRIVATE_KEY=0x...)
#   - Raw hex private keys piped to wallet import commands
#   - forge create (use forge script for deployments instead)
#
# Intentionally NOT blocked (prior false positives):
#   - Transaction hashes (0x + 64 hex chars) in cast receipt, variable assignments
#   - Calldata / ABI-encoded data in cast send commands
#   - Hex data written to temp files
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
# semicolon chains, subshells, pipes, etc. like: echo ok; cast send --private-key ...

# Block --private-key flag anywhere in the command
if echo "$COMMAND" | grep -qF -- '--private-key'; then
  echo '{"decision":"block","reason":"BLOCKED: --private-key flag detected. Use --account (encrypted keystore) or --ledger (hardware wallet) instead."}'
  exit 0
fi

# Block raw hex private keys in contexts that indicate key usage.
# Previous check was too broad (0x + 64 hex chars) — it false-positived on tx hashes,
# calldata, ABI-encoded data, and other normal EVM hex strings.
# Now only blocks key-assignment patterns and key-piping to wallet commands.

# 1) Key in variable assignment: KEY=0x..., export KEY=0x..., PRIVATE_KEY="0x..."
if echo "$COMMAND" | grep -qiE '(private.?key|secret.?key|signing.?key)\s*=\s*["\x27]?0x[0-9a-fA-F]{64}\b'; then
  echo '{"decision":"block","reason":"BLOCKED: Raw hex private key in variable assignment. Use --account (encrypted keystore) or --ledger (hardware wallet) instead."}'
  exit 0
fi

# 2) Piping/heredoc of raw hex into wallet import commands
if echo "$COMMAND" | grep -qE '0x[0-9a-fA-F]{64}' && echo "$COMMAND" | grep -qE '(cast|forge)\s+wallet\s+import'; then
  echo '{"decision":"block","reason":"BLOCKED: Raw hex private key being passed to wallet import. Use --interactive flag instead."}'
  exit 0
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
    # The global --private-key and raw hex key checks above protect against key exposure
    ;;
  *)
    # Not a forge/cast command at the top level - nothing more to check
    ;;
esac

exit 0
