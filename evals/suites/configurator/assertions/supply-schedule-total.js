/**
 * Deterministic check on the one property of a CCA supply schedule that is pure
 * arithmetic: its released supply must total exactly 10,000,000 MPS.
 *
 * WHY THIS IS NOT A RUBRIC. Both rubrics graded this before this file existed, and
 * an LLM judge grading exact arithmetic makes a required status check
 * nondeterministic.
 * Two runs of identical content on PR #140 disagreed: run 31846203576 scored the
 * case 1.0, and run 31848655116 failed it because the model's own schedule summed
 * to 9,999,996 MPS, four short. The judge was right that time. The problem is that
 * a property with one correct answer was being decided by a sampled judgment, so
 * the gate flips on chance and "just re-run it" becomes the reflex.
 *
 * THE TOTAL IS NOT THE SUM OF THE `mps` FIELDS. `mps` is a release rate, tokens
 * per block, and `blockDelta` is how many blocks that rate runs for. The formula
 * here is the plugin's own, copied from the generator that produces these
 * schedules, `mcp-server/supply-schedule/server.py`:
 *
 *     total_mps = sum(item["mps"] * item["blockDelta"] for item in schedule)
 *
 * The skill's worked example agrees: its `mps` fields sum to 2,989,006 while the
 * products sum to exactly 10,000,000. A check on the bare `mps` column would fail
 * every correct answer, and a response built on that reading oversubscribes the
 * auction by a factor of thousands while looking tidy, which is a failure both
 * rubrics scored 1.0 on before this assertion existed.
 *
 * THE SUITE'S STANDING RULE: an assertion may only fail a WRONG answer. Two prior
 * checks in this suite broke that rule by matching on wording (`AuctionParameters`,
 * `educational`), so this one asserts on parsed numbers and is deliberately
 * conservative in three ways:
 *
 *   1. Wording is never matched. Only `{ mps, blockDelta }` pairs are read, in any
 *      of the shapes a model emits them: JSON, a JS object literal, or a Python
 *      dict; quoted or bare keys; camelCase or snake_case.
 *   2. A response with no parseable schedule PASSES. A correct answer that presents
 *      the schedule as a markdown table, or in prose, must not fail here. The
 *      `contains-any` check on `supplySchedule` already requires the field to be
 *      named; this check grades the arithmetic when, and only when, it can read it.
 *   3. Several totals are considered and ONE of them matching is enough (see
 *      "candidates" below). Every additional candidate can only turn a fail into a
 *      pass, never the reverse, so the parser erring on grouping cannot invent a
 *      failure.
 *
 * The failure it does catch is the observed one: a schedule that parses cleanly and
 * whose arithmetic is wrong.
 */

const REQUIRED_TOTAL = 10000000n;

// A step, in any of the shapes a model writes one. Chunks are matched without
// nesting, so a wrapping object such as `"summary": { ... }` is never treated as a
// step. The lookbehind on the key is what keeps `total_mps` from reading as `mps`,
// since `\w` covers the underscore.
const CHUNK = /\{[^{}]*\}/g;
const MPS_KEY = /(?<!\w)["']?mps["']?\s*[:=]\s*["']?(\d[\d_]*)["']?/i;
const DELTA_KEY = /(?<!\w)["']?block_?delta["']?\s*[:=]\s*["']?(\d[\d_]*)["']?/i;

// A key that names the emitted schedule, used to tell the response's own
// configuration apart from an illustrative fragment quoted while explaining.
const SCHEDULE_KEY = /(?<!\w)["']?(?:supply_?schedule|schedule)["']?\s*[:=]\s*\[?\s*$/i;

/** Steps stay in one group while nothing but whitespace and commas separates them. */
const GROUP_SEPARATOR = /^[\s,]*$/;

function toInteger(raw) {
  return BigInt(raw.replace(/_/g, ''));
}

function parseSteps(output) {
  const steps = [];
  for (const match of output.matchAll(CHUNK)) {
    const mps = MPS_KEY.exec(match[0]);
    const blockDelta = DELTA_KEY.exec(match[0]);
    if (!mps || !blockDelta) {
      continue;
    }
    steps.push({
      mps: toInteger(mps[1]),
      blockDelta: toInteger(blockDelta[1]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return steps;
}

function groupSteps(output, steps) {
  const groups = [];
  let current = null;
  for (const step of steps) {
    const separator = current === null ? null : output.slice(current.end, step.start);
    if (current !== null && GROUP_SEPARATOR.test(separator)) {
      current.steps.push(step);
      current.end = step.end;
      continue;
    }
    current = { steps: [step], start: step.start, end: step.end };
    groups.push(current);
  }
  return groups;
}

function total(steps) {
  return steps.reduce((sum, step) => sum + step.mps * step.blockDelta, 0n);
}

/** True when the text immediately before a group names it as the supply schedule. */
function isNamedSchedule(output, group) {
  const preceding = output.slice(Math.max(0, group.start - 80), group.start);
  return SCHEDULE_KEY.test(preceding);
}

export default function supplyScheduleTotal(output) {
  const text = typeof output === 'string' ? output : JSON.stringify(output ?? '');
  const steps = parseSteps(text);

  if (steps.length === 0) {
    return {
      pass: true,
      score: 1,
      reason:
        'No { mps, blockDelta } steps could be parsed from the response, so the supply total was not asserted. This check only grades arithmetic it can read; the schedule field itself is required by the contains-any check.',
    };
  }

  const groups = groupSteps(text, steps);
  const named = groups.filter((group) => isNamedSchedule(text, group));

  // Candidates, in the order they are reported. Whole-response and named-only
  // totals are included so that a schedule split across two code blocks, or
  // interrupted by a comment line, still has an intact total among the candidates.
  const candidates = [
    ...groups.map((group, index) => ({
      label: `block ${index + 1} (${group.steps.length} step(s))`,
      value: total(group.steps),
    })),
  ];
  if (named.length > 0) {
    candidates.push({
      label: `all steps under a schedule key (${named.reduce(
        (n, g) => n + g.steps.length,
        0
      )} step(s))`,
      value: total(named.flatMap((group) => group.steps)),
    });
  }
  if (groups.length > 1) {
    candidates.push({ label: `all ${steps.length} parsed step(s)`, value: total(steps) });
  }

  const match = candidates.find((candidate) => candidate.value === REQUIRED_TOTAL);
  if (match) {
    return {
      pass: true,
      score: 1,
      reason: `Supply schedule totals exactly ${REQUIRED_TOTAL} MPS (sum of mps * blockDelta over ${match.label}).`,
    };
  }

  const detail = candidates
    .map((candidate) => {
      const delta = candidate.value - REQUIRED_TOTAL;
      const sign = delta > 0n ? '+' : '';
      return `${candidate.label}: ${candidate.value} (${sign}${delta})`;
    })
    .join('; ');

  return {
    pass: false,
    score: 0,
    reason: `Supply schedule must total exactly ${REQUIRED_TOTAL} MPS, computed as the sum of mps * blockDelta. No parsed schedule does. Totals found: ${detail}.`,
  };
}
