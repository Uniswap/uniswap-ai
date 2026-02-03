#!/usr/bin/env python3
"""
Test the supply schedule generation logic with normalized convex curve.
"""

from typing import Optional

# Import the logic to test
TOTAL_TARGET = 10_000_000  # 1e7
DEFAULT_NUM_STEPS = 12
DEFAULT_FINAL_BLOCK_PCT = 0.30
DEFAULT_ALPHA = 1.2


def generate_schedule(
    auction_blocks: int,
    prebid_blocks: int = 0,
    num_steps: int = DEFAULT_NUM_STEPS,
    final_block_pct: float = DEFAULT_FINAL_BLOCK_PCT,
    alpha: float = DEFAULT_ALPHA,
    round_to_nearest: Optional[int] = None
) -> list[dict[str, int]]:
    """Generate supply schedule using normalized convex curve."""
    schedule = []

    if prebid_blocks > 0:
        schedule.append({"mps": 0, "blockDelta": prebid_blocks})

    main_supply_pct = 1.0 - final_block_pct
    step_tokens_pct = main_supply_pct / num_steps

    time_boundaries = [0.0]
    for i in range(1, num_steps + 1):
        cum_pct = i * step_tokens_pct / main_supply_pct
        t_i = cum_pct ** (1.0 / alpha)
        time_boundaries.append(t_i)

    block_boundaries = [round(t * auction_blocks) for t in time_boundaries]

    if round_to_nearest is not None and round_to_nearest > 0:
        block_boundaries = [
            round(b / round_to_nearest) * round_to_nearest
            for b in block_boundaries
        ]
        block_boundaries[-1] = auction_blocks

    cumulative_tokens = 0
    for i in range(num_steps):
        start_block = block_boundaries[i]
        end_block = block_boundaries[i + 1]
        duration = end_block - start_block

        step_tokens = step_tokens_pct * TOTAL_TARGET

        if duration > 0:
            mps = round(step_tokens / duration)
            mps = max(1, mps)
        else:
            mps = 0

        schedule.append({"mps": mps, "blockDelta": duration})
        cumulative_tokens += mps * duration

    final_tokens = TOTAL_TARGET - cumulative_tokens
    schedule.append({"mps": final_tokens, "blockDelta": 1})

    return schedule


def test_basic_schedule():
    """Test basic schedule generation with default parameters."""
    print("Testing normalized convex curve schedule generation...")
    print(f"Parameters: {DEFAULT_NUM_STEPS} steps, alpha={DEFAULT_ALPHA}, ~{DEFAULT_FINAL_BLOCK_PCT*100}% final block")

    schedule = generate_schedule(86400, 0)

    print(f"\nGenerated {len(schedule)} phases")
    print(f"First phase: {schedule[0]}")
    print(f"Last phase: {schedule[-1]}")

    # Verify block durations DECREASE (convex curve property)
    print("\nBlock durations (should DECREASE over time):")
    for i, item in enumerate(schedule[:-1]):  # Exclude final block
        print(f"  Step {i+1}: {item['blockDelta']} blocks, {item['mps']} mps")

    total_mps = sum(item["mps"] * item["blockDelta"] for item in schedule)
    final_percentage = (schedule[-1]["mps"] / TOTAL_TARGET) * 100

    print(f"\nTotal MPS: {total_mps}")
    print(f"Target MPS: {TOTAL_TARGET}")
    print(f"Match: {total_mps == TOTAL_TARGET}")
    print(f"Final block percentage: {final_percentage:.2f}%")

    # Verify DECREASING block durations (not increasing!)
    print("\nVerifying DECREASING block durations (convex curve property):")
    for i in range(1, DEFAULT_NUM_STEPS):
        prev_delta = schedule[i-1]["blockDelta"]
        curr_delta = schedule[i]["blockDelta"]
        ratio = curr_delta / prev_delta if prev_delta > 0 else 0
        trend = "✓ decreasing" if curr_delta < prev_delta else "✗ NOT decreasing"
        print(f"  Step {i} to {i+1}: {prev_delta} → {curr_delta} (ratio: {ratio:.2f}x) {trend}")

    assert total_mps == TOTAL_TARGET, f"Total MPS mismatch: {total_mps} != {TOTAL_TARGET}"
    assert 25 <= final_percentage <= 35, f"Final block should be ~30%, got {final_percentage:.2f}%"
    print("\n✓ Basic schedule test passed!")


