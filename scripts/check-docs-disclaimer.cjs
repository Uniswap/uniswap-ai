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
 * Elements are graded on substance, not on one blessed phrasing. Each accepts a small family of
 * wordings, so a copy edit that keeps the meaning passes and a deletion fails. The substance comes
 * from DISCLAIMER.md; read that file before changing anything here.
 *
 * Usage:
 *   node scripts/check-docs-disclaimer.cjs
 *
 * Exits 1 if any docs page states less than its SKILL.md does.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PLUGINS_DIR = path.join(ROOT, 'packages', 'plugins');
const DOCS_SKILLS_DIR = path.join(ROOT, 'docs', 'skills');

/**
 * The elements a pointer can state. Each `test` runs against the whitespace-normalized text, so an
 * element survives being re-wrapped across lines.
 *
 * The AI-disclosure duty is split into four separate elements on purpose. It is conditional in
 * DISCLAIMER.md — it applies when you generate financial information AND present it directly to
 * individuals or consumers — and each half of that condition is independently deletable. Checking
 * the duty as one blob would let a page keep the word "AI-disclosure" while dropping the audience
 * condition, which is the drift that turns a conditional duty into an unconditional-looking one.
 */
const ELEMENTS = [
  {
    id: 'names-the-document',
    describe: 'names the repo root DISCLAIMER.md',
    test: /DISCLAIMER\.md/,
  },
  {
    id: 'as-is',
    describe: 'says the skills are provided as is',
    test: /\bas[- ]is\b/i,
  },
  {
    id: 'no-warranty',
    describe: 'says they carry no warranty',
    test: /\b(without|no)\s+warrant(y|ies)\b/i,
  },
  {
    id: 'advice-categories',
    describe: 'keeps all four advice categories (legal, financial, investment, tax)',
    test: /\blegal,\s*financial,\s*investment,\s*(or|and)\s*tax\b/i,
  },
  {
    id: 'use-limits',
    describe: 'says the guidelines place limits on use',
    test: /\b(use limits|limits on (the )?use|intended use|use restrictions|restrictions on (the )?use)\b/i,
  },
  {
    id: 'ai-disclosure-duty',
    describe: 'names the AI-disclosure duty',
    test: /\bAI[-\s]disclosure\b/i,
  },
  {
    id: 'ai-disclosure-conditional',
    describe: 'frames the duty as conditional rather than unconditional',
    test: /\bAI[-\s]disclosure duty that (applies|attaches)\s+(when|if)\b/i,
  },
  {
    id: 'ai-disclosure-condition-generate',
    describe: 'keeps the first condition (generating financial information)',
    test: /\bgenerate financial information\b/i,
  },
  {
    id: 'ai-disclosure-condition-audience',
    describe: 'keeps the second condition (presenting it to individuals or consumers)',
    test: /\bpresent(ing|s)? (it|that information|them)? ?directly to individuals or consumers\b/i,
  },
];

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

function checkDocsDisclaimer() {
  console.log('\n=== Checking DISCLAIMER.md Pointer On Docs Pages ===\n');

  const skills = findSkills();
  const failures = [];
  let enrolled = 0;

  for (const { skillName, skillMdPath } of skills) {
    const skillPointer = pointerBlocks(fs.readFileSync(skillMdPath, 'utf8')).join(' ');

    // A skill that does not point at DISCLAIMER.md imposes nothing on its docs page.
    if (skillPointer === '') {
      continue;
    }

    enrolled += 1;

    // The bar for this page is whatever its own SKILL.md states, not a repo-wide maximum.
    const required = ELEMENTS.filter((element) => element.test.test(skillPointer));

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
    const missing = required.filter((element) => !element.test.test(docPointer));

    if (missing.length === 0) {
      console.log(`  ✓ ${relDocPath} (${required.length}/${required.length} elements)`);
    } else {
      failures.push({ page: relDocPath, missingPage: false, missing });
      console.log(`  ✗ ${relDocPath} (${missing.length} of ${required.length} elements missing)`);
      for (const element of missing) {
        console.log(`      - ${element.id}: ${element.describe}`);
      }
    }
  }

  console.log('\n--- Docs Disclaimer Check Results ---\n');
  console.log(`Skills pointing at DISCLAIMER.md: ${enrolled}`);
  console.log(`Docs pages checked:               ${enrolled}`);
  console.log(`Pages failing:                    ${failures.length}\n`);

  if (enrolled === 0) {
    console.log('No skill points at DISCLAIMER.md. If that is a surprise, the pointer was removed');
    console.log('from every SKILL.md and this check has nothing left to guard.\n');
    console.log('Check FAILED with 0 enrolled pages\n');
    return false;
  }

  if (failures.length > 0) {
    console.log('These docs pages state less about the repo root DISCLAIMER.md than their own');
    console.log('SKILL.md does. Read DISCLAIMER.md and the matching SKILL.md, then restore the');
    console.log('missing elements on the docs page:\n');
    for (const failure of failures) {
      if (failure.missingPage) {
        console.log(`  ✗ ${failure.page} — page does not exist`);
        continue;
      }
      console.log(`  ✗ ${failure.page}`);
      for (const element of failure.missing) {
        console.log(`      - ${element.describe}`);
      }
    }
    console.log('');
    console.log(`Check FAILED with ${failures.length} failing page(s)\n`);
    return false;
  }

  console.log('Check PASSED\n');
  return true;
}

const success = checkDocsDisclaimer();
process.exit(success ? 0 : 1);
