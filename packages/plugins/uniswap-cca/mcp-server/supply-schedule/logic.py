#!/usr/bin/env python3
"""
CCA Supply Schedule - Core Logic

Pure logic for generating and encoding supply schedules for
Continuous Clearing Auction (CCA) contracts using a normalized convex curve.

This module has no external dependencies (no mcp, no pydantic) so it can be
tested without installing the MCP server requirements.
"""

from typing import Optional

# Target total supply in mps units
TOTAL_TARGET = 10_000_000  # 1e7

# Default configuration (from Notion doc)
DEFAULT_NUM_STEPS = 12  # Number of steps for gradual release
DEFAULT_FINAL_BLOCK_PCT = 0.30  # ~30% reserved for final block
DEFAULT_ALPHA = 1.2  # Convexity exponent for normalized curve C(t) = t^alpha


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

    # Calculate time boundaries from normalized convex curve C(t) = t^alpha.
    # We want equal token amounts per step, so cumulative supply at step i = i/num_steps.
    # Since C(t) = t^alpha maps [0,1] -> [0,1], its inverse t = C^{-1}(s) = s^{1/alpha}
    # gives the time at which cumulative fraction s of main supply is released.
    # Because alpha > 1, the curve is convex: early steps span longer durations
    # (lower MPS) and later steps span shorter durations (higher MPS).
    time_boundaries = [0.0]  # t_0 = 0
    for i in range(1, num_steps + 1):
        # Cumulative fraction of main supply at step i (normalized to [0,1])
        cum_pct = i * step_tokens_pct / main_supply_pct
        # Inverse of C(t) = t^alpha gives the normalized time boundary
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

    # Validate that rounding didn't cause supply loss
    actual_total = sum(entry["mps"] * entry["blockDelta"] for entry in schedule)
    if actual_total != TOTAL_TARGET:
        raise ValueError(
            f"Schedule totals {actual_total} MPS, expected {TOTAL_TARGET}. "
            f"Try reducing round_to_nearest or adjusting num_steps to avoid zero-duration blocks."
        )

    return schedule


def encode_supply_schedule(schedule: list[dict[str, int]]) -> str:
    """
    Encode supply schedule to bytes for onchain deployment.

    For each {mps, blockDelta} element:
    - Create uint64 where:
      - First 24 bits: mps value (left padded)
      - Next 40 bits: blockDelta value (left padded)
    - Pack all uint64s together (like Solidity's abi.encodePacked)

    Args:
        schedule: List of dicts with 'mps' and 'blockDelta' keys

    Returns:
        Hex string with 0x prefix representing packed bytes

    Raises:
        ValueError: If mps exceeds 24-bit max or blockDelta exceeds 40-bit max
    """
    # Bit layout per uint64 (matching Solidity's parse function):
    #   [  24 bits: mps  |  40 bits: blockDelta  ] = 64 bits total
    # Solidity unpacks via: mps = uint24(bytes3(data)), blockDelta = uint40(uint64(data))
    MPS_BITS = 24
    BLOCK_DELTA_BITS = 40
    MPS_MAX = 2**MPS_BITS - 1          # 16,777,215
    BLOCK_DELTA_MAX = 2**BLOCK_DELTA_BITS - 1  # 1,099,511,627,775

    encoded_bytes = b''

    for item in schedule:
        mps = item['mps']
        block_delta = item['blockDelta']

        # Validate bounds against bit-width constraints
        if mps > MPS_MAX:
            raise ValueError(f"mps {mps} exceeds {MPS_BITS}-bit max ({MPS_MAX})")
        if block_delta > BLOCK_DELTA_MAX:
            raise ValueError(f"blockDelta {block_delta} exceeds {BLOCK_DELTA_BITS}-bit max ({BLOCK_DELTA_MAX})")

        # Pack into uint64: mps in upper 24 bits, blockDelta in lower 40 bits
        packed = (mps << BLOCK_DELTA_BITS) | block_delta

        # Convert to 8 bytes (big-endian) for abi.encodePacked compatibility
        encoded_bytes += packed.to_bytes(8, byteorder='big')

    # Return as hex string with 0x prefix
    return '0x' + encoded_bytes.hex()
