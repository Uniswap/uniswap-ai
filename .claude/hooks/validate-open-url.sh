#!/usr/bin/env bash
# PreToolUse hook: validates open/xdg-open commands
# Only allows app.uniswap.org URLs to be opened automatically.
#
# Security finding addressed:
#   M-1: Restricts Bash(open:*) and Bash(xdg-open:*) to app.uniswap.org
#        domain only, preventing arbitrary URL opening.
set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only process Bash tool calls
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# Only check open/xdg-open commands
if ! echo "$COMMAND" | grep -qE '^(open|xdg-open)\b'; then
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
