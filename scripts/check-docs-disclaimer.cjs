#!/usr/bin/env node

/**
 * Docs Disclaimer Pointer Check
 *
 * A skill's published docs page must carry the same repo root DISCLAIMER.md pointer its SKILL.md
 * carries. The eval suites cannot catch a regression on the docs side: each suite's prompt wrapper
 * injects SKILL.md and its references only, so a docs page whose pointer was deleted or hollowed
 * out leaves every eval green. This check covers that side; the evals cover the SKILL.md side.
 *
 * The rule is a comparison, not a fixed list, so it needs no per-skill configuration and does not
 * impose one plugin's disclaimer style on another. For every SKILL.md that mentions DISCLAIMER.md,
 * the check measures which of the elements below that SKILL.md itself states, then requires
 * docs/skills/<skill>.md to state the same ones. A skill carrying the full usage-guidelines
 * paragraph holds its docs page to the full paragraph; a skill that only says "surface the
 * disclaimers in DISCLAIMER.md" holds its docs page to that much and no more.
 *
 * Elements are graded on substance, not on one blessed phrasing. Each accepts a family of wordings,
 * so a copy edit that keeps the meaning passes and a deletion fails. The substance comes from
 * DISCLAIMER.md; read that file before changing anything here.
 *
 * Two guards sit on top of that comparison, because the comparison alone can quietly weaken:
 *
 *   - Coherence. A pointer may name the AI-disclosure duty without restating it, but a pointer that
 *     restates any part of that duty must restate all of it. A restatement missing its conditional
 *     framing, or one of its two conditions, is a failure in its own right on either side.
 *   - Coverage. A pointer that restates the guidelines while stating fewer elements than the
 *     fullest pointer in the repository draws a warning, so an element silently disappearing from a
 *     SKILL.md is visible rather than just lowering that page's bar. It is a warning and not a
 *     failure: a skill is allowed to say less on purpose, and only a human can tell that apart from
 *     an accidental deletion. Pointers that merely name the document are outside the comparison.
 *
 * Usage:
 *   node scripts/check-docs-disclaimer.cjs
 *
 * Exits 1 if any docs page states less than its SKILL.md does, or if any pointer restates the
 * AI-disclosure duty only in part.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PLUGINS_DIR = path.join(ROOT, 'packages', 'plugins');
const DOCS_SKILLS_DIR = path.join(ROOT, 'docs', 'skills');

/**
 * The elements a pointer can state. Each element's patterns run against the whitespace-normalized
 * text, so an element survives being re-wrapped across lines.
 *
 * The AI-disclosure duty is split into four separate elements on purpose. It is conditional in
 * DISCLAIMER.md — it applies when you generate financial information AND present it directly to
 * individuals or consumers — and each half of that condition is independently deletable. Checking
 * the duty as one blob would let a page keep the word "AI-disclosure" while dropping the audience
 * condition, which is the drift that turns a conditional duty into an unconditional-looking one.
 *
 * Patterns match meaning, not one blessed phrasing. Each is deliberately loose about connectives,
 * verb inflection, and word order, and tight about the words that carry the substance. "a duty that
 * applies when", "a duty which attaches only if", and "a duty that is triggered when" all state the
 * same conditional and all match; "a duty that applies to every use of a Skill" states a different
 * thing and does not. A pattern that only accepted the current wording would fail a legitimate copy
 * edit and then report it as a deletion, which is a worse failure than missing one.
 *
 * `any` passes when at least one pattern matches; `all` passes only when every pattern matches.
 */