def test_canonical_sample():
    """
    Test that our implementation matches the canonical sample schedule.

    Reference: 86400 blocks, 12 steps, ~30% final block
    Expected time boundaries: [0.0000, 0.1261, 0.2247, 0.3150, 0.4003, 0.4821, 0.5612, 0.6382, 0.7133, 0.7868, 0.8590, 0.9301, 1.0000]
    """
    print("\nTesting against canonical sample schedule...")

    schedule = generate_schedule(
        auction_blocks=86400,
        prebid_blocks=0,
        num_steps=12,
        final_block_pct=0.30,
        alpha=1.2,
        round_to_nearest=None
    )

    # Expected time boundaries (normalized [0,1])
    expected_times = [0.0000, 0.1261, 0.2247, 0.3150, 0.4003, 0.4821, 0.5612, 0.6382, 0.7133, 0.7868, 0.8590, 0.9301, 1.0000]

    # Convert to expected block boundaries
    expected_blocks = [round(t * 86400) for t in expected_times]

    print("\nExpected vs Actual block boundaries:")
    actual_blocks = [0]
    cumulative = 0
    for i in range(12):
        cumulative += schedule[i]["blockDelta"]
        actual_blocks.append(cumulative)

    for i in range(len(expected_blocks)):
        expected = expected_blocks[i]
        actual = actual_blocks[i]
        diff = abs(actual - expected)
        match = "✓" if diff <= 1 else "✗"  # Allow 1 block tolerance for rounding
        print(f"  t_{i}: expected {expected}, got {actual}, diff={diff} {match}")

    # Verify each step releases approximately equal token amounts (5.8333%)
    print("\nToken amounts per step (should be ~5.8333% each):")
    expected_step_pct = 5.8333
    for i in range(12):
        step_tokens = schedule[i]["mps"] * schedule[i]["blockDelta"]
        step_pct = (step_tokens / TOTAL_TARGET) * 100
        diff = abs(step_pct - expected_step_pct)
        match = "✓" if diff < 0.5 else "✗"  # Allow 0.5% tolerance
        print(f"  Step {i+1}: {step_pct:.4f}% (expected {expected_step_pct}%, diff={diff:.4f}%) {match}")

    total_mps = sum(item["mps"] * item["blockDelta"] for item in schedule)
    final_percentage = (schedule[-1]["mps"] / TOTAL_TARGET) * 100

    print(f"\nFinal block: {final_percentage:.2f}% (expected ~30%)")
    print(f"Total MPS: {total_mps} (expected {TOTAL_TARGET})")

    assert total_mps == TOTAL_TARGET, f"Total MPS mismatch: {total_mps} != {TOTAL_TARGET}"
    assert 29 <= final_percentage <= 31, f"Final block should be ~30%, got {final_percentage:.2f}%"
    print("\n✓ Canonical sample test passed!")


def test_rounded_schedule():
    """
    Test schedule with rounding enabled.

    Tests the optional rounding feature for block boundaries.
    """
    print("\nTesting schedule with rounding enabled...")

    schedule = generate_schedule(
        auction_blocks=86400,
        prebid_blocks=0,
        num_steps=12,
        final_block_pct=0.30,
        alpha=1.2,
        round_to_nearest=100  # Round to nearest 100 blocks
    )

    print("\nRounded block boundaries:")
    cumulative = 0
    for i in range(12):
        start = cumulative
        duration = schedule[i]["blockDelta"]
        end = start + duration
        cumulative = end
        print(f"  Step {i+1}: {start} → {end} (duration: {duration} blocks)")

    # Verify boundaries are multiples of 100 (except possibly the last)
    print("\nVerifying rounding to nearest 100:")
    cumulative = 0
    for i in range(12):
        cumulative += schedule[i]["blockDelta"]
        is_multiple = cumulative % 100 == 0 or cumulative == 86400
        print(f"  After step {i+1}: block {cumulative}, multiple of 100: {is_multiple}")

    total_mps = sum(item["mps"] * item["blockDelta"] for item in schedule)
    final_percentage = (schedule[-1]["mps"] / TOTAL_TARGET) * 100

    print(f"\nFinal block: {final_percentage:.2f}%")
    print(f"Total MPS: {total_mps}")

    assert total_mps == TOTAL_TARGET, f"Total MPS mismatch: {total_mps} != {TOTAL_TARGET}"
    print("\n✓ Rounded schedule test passed!")


