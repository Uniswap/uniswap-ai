#!/bin/bash
# Setup script for CCA Supply Schedule MCP Server

set -e

echo "Setting up CCA Supply Schedule MCP Server..."

# Check Python 3.10+ is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not found."
    echo "Please install Python 3.10 or later."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')

if [ "$PYTHON_MAJOR" -lt 3 ] || { [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]; }; then
    echo "Error: Python 3.10+ required, found Python $PYTHON_VERSION"
    exit 1
fi

echo "Found Python $PYTHON_VERSION"

# Install dependencies
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

echo ""
echo "✓ Setup complete!"
echo ""
echo "The MCP server is now ready to use."
echo "It will be automatically started by Claude Code when the plugin is loaded."
