/**
 * Console Reporter
 *
 * Outputs eval results to the console in a human-readable format.
 */

import type { EvalConfig, EvalCase, EvalResult, EvalSummary, EvalReporter } from '../types.js';

/**
 * Console reporter with colored output
 */
export class ConsoleReporter implements EvalReporter {
  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  onSuiteStart(config: EvalConfig): void {
    console.log('\n' + '='.repeat(60));
    console.log(`🧪 Eval Suite: ${config.name}`);
    console.log('='.repeat(60));
    console.log(`Skill: ${config.skill}`);
    console.log(`Models: ${config.models.join(', ')}`);
    console.log(
      `Thresholds: acc≥${config.thresholds.accuracy} comp≥${config.thresholds.completeness} safe≥${config.thresholds.safety}`
    );
    console.log('');
  }

  onCaseStart(evalCase: EvalCase, model: string): void {
    if (this.verbose) {
      console.log(`\n▶ ${evalCase.name}`);
      console.log(`  Model: ${model}`);
      console.log(`  Case: ${evalCase.casePath}`);
      console.log(`  Expected: ${evalCase.expectedPath}`);
    } else {
      process.stdout.write(`  ${evalCase.name} (${model})...`);
    }
  }

  onCaseComplete(result: EvalResult): void {
    const status = result.passed ? '✅' : '❌';

    if (this.verbose) {
      console.log(`  Status: ${status} ${result.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`  Scores:`);
      console.log(`    Accuracy:     ${this.formatScore(result.scores.accuracy)}`);
      console.log(`    Completeness: ${this.formatScore(result.scores.completeness)}`);
      console.log(`    Safety:       ${this.formatScore(result.scores.safety)}`);
      console.log(`    Helpfulness:  ${this.formatScore(result.scores.helpfulness)}`);
      console.log(`  Duration: ${result.duration}ms`);

      if (result.errors.length > 0) {
        console.log(`  Errors:`);
        result.errors.forEach((err) => console.log(`    ⚠️  ${err}`));
      }
    } else {
      const scores = `[${result.scores.accuracy.toFixed(2)}/${result.scores.completeness.toFixed(2)}/${result.scores.safety.toFixed(2)}]`;
      console.log(` ${status} ${scores} ${result.duration}ms`);
    }
  }

  onSuiteComplete(summary: EvalSummary): void {
    console.log('\n' + '-'.repeat(60));
    console.log('📊 Suite Summary');
    console.log('-'.repeat(60));
    console.log(`Total Cases:  ${summary.stats.total}`);
    console.log(`Passed:       ${summary.stats.passed}`);
    console.log(`Failed:       ${summary.stats.failed}`);
    console.log(`Errored:      ${summary.stats.errored}`);
    console.log('');
    console.log('Average Scores:');
    console.log(`  Accuracy:     ${this.formatScore(summary.stats.averageScores.accuracy)}`);
    console.log(`  Completeness: ${this.formatScore(summary.stats.averageScores.completeness)}`);
    console.log(`  Safety:       ${this.formatScore(summary.stats.averageScores.safety)}`);
    console.log(`  Helpfulness:  ${this.formatScore(summary.stats.averageScores.helpfulness)}`);
    console.log('');
    console.log(`Total Duration: ${summary.stats.totalDuration}ms`);
    console.log('');
    console.log('='.repeat(60));
    console.log(`Overall Result: ${summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('='.repeat(60));
    console.log('');
  }

  private formatScore(score: number): string {
    const percentage = (score * 100).toFixed(1);
    const bar = this.renderBar(score);
    return `${bar} ${percentage}%`;
  }

  private renderBar(score: number, width: number = 20): string {
    const filled = Math.round(score * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }
}

export default ConsoleReporter;
