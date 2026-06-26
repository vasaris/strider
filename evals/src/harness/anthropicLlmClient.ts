import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmRequest } from './types.js';

/**
 * Real LlmClient for the live calibration step. Reads ANTHROPIC_API_KEY from process.env
 * (the runner guards its presence first and errors with an instruction if missing -- the key
 * is NEVER read from anywhere else, written, logged, or printed). `model` comes from the
 * request (config, not hardcoded). The judge's prompted-JSON + Zod gate stays the source of
 * truth; this client only returns the model's concatenated text.
 *
 * NOT exercised by `npm test` (the offline suite uses the mock LlmClient). Only `calibrate.mts`
 * constructs this, and only Ivan runs that in his keyed shell.
 */
export class AnthropicLlmClient implements LlmClient {
  private readonly client = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env

  async complete(req: LlmRequest): Promise<string> {
    const m = await this.client.messages.create({
      model: req.model, // config (default claude-opus-4-8), passed through from the judge
      max_tokens: 1024,
      // Cache the stable system prefix (rubric + tone.md) -- shared across all 13 cases.
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: req.user }],
    });
    const parts: string[] = [];
    for (const block of m.content) {
      if (block.type === 'text') parts.push(block.text);
    }
    return parts.join('');
  }
}
