#!/bin/bash
# Setup script for CCA Supply Schedule MCP Server

set -e

echo "Setting up CCA Supply Schedule MCP Server..."

# Check Python version
python3 --version || {
    echo "Error: Python 3 is required but not found."
    echo "Please install Python 3.10 or later."
    exit 1
}

# Install dependencies
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

echo ""
echo "✓ Setup complete!"
echo ""
echo "The MCP server is now ready to use."
echo "It will be automatically started by Claude Code when the plugin is loaded."
