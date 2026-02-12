#!/usr/bin/env node

/**
 * Documentation Validation Script
 *
 * Validates that all plugins and skills have corresponding VitePress documentation pages.
 *
 * Usage:
 *   node scripts/validate-docs.cjs
 *
 * Reads .claude-plugin/marketplace.json and checks:
 *   - docs/plugins/{plugin-name}.md exists for each plugin
 *   - docs/skills/{skill-name}.md exists for each skill in plugin.json
 *
 * Exits with code 1 if any documentation pages are missing.
 */

const fs = require('fs');
const path = require('path');

const MARKETPLACE_PATH = process.env.MARKETPLACE_PATH
  ? path.resolve(process.cwd(), process.env.MARKETPLACE_PATH)
  : path.join(process.cwd(), '.claude-plugin', 'marketplace.json');
const DOCS_PLUGINS_DIR = path.join(process.cwd(), 'docs', 'plugins');
const DOCS_SKILLS_DIR = path.join(process.cwd(), 'docs', 'skills');

/**
 * Extract skill name from a skill path like "./skills/skill-name"
 */
function extractSkillName(skillPath) {
  return path.basename(skillPath);
}

/**
 * Validate documentation pages exist for all plugins and skills
 */
function validateDocs() {
  const missing = { plugins: [], skills: [] };
  const found = { plugins: [], skills: [] };

  console.log('\n=== Validating Documentation Pages ===\n');

  // Read marketplace.json
  if (!fs.existsSync(MARKETPLACE_PATH)) {
    console.error(`  ✗ Marketplace file not found: ${MARKETPLACE_PATH}`);
    process.exit(1);
  }

  const marketplace = JSON.parse(fs.readFileSync(MARKETPLACE_PATH, 'utf8'));
  const plugins = marketplace.plugins || [];

  console.log(`Marketplace: ${marketplace.name}`);
  console.log(`Plugins to check: ${plugins.length}\n`);

  for (const plugin of plugins) {
    const pluginName = plugin.name;
    const pluginDocPath = path.join(DOCS_PLUGINS_DIR, `${pluginName}.md`);

    // Check plugin doc page
    if (fs.existsSync(pluginDocPath)) {
      found.plugins.push(pluginName);
      console.log(`  ✓ docs/plugins/${pluginName}.md`);
    } else {
      missing.plugins.push(pluginName);
      console.log(`  ✗ docs/plugins/${pluginName}.md (MISSING)`);
    }

    // Read plugin.json for skills
    const pluginSource = plugin.source.startsWith('./')
      ? plugin.source.slice(2)
      : plugin.source;
    const pluginJsonPath = path.join(process.cwd(), pluginSource, '.claude-plugin', 'plugin.json');

    if (fs.existsSync(pluginJsonPath)) {
      const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      const skills = pluginJson.skills || [];

      for (const skillPath of skills) {
        const skillName = extractSkillName(skillPath);
        const skillDocPath = path.join(DOCS_SKILLS_DIR, `${skillName}.md`);

        if (fs.existsSync(skillDocPath)) {
          found.skills.push(skillName);
          console.log(`    ✓ docs/skills/${skillName}.md`);
        } else {
          missing.skills.push(skillName);
          console.log(`    ✗ docs/skills/${skillName}.md (MISSING)`);
        }
      }
    } else {
      console.log(`    ⚠ Could not read plugin.json for ${pluginName}`);
    }
  }

  // Summary
  console.log('\n--- Documentation Validation Results ---\n');

  const totalFound = found.plugins.length + found.skills.length;
  const totalMissing = missing.plugins.length + missing.skills.length;

  console.log(`Plugin pages: ${found.plugins.length} found, ${missing.plugins.length} missing`);
  console.log(`Skill pages:  ${found.skills.length} found, ${missing.skills.length} missing`);
  console.log(`Total:        ${totalFound} found, ${totalMissing} missing\n`);

  if (totalMissing > 0) {
    console.log('Missing documentation pages:');
    for (const p of missing.plugins) {
      console.log(`  ✗ docs/plugins/${p}.md`);
    }
    for (const s of missing.skills) {
      console.log(`  ✗ docs/skills/${s}.md`);
    }
    console.log('');
    console.log(`Validation FAILED with ${totalMissing} missing page(s)\n`);
    return false;
  }

  console.log('Validation PASSED\n');
  return true;
}

const success = validateDocs();
process.exit(success ? 0 : 1);
