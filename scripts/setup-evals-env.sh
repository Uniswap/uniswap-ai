#!/usr/bin/env bash
#
# Setup evals environment with secrets from 1Password
#
# Usage:
#   ./scripts/setup-evals-env.sh
#
# Prerequisites:
#   - 1Password CLI installed: https://developer.1password.com/docs/cli/get-started
#   - Signed in: `op signin` or `eval $(op signin)`
#

set -euo pipefail

# 1Password item containing the .env as a note
OP_ITEM="uniswap/uniswap-ai/evals/.env"

# Output file
ENV_FILE="evals/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check if 1Password CLI is installed
if ! command -v op &> /dev/null; then
    log_error "1Password CLI (op) is not installed"
    echo ""
    echo "Install it from: https://developer.1password.com/docs/cli/get-started"
    echo ""
    echo "  macOS:   brew install 1password-cli"
    echo "  Linux:   See docs for your distro"
    exit 1
fi

# Check if signed in to 1Password
if ! op account list &> /dev/null; then
    log_error "Not signed in to 1Password"
    echo ""
    echo "Sign in with: eval \$(op signin)"
    exit 1
fi

log_info "1Password CLI authenticated"

# Create evals directory if it doesn't exist
mkdir -p evals

# Fetch the .env content from 1Password note
echo "Fetching .env from 1Password..."
op item get "$OP_ITEM" --fields notesPlain --format json | jq -r '.value' > "$ENV_FILE" 2>/dev/null || {
    log_error "Failed to read .env from 1Password"
    echo ""
    echo "Make sure you have access to: $OP_ITEM"
    echo ""
    echo "To verify, run:"
    echo "  op item get '$OP_ITEM'"
    exit 1
}

log_info "Created $ENV_FILE"

# Verify .env is gitignored
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
    log_warn ".env may not be gitignored - verify before committing!"
fi

echo ""
log_info "Setup complete! You can now run evals:"
echo "  nx run evals:eval --suite=aggregator-hook-creator"