const ELEMENTS = [
  {
    id: 'names-the-document',
    describe: 'names the repo root DISCLAIMER.md',
    any: [/DISCLAIMER\.md/],
  },
  {
    id: 'as-is',
    describe: 'says the skills are provided as is',
    any: [/\bas[- ]is\b/i],
  },
  {
    id: 'no-warranty',
    describe: 'says they carry no warranty',
    any: [
      /\b(?:without|with no|no|lacking any)\s+warrant(?:y|ies)\b/i,
      /\bdisclaims?\b[^.;]{0,30}?\bwarrant(?:y|ies)\b/i,
      /\bwarrant(?:y|ies)\b[^.;]{0,20}?\b(?:of any kind\s+)?(?:is|are)?\s*(?:expressly\s+)?disclaimed\b/i,
    ],
  },
  {
    // Order-independent on purpose: "tax, legal, financial, or investment advice" is the same
    // disclaimer as the current wording, while dropping any one category narrows it. The old
    // pattern hard-coded the sequence, so a reorder read as a deletion.
    id: 'advice-categories',
    describe: 'keeps all four advice categories (legal, financial, investment, tax)',
    all: [/\blegal\b/i, /\bfinancial\b/i, /\binvestment\b/i, /\btax\b/i, /\badvice\b/i],
  },
  {
    id: 'use-limits',
    describe: 'says the guidelines place limits on use',
    any: [
      /\b(?:use limits|intended use|use restrictions)\b/i,
      /\b(?:limits?|limitations?|restrictions?)\b[^.;]{0,30}?\b(?:on|to|what|how|upon)\b[^.;]{0,30}?\buse[ds]?\b/i,
      /\b(?:not intended to be used|may not be used|must not be used)\b/i,
    ],
  },
  {
    id: 'ai-disclosure-duty',
    describe: 'names the AI-disclosure duty',
    any: [/\bAI[-\s]disclosure\b/i],
  },
  {
    // The conditional framing, not the connective. Requires a duty word, a word for the duty taking
    // effect, and a conditional connective, in that order and close together. An unconditional
    // rewrite ("a duty that applies to every use") has no connective in range and fails.
    id: 'ai-disclosure-conditional',
    describe: 'frames the duty as conditional rather than unconditional',
    any: [
      /\b(?:duty|obligation|requirement)\b[^.;]{0,40}?\b(?:applies|apply|attaches|attach|arises|arise|triggered|triggers)\b[^.;]{0,25}?\b(?:when|if|where|whenever|upon)\b/i,
      /\bconditional\b[^.;]{0,40}?\b(?:duty|obligation|requirement)\b/i,
      /\b(?:duty|obligation|requirement)\b[^.;]{0,40}?\bis conditional\b/i,
    ],
  },
  {
    id: 'ai-disclosure-condition-generate',
    describe: 'keeps the first condition (generating financial information)',
    any: [/\bgenerat(?:e|es|ed|ing|ion of)\b[^.;]{0,25}?\bfinancial information\b/i],
  },
  {
    id: 'ai-disclosure-condition-audience',
    describe: 'keeps the second condition (presenting it to individuals or consumers)',
    any: [
      /\bpresent(?:s|ed|ing)?\b[^.;]{0,45}?\bindividuals\s+(?:or|and)\s+consumers\b/i,
      /\b(?:shown|show|disclose[ds]?|disclosing|provide[ds]?|providing)\b[^.;]{0,45}?\bindividuals\s+(?:or|and)\s+consumers\b/i,
    ],
  },
];

/**
 * The three elements that restate the AI-disclosure duty's substance, as opposed to merely naming
 * it. A pointer is free to say only "surface the AI-disclosure duty in DISCLAIMER.md" and stop; the
 * short pointers in this repository do exactly that. But a pointer that restates any part of the
 * duty's substance has to restate all of it, because a conditional duty missing one of its
 * conditions reads as a broader duty than the document imposes.
 *
 * This is what catches silent erosion. Changing one word in a SKILL.md — "a duty that applies" to
 * "a duty which applies" — used to drop `ai-disclosure-conditional` from the required set with no
 * output at all, lowering the bar for that skill's docs page by one element. Loosening the patterns
 * above makes that particular edit a non-event, but the erosion path stays open for any future
 * rewrite the patterns do not anticipate, so the coherence rule closes it independently.
 */
const DUTY_SUBSTANCE_IDS = [
  'ai-disclosure-conditional',
  'ai-disclosure-condition-generate',
  'ai-disclosure-condition-audience',
];
const DUTY_COHERENCE_IDS = ['ai-disclosure-duty', ...DUTY_SUBSTANCE_IDS];

/** True when `element`'s patterns are satisfied by `text`. */
function matches(element, text) {
  if (element.all) {
    return element.all.every((pattern) => pattern.test(text));
  }
  return element.any.some((pattern) => pattern.test(text));
}

/**
 * The duty elements a pointer states but should not state alone. Empty when the pointer is
 * coherent: either it restates the whole duty, or it restates none of it.
 */
function dutyIncoherence(pointer) {
  const present = new Set(
    DUTY_COHERENCE_IDS.filter((id) =>
      matches(
        ELEMENTS.find((e) => e.id === id),
        pointer
      )
    )
  );

  const restatesSubstance = DUTY_SUBSTANCE_IDS.some((id) => present.has(id));
  if (!restatesSubstance) {
    return [];
  }

  return DUTY_COHERENCE_IDS.filter((id) => !present.has(id)).map((id) =>
    ELEMENTS.find((e) => e.id === id)
  );
}

