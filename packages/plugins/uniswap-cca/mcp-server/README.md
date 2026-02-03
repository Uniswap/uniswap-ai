# Uniswap Builder MCP Servers

This directory contains MCP (Model Context Protocol) servers for the uniswap-builder plugin.

## Structure

```text
mcp-server/
├── supply-schedule/    # CCA supply schedule generation
│   ├── server.py
│   ├── requirements.txt
│   ├── setup.sh
│   └── README.md
└── README.md           # This file
```

## Available Servers

### supply-schedule

Generates supply schedules for CCA (Continuous Clearing Auction) contracts.

**Tools:**

- `generate_supply_schedule`: Generate standard supply schedule

**Setup:**

```bash
cd supply-schedule
./setup.sh
```

**Requirements:**

- Python 3.10+
- pip3

## Adding New Servers

To add a new MCP server:

1. Create a new directory: `mcp-server/new-server/`
2. Add server implementation: `server.py` or `index.js`
3. Add dependencies: `requirements.txt` or `package.json`
4. Add setup script: `setup.sh`
5. Add documentation: `README.md`
6. Update `../.mcp.json` with new server configuration

Example `.mcp.json` entry:

```json
{
  "mcpServers": {
    "new-server-name": {
      "type": "stdio",
      "command": "python3",
      "args": ["-u", "mcp-server/new-server/server.py"],
      "env": {},
      "description": "Description of what this server does"
    }
  }
}
```

## Architecture

Each MCP server:

- Has a focused, single purpose
- Runs as an independent process
- Provides one or more related tools
- Can use different languages/dependencies

See [MCP Documentation](https://modelcontextprotocol.io/) for more details.
