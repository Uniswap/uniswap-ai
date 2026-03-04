#!/usr/bin/env bash
# PreToolUse hook: validates open/xdg-open commands
# Only allows app.uniswap.org URLs to be opened automatically.
#
# Security finding addressed:
#   M-1: Restricts Bash(open:*) and Bash(xdg-open:*) to app.uniswap.org
#        domain only, preventing arbitrary URL opening.
#
# Bypass mitigations:
#   - Strips leading env var assignments (VAR=val prefixes)
#   - Resolves base binary name (strips absolute/relative paths)
set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only process Bash tool calls
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# Strip leading env var assignments: FOO=bar command args -> command args
STRIPPED_COMMAND=$(echo "$COMMAND" | sed -E 's/^([A-Za-z_][A-Za-z_0-9]*=(["'"'"'][^"'"'"']*["'"'"']|[^ ]*) +)+//')

# Extract the first word (the binary) and resolve its base name
BINARY=$(echo "$STRIPPED_COMMAND" | awk '{print $1}')
BASE_BINARY=$(basename "$BINARY" 2>/dev/null || echo "$BINARY")

# Only check open/xdg-open commands
if [ "$BASE_BINARY" != "open" ] && [ "$BASE_BINARY" != "xdg-open" ]; then
  exit 0
fi

# Extract URL from the command
URL=$(echo "$COMMAND" | grep -oE 'https?://[^ "'"'"']+' | head -1)

if [ -z "$URL" ]; then
  echo '{"decision":"block","reason":"BLOCKED: No URL found in open command."}'
  exit 0
fi

# Allow app.uniswap.org
if echo "$URL" | grep -qE '^https://app\.uniswap\.org(/|$|\?)'; then
  exit 0
fi

echo "{\"decision\":\"block\",\"reason\":\"BLOCKED: URL is not on the app.uniswap.org domain. Only https://app.uniswap.org/* URLs can be opened automatically.\"}"
exit 0
