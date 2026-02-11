#!/usr/bin/env node

/**
 * Prepare Script
 *
 * Runs after npm install to set up the development environment:
 * - Checks npm version
 * - Installs lefthook git hooks
 */

const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const { join } = require('path');

// Get required npm version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const requiredNpmVersion = packageJson.engines?.npm;

if (requiredNpmVersion) {
  try {
    const currentNpmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();

    if (currentNpmVersion !== requiredNpmVersion) {
      console.warn(`\n⚠️  npm version mismatch`);
      console.warn(`   Required: ${requiredNpmVersion}`);
      console.warn(`   Current:  ${currentNpmVersion}`);
      console.warn(`   Run: npm install -g npm@${requiredNpmVersion}\n`);
    }
  } catch {
    console.error('Failed to check npm version');
  }
}

// Install lefthook if available
try {
  // Check if lefthook is installed (lefthook uses 'version' not '--version')
  execSync('npx lefthook version', { stdio: 'ignore' });

  // Install git hooks
  console.log('Installing lefthook git hooks...');
  execSync('npx lefthook install', { stdio: 'inherit' });
  console.log('✅ Lefthook installed successfully');
} catch {
  console.log('ℹ️  Lefthook not available, skipping git hooks installation');
}