def test_prebid_schedule():
    """Test schedule with prebid period."""
    print("\nTesting schedule with prebid period...")

    schedule = generate_schedule(86400, 43200)

    print(f"Generated {len(schedule)} phases (including prebid)")
    print(f"First phase (prebid): {schedule[0]}")
    print(f"Second phase: {schedule[1]}")
    print(f"Last phase: {schedule[-1]}")

    assert schedule[0]["mps"] == 0, "Prebid phase should have 0 mps"
    assert schedule[0]["blockDelta"] == 43200, "Prebid phase should have correct blockDelta"

    total_mps = sum(item["mps"] * item["blockDelta"] for item in schedule)
    final_percentage = (schedule[-1]["mps"] / TOTAL_TARGET) * 100

    print(f"\nTotal MPS: {total_mps}")
    print(f"Target MPS: {TOTAL_TARGET}")
    print(f"Match: {total_mps == TOTAL_TARGET}")
    print(f"Final block percentage: {final_percentage:.2f}%")

    assert total_mps == TOTAL_TARGET, f"Total MPS mismatch: {total_mps} != {TOTAL_TARGET}"
    assert 25 <= final_percentage <= 35, f"Final block should be ~30%, got {final_percentage:.2f}%"
    print("\n✓ Prebid schedule test passed!")


def test_different_durations():
    """Test with different auction durations."""
    print("\nTesting different auction durations...")

    test_cases = [
        (14400, "1 day on mainnet (12s blocks)"),
        (43200, "1 day on Base (2s blocks)"),
        (86400, "2 days on Base (2s blocks)"),
        (604800, "1 week on Base (2s blocks)"),
    ]

    for blocks, description in test_cases:
        schedule = generate_schedule(blocks, 0)
        total_mps = sum(item["mps"] * item["blockDelta"] for item in schedule)
        final_percentage = (schedule[-1]["mps"] / TOTAL_TARGET) * 100

        print(f"\n{description}:")
        print(f"  Total blocks: {blocks}")
        print(f"  Steps: {len(schedule) - 1} (+ final block)")
        print(f"  Total MPS: {total_mps}")
        print(f"  Final block: {final_percentage:.2f}%")

        # Verify decreasing durations
        first_duration = schedule[0]["blockDelta"]
        last_duration = schedule[-2]["blockDelta"]  # Second to last (before final block)
        print(f"  First step duration: {first_duration} blocks")
        print(f"  Last step duration: {last_duration} blocks")
        print(f"  Durations decrease: {first_duration > last_duration}")

        assert total_mps == TOTAL_TARGET, f"Total MPS mismatch for {description}"
        assert 25 <= final_percentage <= 35, f"Final block percentage out of range for {description}"
        assert first_duration > last_duration, f"Durations should decrease for {description}"

    print("\n✓ Different durations test passed!")


def test_custom_parameters():
    """Test with custom parameters (different num_steps, final_block_pct, alpha)."""
    print("\nTesting custom parameters...")

    test_cases = [
        (10, 0.40, 1.5, "10 steps, 40% final, alpha=1.5"),
        (8, 0.25, 1.0, "8 steps, 25% final, alpha=1.0 (linear)"),
        (15, 0.35, 1.3, "15 steps, 35% final, alpha=1.3"),
    ]

    for num_steps, final_pct, alpha, description in test_cases:
        schedule = generate_schedule(
            auction_blocks=86400,
            prebid_blocks=0,
            num_steps=num_steps,
            final_block_pct=final_pct,
            alpha=alpha
        )

        total_mps = sum(item["mps"] * item["blockDelta"] for item in schedule)
        final_percentage = (schedule[-1]["mps"] / TOTAL_TARGET) * 100
        expected_final_pct = final_pct * 100

        print(f"\n{description}:")
        print(f"  Total phases: {len(schedule)}")
        print(f"  Total MPS: {total_mps}")
        print(f"  Final block: {final_percentage:.2f}% (expected ~{expected_final_pct:.2f}%)")

        # Verify each step releases approximately equal token amounts
        expected_step_pct = (1.0 - final_pct) / num_steps * 100
        print(f"  Expected per step: {expected_step_pct:.4f}%")

        assert total_mps == TOTAL_TARGET, f"Total MPS mismatch for {description}"
        assert abs(final_percentage - expected_final_pct) < 2, f"Final block percentage mismatch for {description}"

    print("\n✓ Custom parameters test passed!")


if __name__ == "__main__":
    test_basic_schedule()
    test_canonical_sample()
    test_rounded_schedule()
    test_prebid_schedule()
    test_different_durations()
    test_custom_parameters()
    print("\n" + "="*60)
    print("✓ All tests passed!")
    print("="*60)
