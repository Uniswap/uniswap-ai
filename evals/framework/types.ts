/**
 * Eval Framework Types
 *
 * Type definitions for the AI tool evaluation framework.
 */

/**
 * Configuration for an eval suite
 */
export interface EvalConfig {
  /** Unique name for this eval suite */
  name: string;

  /** The skill being evaluated */
  skill: string;

  /** Models to run evals against */
  models: string[];

  /** Timeout in milliseconds per eval case */
  timeout: number;

  /** Number of retries on failure */
  retries: number;

  /** Scoring thresholds for pass/fail */
  thresholds: EvalThresholds;
}

/**
 * Scoring thresholds for eval pass/fail determination
 */
export interface EvalThresholds {
  /** Minimum accuracy score (0-1) */
  accuracy: number;

  /** Minimum completeness score (0-1) */
  completeness: number;

  /** Minimum safety score (0-1) */
  safety: number;

  /** Minimum helpfulness score (0-1) - optional */
  helpfulness?: number;
}

/**
 * A single eval case
 */
export interface EvalCase {
  /** Case identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Path to the case markdown file */
  casePath: string;

  /** Path to the expected behaviors file */
  expectedPath: string;
}

/**
 * Result of running a single eval case
 */
export interface EvalResult {
  /** The case that was evaluated */
  case: EvalCase;

  /** Model used for this run */
  model: string;

  /** Whether the eval passed overall */
  passed: boolean;

  /** Individual scores */
  scores: EvalScores;

  /** Time taken in milliseconds */
  duration: number;

  /** Raw output from the model */
  output: string;

  /** Any errors encountered */
  errors: string[];

  /** Timestamp of the eval run */
  timestamp: Date;
}

/**
 * Scores for different eval dimensions
 */
export interface EvalScores {
  /** How accurately the output implements requirements */
  accuracy: number;

  /** How completely the output covers all requirements */
  completeness: number;

  /** How safe and secure the output is */
  safety: number;

  /** How helpful and well-documented the output is */
  helpfulness: number;
}

/**
 * Summary of an eval suite run
 */
export interface EvalSummary {
  /** Suite configuration */
  config: EvalConfig;

  /** All individual results */
  results: EvalResult[];

  /** Aggregate statistics */
  stats: EvalStats;

  /** Overall pass/fail for the suite */
  passed: boolean;
}

/**
 * Aggregate statistics for an eval run
 */
export interface EvalStats {
  /** Total number of cases */
  total: number;

  /** Number of passed cases */
  passed: number;

  /** Number of failed cases */
  failed: number;

  /** Number of errored cases */
  errored: number;

  /** Average scores across all cases */
  averageScores: EvalScores;

  /** Total duration in milliseconds */
  totalDuration: number;
}

/**
 * Reporter interface for outputting eval results
 */
export interface EvalReporter {
  /** Called when an eval suite starts */
  onSuiteStart(config: EvalConfig): void;

  /** Called when a single case starts */
  onCaseStart(evalCase: EvalCase, model: string): void;

  /** Called when a single case completes */
  onCaseComplete(result: EvalResult): void;

  /** Called when an eval suite completes */
  onSuiteComplete(summary: EvalSummary): void;
}

/**
 * Options for running evals
 */
export interface EvalRunOptions {
  /** Only run specific suites */
  suites?: string[];

  /** Only run against specific models */
  models?: string[];

  /** Dry run - don't actually execute */
  dryRun?: boolean;

  /** Verbose output */
  verbose?: boolean;

  /** Custom reporter */
  reporter?: EvalReporter;
}
