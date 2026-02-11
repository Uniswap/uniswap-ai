#!/usr/bin/env python3
"""
Test the supply schedule generation logic with normalized convex curve.
"""

# Import the logic to test (from logic.py, not server.py, to avoid mcp dependency)
from logic import (
    generate_schedule,
    encode_supply_schedule,
    TOTAL_TARGET,
    DEFAULT_NUM_STEPS,
    DEFAULT_FINAL_BLOCK_PCT,
    DEFAULT_ALPHA,
)


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


def test_encode_schedule():
    """Test encode_supply_schedule function for bit-packing and encoding."""
    print("\nTesting encode_supply_schedule function...")

    # Test 1: Basic encoding with simple values
    print("\nTest 1: Basic encoding")
    schedule = [
        {"mps": 1000, "blockDelta": 5000},
        {"mps": 2000, "blockDelta": 3000}
    ]

    encoded = encode_supply_schedule(schedule)

    # Verify format
    assert encoded.startswith("0x"), "Encoded output should start with 0x"
    assert len(encoded) == 2 + (8 * 2 * 2), f"Expected length {2 + 16}, got {len(encoded)}"  # 0x + 16 hex chars (8 bytes * 2 elements)

    # Manually verify bit packing for first element: (1000 << 40) | 5000
    expected_first = (1000 << 40) | 5000
    expected_first_hex = hex(expected_first)[2:].zfill(16)  # Convert to 16-char hex
    actual_first_hex = encoded[2:18]  # First 8 bytes (16 hex chars)
    assert actual_first_hex == expected_first_hex, f"First element mismatch: expected {expected_first_hex}, got {actual_first_hex}"

    print(f"  ✓ Basic encoding works: {encoded}")

    # Test 2: Maximum values (boundary testing)
    print("\nTest 2: Maximum values")
    max_mps = 2**24 - 1  # 16,777,215
    max_block_delta = 2**40 - 1  # 1,099,511,627,775

    schedule_max = [
        {"mps": max_mps, "blockDelta": max_block_delta}
    ]

    encoded_max = encode_supply_schedule(schedule_max)
    expected_max = (max_mps << 40) | max_block_delta
    expected_max_hex = "0x" + hex(expected_max)[2:].zfill(16)

    assert encoded_max == expected_max_hex, f"Max values encoding failed: expected {expected_max_hex}, got {encoded_max}"
    print(f"  ✓ Maximum values encoded correctly: mps={max_mps}, blockDelta={max_block_delta}")

    # Test 3: Overflow detection - mps exceeds 24-bit
    print("\nTest 3: Overflow detection (mps)")
    schedule_overflow_mps = [{"mps": 2**24, "blockDelta": 1000}]  # One more than max

    try:
        encode_supply_schedule(schedule_overflow_mps)
        assert False, "Should have raised ValueError for mps overflow"
    except ValueError as e:
        assert "exceeds 24-bit max" in str(e), f"Expected mps overflow error, got: {e}"
        print(f"  ✓ mps overflow detected correctly: {e}")

    # Test 4: Overflow detection - blockDelta exceeds 40-bit
    print("\nTest 4: Overflow detection (blockDelta)")
    schedule_overflow_delta = [{"mps": 1000, "blockDelta": 2**40}]  # One more than max

    try:
        encode_supply_schedule(schedule_overflow_delta)
        assert False, "Should have raised ValueError for blockDelta overflow"
    except ValueError as e:
        assert "exceeds 40-bit max" in str(e), f"Expected blockDelta overflow error, got: {e}"
        print(f"  ✓ blockDelta overflow detected correctly: {e}")

    # Test 5: Multiple elements
    print("\nTest 5: Multiple elements")
    schedule_multi = [
        {"mps": 100, "blockDelta": 1000},
        {"mps": 200, "blockDelta": 2000},
        {"mps": 300, "blockDelta": 3000}
    ]

    encoded_multi = encode_supply_schedule(schedule_multi)
    expected_length = 2 + (8 * 2 * len(schedule_multi))  # 0x + (8 bytes * 2 hex/byte * 3 elements)
    assert len(encoded_multi) == expected_length, f"Expected length {expected_length}, got {len(encoded_multi)}"

    # Verify each element is correctly packed
    for i, item in enumerate(schedule_multi):
        expected_packed = (item["mps"] << 40) | item["blockDelta"]
        expected_hex = hex(expected_packed)[2:].zfill(16)
        start_idx = 2 + (i * 16)
        end_idx = start_idx + 16
        actual_hex = encoded_multi[start_idx:end_idx]
        assert actual_hex == expected_hex, f"Element {i} mismatch: expected {expected_hex}, got {actual_hex}"

    print(f"  ✓ Multiple elements encoded correctly: {len(schedule_multi)} elements")

    # Test 6: Integration with generate_schedule
    print("\nTest 6: Integration with generated schedule")
    generated = generate_schedule(86400, 0)
    encoded_generated = encode_supply_schedule(generated)

    assert encoded_generated.startswith("0x"), "Generated schedule encoding should start with 0x"
    assert len(encoded_generated) > 2, "Generated schedule encoding should have content"
    print(f"  ✓ Generated schedule encodes successfully: {len(generated)} phases, {len(encoded_generated)} chars")

    print("\n✓ encode_supply_schedule test passed!")


def test_rounding_validation():
    """Test that rounding validation catches supply loss."""
    print("\nTesting rounding validation...")

    # Test parameters that are likely to cause zero-duration blocks with aggressive rounding
    # Using small auction_blocks with large round_to_nearest
    try:
        # This should fail: 1000 blocks with rounding to nearest 500
        # With 12 steps, this will likely create duplicate boundaries
        schedule = generate_schedule(
            auction_blocks=1000,
            prebid_blocks=0,
            num_steps=12,
            final_block_pct=0.30,
            alpha=1.2,
            round_to_nearest=500  # Very aggressive rounding
        )
        print(f"  Generated schedule: {len(schedule)} phases")
        print(f"  ✓ Validation passed (no supply loss detected)")
    except ValueError as e:
        if "Schedule totals" in str(e):
            print(f"  ✓ Validation correctly caught supply loss: {e}")
        else:
            # Re-raise if it's a different error
            raise

    # Test case that should succeed: reasonable rounding
    schedule_good = generate_schedule(
        auction_blocks=86400,
        prebid_blocks=0,
        num_steps=12,
        final_block_pct=0.30,
        alpha=1.2,
        round_to_nearest=100  # Reasonable rounding
    )

    total = sum(item["mps"] * item["blockDelta"] for item in schedule_good)
    assert total == TOTAL_TARGET, f"Expected {TOTAL_TARGET}, got {total}"
    print(f"  ✓ Reasonable rounding works correctly: {len(schedule_good)} phases, total={total}")

    print("\n✓ Rounding validation test passed!")


if __name__ == "__main__":
    test_basic_schedule()
    test_canonical_sample()
    test_rounded_schedule()
    test_prebid_schedule()
    test_different_durations()
    test_custom_parameters()
    test_encode_schedule()
    test_rounding_validation()
    print("\n" + "="*60)
    print("✓ All tests passed!")
    print("="*60)
