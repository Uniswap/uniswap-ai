#!/usr/bin/env npx tsx

/**
 * Eval Coverage Check Script
 *
 * Checks if skills have corresponding eval suites.
 *
 * Usage:
 *   npx tsx scripts/check-eval-coverage.ts [--staged] [--strict]
 *
 * Options:
 *   --staged   Only check skills that have staged changes (for pre-commit hooks)
 *   --strict   Fail with error if any skill is missing an eval suite (default: warn)
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface CoverageResult {
  found: string[];
  missing: string[];
}

const args = process.argv.slice(2);
const stagedOnly = args.includes('--staged');
const strict = args.includes('--strict');

/**
 * Get list of changed skill directories from git
 */
function getChangedSkills(): Set<string> {
  const skills = new Set<string>();

  try {
    const gitCommand = stagedOnly ? 'git diff --cached --name-only' : 'git diff --name-only HEAD~1';

    const changedFiles = execSync(gitCommand, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);

    // Pattern: packages/plugins/<plugin>/skills/<skill>/...
    const skillPattern = /^packages\/plugins\/[^/]+\/skills\/([^/]+)\//;

    for (const file of changedFiles) {
      const match = file.match(skillPattern);
      if (match) {
        skills.add(match[1]);
      }
    }
  } catch {
    // If git command fails (e.g., no commits), return empty set
    return new Set();
  }

  return skills;
}

/**
 * Get all skills from all plugins
 */
function getAllSkills(): Set<string> {
  const skills = new Set<string>();
  const pluginsDir = join(process.cwd(), 'packages', 'plugins');

  if (!existsSync(pluginsDir)) {
    return skills;
  }

  const plugins = readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const plugin of plugins) {
    const skillsDir = join(pluginsDir, plugin, 'skills');
    if (existsSync(skillsDir)) {
      const pluginSkills = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      pluginSkills.forEach((s) => skills.add(s));
    }
  }

  return skills;
}

/**
 * Check if a skill has an eval suite
 */
function hasEvalSuite(skillName: string): boolean {
  const evalSuitePath = join(process.cwd(), 'evals', 'suites', skillName, 'promptfoo.yaml');
  return existsSync(evalSuitePath);
}

/**
 * Check eval coverage for given skills
 */
function checkCoverage(skills: Set<string>): CoverageResult {
  const result: CoverageResult = { found: [], missing: [] };

  for (const skill of skills) {
    if (hasEvalSuite(skill)) {
      result.found.push(skill);
    } else {
      result.missing.push(skill);
    }
  }

  return result;
}

// Main execution
const skillsToCheck = stagedOnly ? getChangedSkills() : getAllSkills();

if (skillsToCheck.size === 0) {
  if (stagedOnly) {
    // No skills changed in staged files - nothing to check
    process.exit(0);
  }
  console.log('No skills found in packages/plugins/*/skills/');
  process.exit(0);
}

const { found, missing } = checkCoverage(skillsToCheck);

// Report results
if (found.length > 0) {
  console.log(`✓ ${found.length} skill(s) have eval suites: ${found.join(', ')}`);
}

if (missing.length > 0) {
  const icon = strict ? '✗' : '⚠';
  console.log(`${icon} ${missing.length} skill(s) missing eval suites:`);
  for (const skill of missing) {
    console.log(`  - ${skill}`);
  }
  console.log('');
  console.log('To create eval suites, run:');
  for (const skill of missing) {
    console.log(`  cp -r evals/templates/suite/ evals/suites/${skill}/`);
  }

  if (strict) {
    process.exit(1);
  }
}

process.exit(0);
