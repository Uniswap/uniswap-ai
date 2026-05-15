#!/usr/bin/env node

/**
 * Runs during `bun install` to wire up local git hooks via lefthook. In CI
 * we skip hook installation — hooks aren't needed there and lefthook's
 * platform-specific binaries can fail in container environments.
 */

const { spawnSync } = require('child_process');

if (process.env.CI) {
  console.log('Skipping Lefthook installation in CI environment');
  process.exit(0);
}

console.log('Installing Lefthook git hooks...');
const result = spawnSync('bunx', ['lefthook', 'install'], { stdio: 'inherit' });

if (result.error || result.status !== 0) {
  console.error('❌ Failed to install Lefthook hooks');
  if (result.error) console.error(result.error.message);
  process.exit(1);
}

console.log('✅ Lefthook hooks installed successfully');
