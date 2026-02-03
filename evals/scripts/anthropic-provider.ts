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
 * Custom Anthropic provider for Promptfoo evaluations
 */
export class AnthropicProvider implements ApiProvider {
  private client: Anthropic;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: AnthropicProviderConfig = {}) {
    this.client = getAnthropicClient();
    this.model = config.model ?? 'claude-sonnet-4-20250514';
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

      // Calculate cost based on token usage
      const inputCost = (response.usage.input_tokens / 1_000_000) * 3; // $3 per 1M input tokens (Sonnet)
      const outputCost = (response.usage.output_tokens / 1_000_000) * 15; // $15 per 1M output tokens (Sonnet)
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
