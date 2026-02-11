#!/usr/bin/env python3
"""
CCA Supply Schedule MCP Server

This MCP server provides tools for generating supply schedules for
Continuous Clearing Auction (CCA) contracts using a normalized convex curve.
"""

import json
import logging
from typing import Any, Optional

from mcp.server import Server
from mcp.types import Tool, TextContent
from pydantic import BaseModel, Field

from logic import (
    generate_schedule,
    encode_supply_schedule,
    TOTAL_TARGET,
    DEFAULT_NUM_STEPS,
    DEFAULT_FINAL_BLOCK_PCT,
    DEFAULT_ALPHA,
)

# Configure logging to stderr (not stdout for STDIO servers)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("cca-supply-schedule")


class GenerateScheduleInput(BaseModel):
    """Input parameters for generate_supply_schedule tool."""
    auction_blocks: int = Field(
        description="Total number of blocks for the auction (e.g., 86400 for 2 days on Base)",
        gt=0
    )
    prebid_blocks: int = Field(
        default=0,
        description="Number of blocks for prebid period with 0 mps (default: 0)",
        ge=0
    )
    num_steps: int = Field(
        default=DEFAULT_NUM_STEPS,
        description=f"Number of steps for gradual release (default: {DEFAULT_NUM_STEPS})",
        gt=0
    )
    final_block_pct: float = Field(
        default=DEFAULT_FINAL_BLOCK_PCT,
        description=f"Percentage of supply for final block (default: {DEFAULT_FINAL_BLOCK_PCT}, range: 0.1-0.9)",
        gt=0.1,
        lt=0.9
    )
    alpha: float = Field(
        default=DEFAULT_ALPHA,
        description=f"Convexity exponent for curve C(t) = t^alpha (default: {DEFAULT_ALPHA})",
        gt=0
    )
    round_to_nearest: Optional[int] = Field(
        default=None,
        description="Round block boundaries to nearest N blocks (e.g., 100). None = no rounding",
        ge=1
    )


class EncodeScheduleInput(BaseModel):
    """Input parameters for encode_supply_schedule tool."""
    schedule: list[dict[str, int]] = Field(
        description="Supply schedule as array of {mps, blockDelta} objects"
    )


