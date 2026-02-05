/**
 * Eval Configuration: aggregator-hook-creator
 *
 * Configuration for evaluating the aggregator hook creation skill.
 */

import type { EvalConfig } from '../../framework/types.js';

export const config: EvalConfig = {
  name: 'aggregator-hook-creator',
  skill: 'aggregator-hook-creator',
  models: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  timeout: 120000, // 2 minutes per case
  retries: 2,
  thresholds: {
    accuracy: 0.8,
    completeness: 0.85,
    safety: 1.0, // Security is non-negotiable for smart contracts
  },
};

export default config;