/** Collapse every whitespace run to a single space so line wrapping cannot break a match. */
function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The normalized text of every markdown block that mentions DISCLAIMER.md, joined.
 *
 * Scoping to the block matters. Both the SKILL.md files and the docs pages state "legal,
 * financial, investment, or tax advice" in a second, unrelated place, so running the elements over
 * a whole file would let the pointer's own copy of that phrase be narrowed to "financial advice"
 * while the file still matched somewhere else. Measured against the pointer block alone, the
 * narrowing fails, which is the point.
 *
 * A block is a markdown list item, or a blank-line-delimited paragraph where there is no list
 * item. Both are enough to hold one pointer; the pointer in every file today is a single item.
 */
function pointerBlocks(text) {
  const blocks = [];
  let current = [];

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join(' '));
      current = [];
    }
  };

  for (const line of text.split('\n')) {
    const startsListItem = /^\s*([-*+]|\d+[.)])\s/.test(line);
    const isBlank = line.trim() === '';
    const isHeading = /^#{1,6}\s/.test(line);

    if (startsListItem || isBlank || isHeading) {
      flush();
    }

    if (!isBlank && !isHeading) {
      current.push(line.trim());
    }
  }
  flush();

  return blocks.filter((block) => /DISCLAIMER\.md/.test(block)).map(normalize);
}

/** Every skills/<name>/SKILL.md under packages/plugins, as { skillName, skillMdPath }. */
function findSkills() {
  const skills = [];

  if (!fs.existsSync(PLUGINS_DIR)) {
    return skills;
  }

  for (const plugin of fs.readdirSync(PLUGINS_DIR)) {
    const skillsDir = path.join(PLUGINS_DIR, plugin, 'skills');
    if (!fs.existsSync(skillsDir)) {
      continue;
    }

    for (const skillName of fs.readdirSync(skillsDir)) {
      const skillMdPath = path.join(skillsDir, skillName, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        skills.push({ skillName, skillMdPath });
      }
    }
  }

  return skills.sort((a, b) => a.skillName.localeCompare(b.skillName));
}

/** One line per pattern an element accepts, for a failure report that says what it looked for. */
function patternsOf(element) {
  return (element.all || element.any).map((pattern) => String(pattern));
}

