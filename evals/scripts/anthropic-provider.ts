/**
 * Custom Anthropic Provider for Promptfoo
 *
 * Supports both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN authentication.
 * This provider wraps the Anthropic SDK to enable authentication via Claude Code's
 * OAuth token for local development without requiring a separate API key.
 *
 * Usage in promptfoo.yaml:
 *   providers:
 *     - file://scripts/anthropic-provider.ts:AnthropicProvider
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ApiProvider, ProviderResponse, CallApiContextParams } from 'promptfoo';

interface AnthropicProviderConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Get authenticated Anthropic client
 * Supports both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN
 */
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

  if (apiKey) {
    return new Anthropic({ apiKey });
  }

  if (oauthToken) {
    // OAuth token can be used as API key for Claude Code authenticated sessions
    return new Anthropic({
      apiKey: oauthToken,
    });
  }

  throw new Error(
    'Authentication required: Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable'
  );
}

/**
 * Model pricing per 1M tokens (as of Feb 2026)
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/**
 * Get pricing for a model, with fallback to Sonnet pricing
 */
function getModelPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-5'];
}

/**
 * Custom Anthropic provider for Promptfoo evaluations
 */
export class AnthropicProvider implements ApiProvider {
  private client: Anthropic;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: AnthropicProviderConfig = {}) {
    this.client = getAnthropicClient();
    this.model = config.model ?? 'claude-sonnet-4-5';
    this.temperature = config.temperature ?? 0;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  id(): string {
    return `anthropic:${this.model}`;
  }

  async callApi(prompt: string, _context?: CallApiContextParams): Promise<ProviderResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const output =
        response.content[0].type === 'text'
          ? response.content[0].text
          : JSON.stringify(response.content[0]);

      // Calculate cost based on token usage and model-specific pricing
      const pricing = getModelPricing(this.model);
      const inputCost = (response.usage.input_tokens / 1_000_000) * pricing.input;
      const outputCost = (response.usage.output_tokens / 1_000_000) * pricing.output;
      const totalCost = inputCost + outputCost;

      return {
        output,
        tokenUsage: {
          total: response.usage.input_tokens + response.usage.output_tokens,
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
        },
        cost: totalCost,
        cached: false,
        logProbs: undefined,
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error),
        tokenUsage: { total: 0, prompt: 0, completion: 0 },
      };
    }
  }
}

/**
 * Factory function for creating provider instances
 * Called by Promptfoo when loading the provider
 */
export default function createProvider(config: AnthropicProviderConfig = {}): AnthropicProvider {
  return new AnthropicProvider(config);
}
