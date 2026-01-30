#!/usr/bin/env node

/**
 * Plugin Validation Script
 *
 * Validates Claude Code plugin structure and configuration.
 *
 * Usage:
 *   node scripts/validate-plugin.cjs <plugin-path>
 *
 * Example:
 *   node scripts/validate-plugin.cjs packages/plugins/uniswap-hooks
 *
 * Expected Plugin Structure:
 *   <plugin-name>/
 *   ├── .claude-plugin/
 *   │   └── plugin.json        # Required: name, version, description
 *   ├── package.json           # Required: npm package configuration
 *   ├── project.json           # Required: Nx project config (with 'type:plugin' tag)
 *   ├── README.md              # Required: Plugin documentation
 *   ├── CLAUDE.md              # Recommended: AI assistant context
 *   ├── skills/                # Optional: Skill definitions (SKILL.md files)
 *   ├── agents/                # Optional: Agent definitions (.md files)
 *   ├── commands/              # Optional: Command definitions (.md files)
 *   ├── hooks/                 # Optional: Hook definitions
 *   └── .mcp.json              # Optional: MCP server configuration
 *
 * Validates:
 *   - Required files exist (plugin.json, package.json, project.json, README.md)
 *   - plugin.json has required fields (name, version, description)
 *   - project.json has 'type:plugin' tag
 *   - Referenced component directories exist
 *   - JSON files are valid
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = ['.claude-plugin/plugin.json', 'package.json', 'project.json', 'README.md'];

const REQUIRED_PLUGIN_JSON_FIELDS = ['name', 'version', 'description'];

const OPTIONAL_COMPONENT_DIRS = ['skills', 'agents', 'commands', 'hooks'];

/**
 * Validate plugin structure
 */
function validatePlugin(pluginPath) {
  const errors = [];
  const warnings = [];

  console.log(`\nValidating plugin: ${pluginPath}\n`);

  // Check if plugin path exists
  if (!fs.existsSync(pluginPath)) {
    errors.push(`Plugin path does not exist: ${pluginPath}`);
    return { errors, warnings };
  }

  // Check required files
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(pluginPath, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required file: ${file}`);
    }
  }

  // Validate plugin.json
  const pluginJsonPath = path.join(pluginPath, '.claude-plugin/plugin.json');
  if (fs.existsSync(pluginJsonPath)) {
    try {
      const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));

      // Check required fields
      for (const field of REQUIRED_PLUGIN_JSON_FIELDS) {
        if (!pluginJson[field]) {
          errors.push(`plugin.json missing required field: ${field}`);
        }
      }

      // Validate components references
      if (pluginJson.components) {
        for (const [type, patterns] of Object.entries(pluginJson.components)) {
          const componentDir = path.join(pluginPath, type);
          if (!fs.existsSync(componentDir)) {
            warnings.push(`Component directory referenced but not found: ${type}/`);
          }
        }
      }

      console.log(`  ✓ plugin.json: ${pluginJson.name} v${pluginJson.version}`);
    } catch {
      errors.push(`Invalid JSON in plugin.json`);
    }
  }

  // Validate package.json
  const packageJsonPath = path.join(pluginPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      if (!packageJson.name) {
        errors.push(`package.json missing name field`);
      }
      if (!packageJson.version) {
        errors.push(`package.json missing version field`);
      }

      console.log(`  ✓ package.json: ${packageJson.name}`);
    } catch {
      errors.push(`Invalid JSON in package.json`);
    }
  }

  // Validate project.json
  const projectJsonPath = path.join(pluginPath, 'project.json');
  if (fs.existsSync(projectJsonPath)) {
    try {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));

      if (!projectJson.name) {
        errors.push(`project.json missing name field`);
      }
      if (!projectJson.tags || !Array.isArray(projectJson.tags)) {
        warnings.push(`project.json missing tags array`);
      } else if (!projectJson.tags.includes('type:plugin')) {
        warnings.push(`project.json missing 'type:plugin' tag`);
      }

      console.log(`  ✓ project.json: ${projectJson.name}`);
    } catch {
      errors.push(`Invalid JSON in project.json`);
    }
  }

  // Check component directories
  for (const dir of OPTIONAL_COMPONENT_DIRS) {
    const dirPath = path.join(pluginPath, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      console.log(`  ✓ ${dir}/: ${files.length} item(s)`);
    }
  }

  // Check for MCP configuration
  const mcpJsonPath = path.join(pluginPath, '.mcp.json');
  if (fs.existsSync(mcpJsonPath)) {
    try {
      const mcpJson = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
      const serverCount = Object.keys(mcpJson.mcpServers || {}).length;
      console.log(`  ✓ .mcp.json: ${serverCount} MCP server(s)`);
    } catch {
      errors.push(`Invalid JSON in .mcp.json`);
    }
  }

  return { errors, warnings };
}

/**
 * Print validation results
 */
function printResults(errors, warnings) {
  console.log('\n--- Validation Results ---\n');

  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('');
    console.log(`Validation FAILED with ${errors.length} error(s)\n`);
    return false;
  }

  console.log('Validation PASSED\n');
  return true;
}

// Main execution
const pluginPath = process.argv[2];

if (!pluginPath) {
  console.error('Usage: node scripts/validate-plugin.cjs <plugin-path>');
  console.error('Example: node scripts/validate-plugin.cjs packages/plugins/uniswap-hooks');
  process.exit(1);
}

const { errors, warnings } = validatePlugin(pluginPath);
const success = printResults(errors, warnings);

process.exit(success ? 0 : 1);
