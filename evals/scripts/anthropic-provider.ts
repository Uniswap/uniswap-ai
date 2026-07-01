/**
 * Custom Anthropic Provider for Promptfoo
 *
 * Supports both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN authentication.
 * This provider wraps the Anthropic SDK to enable authentication via Claude Code's
 * OAuth token for local development without requiring a separate API key.
 *
 * Auth shape matters: a console API key (sk-ant-api03...) authenticates via the
 * x-api-key header (the SDK's `apiKey` option). An OAuth token (sk-ant-oat..., the
 * CLAUDE_CODE_OAUTH_TOKEN local-dev credential) is rejected as x-api-key (HTTP 401);
 * it must be sent as Authorization: Bearer (the SDK's `authToken` option) together
 * with the `anthropic-beta: oauth-2025-04-20` header. The provider detects the token
 * shape and wires up the correct path.
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

/** OAuth tokens (sk-ant-oat...) must use Bearer auth + the oauth beta header, not x-api-key. */
const OAUTH_TOKEN_PREFIX = 'sk-ant-oat';
const OAUTH_BETA_HEADER = 'oauth-2025-04-20';

/**
 * Get authenticated Anthropic client
 * Supports both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN.
 *
 * Classifies by token shape, not by which env var held it: an OAuth token
 * (sk-ant-oat...) is sent as Authorization: Bearer with the oauth beta header,
 * while a console key (sk-ant-api03...) is sent as x-api-key.
 */
function getAnthropicClient(): Anthropic {
  // Prefer the OAuth token so a stray ANTHROPIC_API_KEY does not shadow the
  // local-dev credential when both are present.
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY;

  if (!token) {
    throw new Error(
      'Authentication required: Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable'
    );
  }

  if (token.startsWith(OAUTH_TOKEN_PREFIX)) {
    // Bearer path. apiKey is explicitly null so the SDK does not also auto-load
    // ANTHROPIC_API_KEY and send x-api-key, which the API rejects alongside Bearer.
    return new Anthropic({
      apiKey: null,
      authToken: token,
      defaultHeaders: { 'anthropic-beta': OAUTH_BETA_HEADER },
    });
  }

  return new Anthropic({ apiKey: token });
}

/**
 * Model pricing per 1M tokens (as of Feb 2026)
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
  'claude-opus-4-5-20251101': { input: 15, output: 75 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
};

/**
 * Get pricing for a model, with fallback to Sonnet pricing
 */
function getModelPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-5-20250929'];
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
    this.model = config.model ?? 'claude-sonnet-4-5-20250929';
    this.temperature = config.temperature ?? 0;
    // 8192 (not 4096) so detailed strategy-plan responses are not truncated mid-output,
    // which otherwise starves the correctness/completeness rubrics and flakes the eval.
    this.maxTokens = config.maxTokens ?? 8192;
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

      const block = response.content[0];
      const output = block?.type === 'text' ? block.text : JSON.stringify(block ?? null);

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
