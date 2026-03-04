#!/usr/bin/env bash
# PreToolUse hook: validates forge/cast commands for security
# Receives tool input as JSON on stdin
#
# Security threats blocked:
#   - --private-key flag anywhere in the command
#   - Raw hex private keys (0x + 64 hex chars) anywhere in the command
#   - forge create (use forge script for deployments instead)
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

# Block raw hex private keys (0x followed by 64 hex characters) anywhere in the command
if echo "$COMMAND" | grep -qE '0x[0-9a-fA-F]{64}'; then
  echo '{"decision":"block","reason":"BLOCKED: Raw hex private key detected (0x + 64 hex chars). Use --account (encrypted keystore) or --ledger (hardware wallet) instead."}'
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
