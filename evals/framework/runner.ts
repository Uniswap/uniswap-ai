/**
 * Eval Runner
 *
 * Execution harness for running AI tool evaluations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  EvalConfig,
  EvalCase,
  EvalResult,
  EvalSummary,
  EvalRunOptions,
  EvalReporter,
  EvalScores,
  EvalStats,
} from './types.js';
import { parseExpectedBehaviors, extractKeyTerms, type ExpectedBehavior } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUITES_DIR = path.resolve(__dirname, '../suites');

/**
 * Suite information discovered from filesystem
 */
interface SuiteInfo {
  name: string;
  path: string;
  configPath: string;
}

/**
 * CLI options parsed from arguments
 */
interface CLIOptions {
  suite?: string;
  model?: string;
  dryRun: boolean;
  verbose: boolean;
}

/**
 * Default console reporter
 */
class ConsoleReporter implements EvalReporter {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  onSuiteStart(config: EvalConfig): void {
    console.log(`\n🧪 Starting eval suite: ${config.name}`);
    console.log(`   Skill: ${config.skill}`);
    console.log(`   Models: ${config.models.join(', ')}`);
    console.log('');
  }

  onCaseStart(evalCase: EvalCase, model: string): void {
    if (this.verbose) {
      console.log(`  ▶ ${evalCase.name} (${model})`);
    }
  }

  onCaseComplete(result: EvalResult): void {
    const status = result.passed ? '✅' : '❌';
    const scores = `acc=${result.scores.accuracy.toFixed(
      2
    )} comp=${result.scores.completeness.toFixed(2)} safe=${result.scores.safety.toFixed(2)}`;
    console.log(
      `  ${status} ${result.case.name} (${result.model}): ${scores} (${result.duration}ms)`
    );

    if (result.errors.length > 0) {
      result.errors.forEach((err) => console.log(`    ⚠️  ${err}`));
    }
  }