function checkDocsDisclaimer() {
  console.log('\n=== Checking DISCLAIMER.md Pointer On Docs Pages ===\n');

  const skills = findSkills();
  const failures = [];
  const incoherent = [];
  const coverage = [];
  let enrolled = 0;

  for (const { skillName, skillMdPath } of skills) {
    const relSkillMdPath = path.relative(ROOT, skillMdPath);
    const skillPointer = pointerBlocks(fs.readFileSync(skillMdPath, 'utf8')).join(' ');

    // A skill that does not point at DISCLAIMER.md imposes nothing on its docs page.
    if (skillPointer === '') {
      continue;
    }

    enrolled += 1;

    // The bar for this page is whatever its own SKILL.md states, not a repo-wide maximum.
    const required = ELEMENTS.filter((element) => matches(element, skillPointer));
    coverage.push({ skillName, source: relSkillMdPath, count: required.length });

    const skillGaps = dutyIncoherence(skillPointer);
    if (skillGaps.length > 0) {
      incoherent.push({ source: relSkillMdPath, gaps: skillGaps });
      console.log(`  ✗ ${relSkillMdPath} (partial AI-disclosure duty)`);
    }

    const docPath = path.join(DOCS_SKILLS_DIR, `${skillName}.md`);
    const relDocPath = path.relative(ROOT, docPath);

    if (!fs.existsSync(docPath)) {
      // validate-docs.cjs owns "the page must exist"; report it here too rather than
      // silently passing a skill whose page is gone.
      failures.push({ page: relDocPath, missingPage: true, missing: [] });
      console.log(`  ✗ ${relDocPath} (PAGE MISSING)`);
      continue;
    }

    const docPointer = pointerBlocks(fs.readFileSync(docPath, 'utf8')).join(' ');
    const missing = required.filter((element) => !matches(element, docPointer));

    const docGaps = dutyIncoherence(docPointer);
    if (docGaps.length > 0) {
      incoherent.push({ source: relDocPath, gaps: docGaps });
      console.log(`  ✗ ${relDocPath} (partial AI-disclosure duty)`);
    }

    if (missing.length === 0) {
      console.log(`  ✓ ${relDocPath} (${required.length}/${required.length} elements)`);
    } else {
      failures.push({ page: relDocPath, missingPage: false, missing });
      console.log(`  ✗ ${relDocPath} (${missing.length} of ${required.length} not detected)`);
      for (const element of missing) {
        console.log(`      - ${element.id}: ${element.describe}`);
      }
    }
  }

  // Coverage erosion: a pointer that restates the guidelines but states less than the fullest
  // pointer in the repository. Compared only against pointers that restate something, so the
  // deliberately short "surface the disclaimers in DISCLAIMER.md" pointers are not dragged into
  // a comparison they were never meant to meet, and the warning stays quiet until it means
  // something. A warning, not a failure: a skill is allowed to say less than its neighbours on
  // purpose, and only a human can tell that apart from an accidental deletion.
  const restating = coverage.filter((entry) => entry.count > 1);
  const maxElements = restating.reduce((max, entry) => Math.max(max, entry.count), 0);
  const eroded = restating.filter((entry) => entry.count < maxElements);

  console.log('\n--- Docs Disclaimer Check Results ---\n');
  console.log(`Skills pointing at DISCLAIMER.md: ${enrolled}`);
  console.log(`Docs pages checked:               ${enrolled}`);
  console.log(`Fullest pointer states:           ${maxElements} of ${ELEMENTS.length} elements`);
  console.log(`Pages failing:                    ${failures.length}`);
  console.log(`Partial AI-disclosure pointers:   ${incoherent.length}\n`);

  if (eroded.length > 0) {
    console.log(`⚠ ${eroded.length} pointer(s) state less than the fullest pointer in the repo.`);
    console.log('  Intentional if that skill was always shorter; a regression if an element was');
    console.log('  dropped by a rewrite. Check the diff on these files:\n');
    for (const entry of eroded) {
      console.log(`      - ${entry.source} (${entry.count} of ${maxElements})`);
    }
    console.log('');
  }

  if (enrolled === 0) {
    console.log('No skill points at DISCLAIMER.md. If that is a surprise, the pointer was removed');
    console.log('from every SKILL.md and this check has nothing left to guard.\n');
    console.log('Check FAILED with 0 enrolled pages\n');
    return false;
  }

  if (incoherent.length > 0) {
    console.log('These pointers restate part of the AI-disclosure duty and not the rest. The duty');
    console.log('in DISCLAIMER.md is conditional; a restatement missing its framing or one of its');
    console.log(
      'two conditions reads as a broader duty than the document imposes. State the whole'
    );
    console.log('duty, or name it without restating it:\n');
    for (const entry of incoherent) {
      console.log(`  ✗ ${entry.source}`);
      for (const element of entry.gaps) {
        console.log(`      - not detected: ${element.describe}`);
        for (const pattern of patternsOf(element)) {
          console.log(`          looked for ${pattern}`);
        }
      }
    }
    console.log('');
  }

  if (failures.length > 0) {
    console.log('These docs pages state less about the repo root DISCLAIMER.md than their own');
    console.log('SKILL.md does. Each element below was not detected on the docs page, either');
    console.log('because it was removed or because it was reworded past what the check accepts.');
    console.log('Read DISCLAIMER.md and the matching SKILL.md. If the wording is still correct,');
    console.log('widen the pattern in scripts/check-docs-disclaimer.cjs rather than reverting the');
    console.log('copy edit:\n');
    for (const failure of failures) {
      if (failure.missingPage) {
        console.log(`  ✗ ${failure.page} — page does not exist`);
        continue;
      }
      console.log(`  ✗ ${failure.page}`);
      for (const element of failure.missing) {
        console.log(`      - not detected: ${element.describe}`);
        for (const pattern of patternsOf(element)) {
          console.log(`          looked for ${pattern}`);
        }
      }
    }
    console.log('');
  }

  const failed = failures.length + incoherent.length;
  if (failed > 0) {
    console.log(`Check FAILED with ${failures.length} failing page(s) and`);
    console.log(`${incoherent.length} partial AI-disclosure pointer(s)\n`);
    return false;
  }

  console.log('Check PASSED\n');
  return true;
}

const success = checkDocsDisclaimer();
process.exit(success ? 0 : 1);