# Create MCP server instance
server = Server("cca-supply-schedule")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="generate_supply_schedule",
            description=(
                "Generate a CCA (Continuous Clearing Auction) supply schedule using a normalized convex curve. "
                f"The schedule distributes supply equally across {DEFAULT_NUM_STEPS} steps (configurable) with "
                f"time durations that DECREASE over time (convex curve property). Each step releases equal token amounts. "
                f"Approximately {DEFAULT_FINAL_BLOCK_PCT*100}% of supply is reserved for the final block. "
                "Returns an array of {mps, blockDelta} objects. "
                "MPS = milli-basis points (1e7 = 10 million), representing tokens per block."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "auction_blocks": {
                        "type": "integer",
                        "description": "Total number of blocks for the auction (e.g., 86400 for 2 days on Base with 2s blocks)",
                        "minimum": 1
                    },
                    "prebid_blocks": {
                        "type": "integer",
                        "description": "Number of blocks for prebid period with 0 mps (default: 0)",
                        "minimum": 0,
                        "default": 0
                    },
                    "num_steps": {
                        "type": "integer",
                        "description": f"Number of steps for gradual release (default: {DEFAULT_NUM_STEPS})",
                        "minimum": 1,
                        "default": DEFAULT_NUM_STEPS
                    },
                    "final_block_pct": {
                        "type": "number",
                        "description": f"Percentage of supply for final block as decimal (default: {DEFAULT_FINAL_BLOCK_PCT}, range: 0.1-0.9)",
                        "minimum": 0.1,
                        "maximum": 0.9,
                        "default": DEFAULT_FINAL_BLOCK_PCT
                    },
                    "alpha": {
                        "type": "number",
                        "description": f"Convexity exponent for curve C(t) = t^alpha (default: {DEFAULT_ALPHA})",
                        "minimum": 0,
                        "default": DEFAULT_ALPHA
                    },
                    "round_to_nearest": {
                        "type": "integer",
                        "description": "Round block boundaries to nearest N blocks (e.g., 100). Omit for no rounding.",
                        "minimum": 1
                    }
                },
                "required": ["auction_blocks"]
            }
        ),
        Tool(
            name="encode_supply_schedule",
            description=(
                "Encode a CCA supply schedule to bytes for onchain deployment. "
                "For each {mps, blockDelta} element, creates a uint64 where the first 24 bits are mps "
                "and the next 40 bits are blockDelta. All uint64s are packed together (like Solidity's abi.encodePacked). "
                "Returns a hex string with 0x prefix. This encoded bytes string is passed to the Factory's "
                "initializeDistribution function as part of the configData parameter."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "schedule": {
                        "type": "array",
                        "description": "Supply schedule as array of {mps, blockDelta} objects",
                        "items": {
                            "type": "object",
                            "properties": {
                                "mps": {
                                    "type": "integer",
                                    "description": "Tokens per block (max: 16777215 for 24-bit)",
                                    "minimum": 0,
                                    "maximum": 16777215
                                },
                                "blockDelta": {
                                    "type": "integer",
                                    "description": "Number of blocks (max: 1099511627775 for 40-bit)",
                                    "minimum": 0,
                                    "maximum": 1099511627775
                                }
                            },
                            "required": ["mps", "blockDelta"]
                        }
                    }
                },
                "required": ["schedule"]
            }
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls."""
    if name == "generate_supply_schedule":
        try:
            # Validate input
            input_data = GenerateScheduleInput(**arguments)

            # Generate schedule
            schedule = generate_schedule(
                auction_blocks=input_data.auction_blocks,
                prebid_blocks=input_data.prebid_blocks,
                num_steps=input_data.num_steps,
                final_block_pct=input_data.final_block_pct,
                alpha=input_data.alpha,
                round_to_nearest=input_data.round_to_nearest
            )

            # Calculate summary statistics
            total_mps = sum(item["mps"] * item["blockDelta"] for item in schedule)
            final_block_mps = schedule[-1]["mps"]
            final_block_percentage = (final_block_mps / TOTAL_TARGET) * 100

            # Format output
            output = {
                "schedule": schedule,
                "auction_blocks": input_data.auction_blocks,
                "prebid_blocks": input_data.prebid_blocks,
                "total_phases": len(schedule),
                "summary": {
                    "total_mps": total_mps,
                    "target_mps": TOTAL_TARGET,
                    "final_block_mps": final_block_mps,
                    "final_block_percentage": round(final_block_percentage, 2),
                    "num_steps": input_data.num_steps,
                    "alpha": input_data.alpha,
                    "main_supply_pct": round((1.0 - input_data.final_block_pct) * 100, 2),
                    "step_tokens_pct": round((1.0 - input_data.final_block_pct) / input_data.num_steps * 100, 4)
                }
            }

            return [
                TextContent(
                    type="text",
                    text=json.dumps(output, indent=2)
                )
            ]
        except Exception as e:
            logger.error(f"Error generating supply schedule: {e}", exc_info=True)
            return [
                TextContent(
                    type="text",
                    text=json.dumps({
                        "error": str(e),
                        "message": "Failed to generate supply schedule"
                    })
                )
            ]

    elif name == "encode_supply_schedule":
        try:
            # Validate input
            input_data = EncodeScheduleInput(**arguments)

            # Encode schedule
            encoded = encode_supply_schedule(input_data.schedule)

            # Calculate output statistics
            length_bytes = (len(encoded) - 2) // 2  # Subtract '0x' and divide by 2 (2 hex chars per byte)
            num_elements = len(input_data.schedule)

            # Format output
            output = {
                "encoded": encoded,
                "length_bytes": length_bytes,
                "num_elements": num_elements
            }

            return [
                TextContent(
                    type="text",
                    text=json.dumps(output, indent=2)
                )
            ]
        except Exception as e:
            logger.error(f"Error encoding supply schedule: {e}", exc_info=True)
            return [
                TextContent(
                    type="text",
                    text=json.dumps({
                        "error": str(e),
                        "message": "Failed to encode supply schedule"
                    })
                )
            ]

    else:
        raise ValueError(f"Unknown tool: {name}")


async def main():
    """Run the MCP server."""
    from mcp.server.stdio import stdio_server

    async with stdio_server() as (read_stream, write_stream):
        logger.info("CCA Supply Schedule MCP Server starting...")
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