  onSuiteComplete(summary: EvalSummary): void {
    console.log('\n📊 Suite Summary');
    console.log(`   Total: ${summary.stats.total}`);
    console.log(`   Passed: ${summary.stats.passed}`);
    console.log(`   Failed: ${summary.stats.failed}`);
    console.log(`   Errored: ${summary.stats.errored}`);
    console.log(`   Duration: ${summary.stats.totalDuration}ms`);
    console.log(`   Overall: ${summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('');
  }
}

/**
 * Parse CLI arguments into options
 */
function parseArgs(argv: string[]): CLIOptions {
  const options: CLIOptions = {
    dryRun: false,
    verbose: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--suite=')) {
      options.suite = arg.replace('--suite=', '');
    } else if (arg.startsWith('--model=')) {
      options.model = arg.replace('--model=', '');
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

/**
 * Discover eval suites from the suites directory
 */
async function discoverSuites(suitesDir: string): Promise<SuiteInfo[]> {
  const suites: SuiteInfo[] = [];

  try {
    const entries = await fs.promises.readdir(suitesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const suitePath = path.join(suitesDir, entry.name);
      const configPath = path.join(suitePath, 'eval.config.ts');

      // Check if eval.config.ts exists
      try {
        await fs.promises.access(configPath);
        suites.push({
          name: entry.name,
          path: suitePath,
          configPath,
        });
      } catch {
        // No config file, skip this directory
      }
    }
  } catch (error) {
    console.error(`Failed to discover suites in ${suitesDir}:`, error);
  }

  return suites;
}

/**
 * Load eval config from a suite
 */
async function loadConfig(configPath: string): Promise<EvalConfig> {
  const module = await import(configPath);
  return module.config || module.default;
}

/**
 * Load eval cases from a suite directory
 */
async function loadCases(suitePath: string): Promise<EvalCase[]> {
  const casesDir = path.join(suitePath, 'cases');
  const expectedDir = path.join(suitePath, 'expected');
  const cases: EvalCase[] = [];

  try {
    const entries = await fs.promises.readdir(casesDir);

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;

      const baseName = entry.replace('.md', '');
      const casePath = path.join(casesDir, entry);
      const expectedPath = path.join(expectedDir, entry);

      // Generate human-readable name from filename
      const name = baseName
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      cases.push({
        id: baseName,
        name,
        casePath,
        expectedPath,
      });
    }
  } catch (error) {
    console.error(`Failed to load cases from ${casesDir}:`, error);
  }

  return cases;
}

/**
 * Read expected behaviors from file
 */
async function loadExpectedBehaviors(expectedPath: string): Promise<ExpectedBehavior[]> {
  try {
    const content = await fs.promises.readFile(expectedPath, 'utf-8');
    return parseExpectedBehaviors(content);
  } catch {
    return [];
  }
}

/**
 * Score mock output against expected behaviors
 *
 * This is a mock implementation that simulates scoring.
 * In a real implementation, this would:
 * 1. Execute the skill with the case prompt
 * 2. Compare actual output against expected behaviors
 */
function scoreOutput(mockOutput: string, behaviors: ExpectedBehavior[]): EvalScores {
  let accuracy = 1.0;
  let completeness = 1.0;
  let safety = 1.0;
  let helpfulness = 1.0;

  for (const behavior of behaviors) {
    const terms = extractKeyTerms(behavior.items);

    // Skip scoring if no extractable terms (nothing to check)
    if (terms.length === 0) {
      continue;
    }

    const matchCount = terms.filter((term) =>
      mockOutput.toLowerCase().includes(term.toLowerCase())
    ).length;
    const matchRate = matchCount / terms.length;

    switch (behavior.section) {
      case 'must_include':
        // Must include items directly affect accuracy
        accuracy = Math.min(accuracy, matchRate);
        break;

      case 'should_include':
        // Should include items affect completeness
        completeness = Math.min(completeness, (matchRate + 1) / 2); // Weighted less heavily
        break;

      case 'should_not_include':
        // Penalties reduce completeness
        completeness = Math.max(0, completeness - matchRate * 0.2);
        break;

      case 'must_not_include':
        // Must not include items affect safety - any match is a failure
        if (matchRate > 0) {
          safety = 0;
        }
        break;

      case 'code_quality':
        // Code quality affects helpfulness
        helpfulness = Math.min(helpfulness, (matchRate + 1) / 2);
        break;
    }
  }

  return { accuracy, completeness, safety, helpfulness };
}

/**
 * Run a single eval case
 */
async function runCase(evalCase: EvalCase, config: EvalConfig, model: string): Promise<EvalResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Load expected behaviors
  const behaviors = await loadExpectedBehaviors(evalCase.expectedPath);

  // Mock output - in a real implementation, this would execute the skill
  // For now, we simulate a "good" output that contains key terms
  const mockOutput = behaviors
    .filter((b) => b.section === 'must_include' || b.section === 'should_include')
    .flatMap((b) => extractKeyTerms(b.items))
    .join(' ');

  // Score the output
  const scores = scoreOutput(mockOutput, behaviors);

  // Determine pass/fail based on thresholds
  const passed =
    scores.accuracy >= config.thresholds.accuracy &&
    scores.completeness >= config.thresholds.completeness &&
    scores.safety >= config.thresholds.safety;

  return {
    case: evalCase,
    model,
    passed,
    scores,
    duration: Date.now() - startTime,
    output: mockOutput,
    errors,
    timestamp: new Date(),
  };
}

/**
 * Calculate aggregate statistics
 */
function calculateStats(results: EvalResult[]): EvalStats {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed && r.errors.length === 0).length;
  const errored = results.filter((r) => r.errors.length > 0).length;

  const averageScores: EvalScores = {
    accuracy: results.reduce((sum, r) => sum + r.scores.accuracy, 0) / total || 0,
    completeness: results.reduce((sum, r) => sum + r.scores.completeness, 0) / total || 0,
    safety: results.reduce((sum, r) => sum + r.scores.safety, 0) / total || 0,
    helpfulness: results.reduce((sum, r) => sum + r.scores.helpfulness, 0) / total || 0,
  };

  return {
    total,
    passed,
    failed,
    errored,
    averageScores,
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
  };
}

/**
 * Run an eval suite
 */
export async function runSuite(
  config: EvalConfig,
  suitePath: string,
  options: EvalRunOptions = {}
): Promise<EvalSummary> {
  const reporter = options.reporter ?? new ConsoleReporter(options.verbose);
  const models = options.models ?? config.models;

  reporter.onSuiteStart(config);

  const cases = await loadCases(suitePath);

  if (cases.length === 0) {
    console.log('  ⚠️  No cases found in suite');
    return {
      config,
      results: [],
      stats: calculateStats([]),
      passed: true,
    };
  }

  const results: EvalResult[] = [];

  for (const evalCase of cases) {
    for (const model of models) {
      reporter.onCaseStart(evalCase, model);

      if (options.dryRun) {
        console.log(`    (dry run) Would execute: ${evalCase.name} with ${model}`);
        continue;
      }

      const result = await runCase(evalCase, config, model);
      results.push(result);
      reporter.onCaseComplete(result);
    }
  }

  const stats = calculateStats(results);

  // In dry-run mode, always pass since we're just listing what would execute
  // Otherwise, check thresholds (but only if there are results)
  const passed =
    options.dryRun ||
    results.length === 0 ||
    (stats.averageScores.accuracy >= config.thresholds.accuracy &&
      stats.averageScores.completeness >= config.thresholds.completeness &&
      stats.averageScores.safety >= config.thresholds.safety);

  const summary: EvalSummary = {
    config,
    results,
    stats,
    passed,
  };

  reporter.onSuiteComplete(summary);

  return summary;
}

/**
 * Run all eval suites (or filtered by options)
 */
export async function runAll(options: EvalRunOptions = {}): Promise<EvalSummary[]> {
  console.log('🧪 Eval Runner v1.0');
  console.log(`   Suites directory: ${SUITES_DIR}`);

  // Discover suites
  const allSuites = await discoverSuites(SUITES_DIR);

  if (allSuites.length === 0) {
    console.log('   ⚠️  No eval suites found');
    return [];
  }

  console.log(`   Found ${allSuites.length} suite(s): ${allSuites.map((s) => s.name).join(', ')}`);

  // Filter suites if specified
  let suitesToRun = allSuites;
  if (options.suites && options.suites.length > 0) {
    suitesToRun = allSuites.filter((s) => options.suites!.includes(s.name));
    if (suitesToRun.length === 0) {
      console.error(`\n❌ No matching suites found for: ${options.suites.join(', ')}`);
      console.log(`   Available suites: ${allSuites.map((s) => s.name).join(', ')}`);
      return [];
    }
  }

  if (options.dryRun) {
    console.log('\n   [DRY RUN MODE]');
  }

  const summaries: EvalSummary[] = [];

  for (const suite of suitesToRun) {
    const config = await loadConfig(suite.configPath);

    // Filter models if specified
    const suiteOptions: EvalRunOptions = { ...options };
    if (options.models && options.models.length > 0) {
      suiteOptions.models = config.models.filter((m) => options.models!.includes(m));
      if (suiteOptions.models.length === 0) {
        console.log(`\n⚠️  Skipping ${suite.name}: no matching models`);
        continue;
      }
    }

    const summary = await runSuite(config, suite.path, suiteOptions);
    summaries.push(summary);
  }

  // Print overall summary
  if (summaries.length > 1) {
    console.log('\n📊 Overall Summary');
    console.log(`   Suites run: ${summaries.length}`);
    console.log(`   Passed: ${summaries.filter((s) => s.passed).length}`);
    console.log(`   Failed: ${summaries.filter((s) => !s.passed).length}`);
  }

  return summaries;
}

// CLI entry point
if (process.argv[1]?.endsWith('runner.ts') || process.argv[1]?.endsWith('runner.js')) {
  const cliOptions = parseArgs(process.argv.slice(2));

  const runOptions: EvalRunOptions = {
    dryRun: cliOptions.dryRun,
    verbose: cliOptions.verbose,
  };

  if (cliOptions.suite) {
    runOptions.suites = [cliOptions.suite];
  }

  if (cliOptions.model) {
    runOptions.models = [cliOptions.model];
  }

  runAll(runOptions)
    .then((summaries) => {
      if (summaries.length === 0) {
        process.exit(1);
      }
      const allPassed = summaries.every((s) => s.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('Eval runner failed:', error);
      process.exit(1);
    });
}
