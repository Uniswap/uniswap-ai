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

# Configure logging to stderr (not stdout for STDIO servers)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("cca-supply-schedule")

# Target total supply in mps units
TOTAL_TARGET = 10_000_000  # 1e7

# Default configuration (from Notion doc)
DEFAULT_NUM_STEPS = 12  # Number of steps for gradual release
DEFAULT_FINAL_BLOCK_PCT = 0.30  # ~30% reserved for final block
DEFAULT_ALPHA = 1.2  # Convexity exponent for normalized curve C(t) = t^alpha


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
        description=f"Percentage of supply for final block (default: {DEFAULT_FINAL_BLOCK_PCT})",
        gt=0,
        lt=1
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


def generate_schedule(
    auction_blocks: int,
    prebid_blocks: int = 0,
    num_steps: int = DEFAULT_NUM_STEPS,
    final_block_pct: float = DEFAULT_FINAL_BLOCK_PCT,
    alpha: float = DEFAULT_ALPHA,
    round_to_nearest: Optional[int] = None
) -> list[dict[str, int]]:
    """
    Generate supply schedule using normalized convex curve.

    Algorithm:
        1. Reserve final_block_pct (default 30%) for final block
        2. Distribute remaining supply equally across num_steps (default 12)
        3. Each step releases EQUAL token amounts
        4. Time boundaries calculated from normalized curve C(t) = t^alpha
        5. Block durations DECREASE over time (convex curve property)
        6. Optional rounding of block boundaries to round numbers

    The key insight: equal token amounts + convex supply curve = decreasing time intervals.

    Args:
        auction_blocks: Total number of blocks for the auction
        prebid_blocks: Number of blocks for prebid period (0 mps)
        num_steps: Number of steps for gradual release (default: 12)
        final_block_pct: Percentage of supply for final block (default: 0.30)
        alpha: Convexity exponent for curve C(t) = t^alpha (default: 1.2)
        round_to_nearest: Round block boundaries to nearest N blocks (optional)

    Returns:
        List of dicts with 'mps' and 'blockDelta' keys
    """
    schedule = []

    # Add prebid period if specified
    if prebid_blocks > 0:
        schedule.append({"mps": 0, "blockDelta": prebid_blocks})

    # Calculate token amount per step (equal distribution)
    main_supply_pct = 1.0 - final_block_pct  # e.g., 0.70 for 30% final block
    step_tokens_pct = main_supply_pct / num_steps  # e.g., 0.70 / 12 = 0.058333...

    # Calculate time boundaries from normalized curve C(t) = t^alpha
    # For each step i, we want cumulative supply = i * step_tokens_pct
    # Since C(t) = t^alpha, inverse is t = (cumulative_pct)^(1/alpha)
    time_boundaries = [0.0]  # t_0 = 0
    for i in range(1, num_steps + 1):
        # Cumulative percentage at step i (normalized to main supply)
        cum_pct = i * step_tokens_pct / main_supply_pct
        # Inverse of C(t) = t^alpha gives time boundary
        t_i = cum_pct ** (1.0 / alpha)
        time_boundaries.append(t_i)

    # Convert normalized times [0,1] to block numbers [0, auction_blocks]
    block_boundaries = [round(t * auction_blocks) for t in time_boundaries]

    # Optional rounding to nearest N blocks (Step 2 in Notion doc)
    if round_to_nearest is not None and round_to_nearest > 0:
        block_boundaries = [
            round(b / round_to_nearest) * round_to_nearest
            for b in block_boundaries
        ]
        # Ensure last boundary is exactly auction_blocks
        block_boundaries[-1] = auction_blocks

    # Generate schedule for each step
    cumulative_tokens = 0
    for i in range(num_steps):
        start_block = block_boundaries[i]
        end_block = block_boundaries[i + 1]
        duration = end_block - start_block

        # Each step gets EQUAL token amount
        step_tokens = step_tokens_pct * TOTAL_TARGET

        # Calculate MPS (tokens per block)
        if duration > 0:
            mps = round(step_tokens / duration)
            # Ensure at least 1 mps
            mps = max(1, mps)
        else:
            # Edge case: zero duration (shouldn't happen with proper inputs)
            mps = 0

        schedule.append({"mps": mps, "blockDelta": duration})
        cumulative_tokens += mps * duration

    # Final block gets remainder to hit exactly TOTAL_TARGET
    final_tokens = TOTAL_TARGET - cumulative_tokens
    schedule.append({"mps": final_tokens, "blockDelta": 1})

    return schedule


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
                        "description": f"Percentage of supply for final block as decimal (default: {DEFAULT_FINAL_BLOCK_PCT})",
                        "minimum": 0,
                        "maximum": 1,
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
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls."""
    if name != "generate_supply_schedule":
        raise ValueError(f"Unknown tool: {name}")

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

        # Calculate main supply (excluding prebid and final block)
        main_phases = [item for item in schedule if item != schedule[0] or input_data.prebid_blocks == 0]
        if main_phases:
            main_phases = main_phases[:-1]  # Exclude final block

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
