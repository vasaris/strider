// The app's Keeper factory (3.1-C7): keeper v0.3 through loadKeeperSetup -- the same assembly as
// the evals full cycle (byte-identical requests: test/keeper-requests.test.ts against the evals
// fixture) -- and AnthropicKeeper over an injected LlmClient. The setup is loaded per Keeper
// (per request), so a prompt edit needs no restart, and the provenance recorded with a
// generation is the one of the bytes that built its request (N1).
//
// Model: KEEPER_MODEL (trimmed, non-empty) or DEFAULT_KEEPER_MODEL. Call parameters come only
// from orchestrator's buildMessageParams (inside AnthropicLlmClient).
import 'server-only';

import { AnthropicKeeper, loadKeeperSetup, type LlmClient } from '@brodyazhnik/orchestrator';

import type { KeeperRunner } from './ports';

export const DEFAULT_KEEPER_MODEL = 'claude-sonnet-5';
export const KEEPER_PROMPT = 'prompts/keeper.system.v0.3.md';
const ERROR_TEXT_MAX = 500;

/** KEEPER_MODEL trimmed if non-empty, else the default. */
export function keeperModel(fromEnv: string | undefined): string {
  const v = fromEnv?.trim();
  return v === undefined || v === '' ? DEFAULT_KEEPER_MODEL : v;
}

export function keeperFactory(opts: {
  readonly repoRoot: () => string;
  readonly llm: () => LlmClient;
  readonly model: () => string;
}): () => KeeperRunner {
  return () => {
    const setup = loadKeeperSetup({ repoRoot: opts.repoRoot(), keeperPrompt: KEEPER_PROMPT });
    const model = opts.model();
    const keeper = new AnthropicKeeper({ llm: opts.llm(), model, assembly: setup.assembly });
    return {
      provenance: {
        model,
        keeperPromptPath: setup.provenance.keeper.path,
        keeperPromptSha256: setup.provenance.keeper.sha256,
        toneSha256: setup.provenance.tone.sha256,
        assemblySha256: setup.provenance.assembly.sha256,
      },
      run: async (pkg) => (await keeper.run({ systemPrompt: setup.system, package: pkg })).prose,
    };
  };
}

/**
 * The error text recorded with a failed generation: `${name}: ${message}`, every secret value
 * redacted, lone surrogates replaced, whitespace and control runs collapsed, at most 500 characters. Stored,
 * never returned by the API (the response carries the fixed keeper_failed message).
 */
export function keeperErrorText(err: unknown, secrets: readonly string[]): string {
  const name = err instanceof Error ? err.name : typeof err;
  const message = err instanceof Error ? err.message : String(err);
  let text = `${name}: ${message}`;
  for (const s of secrets) {
    if (s.length >= 4) text = text.split(s).join('[redacted]');
  }
  text = text
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD') // lone surrogates
    .replace(/[\s\u0000-\u001f\u007f]+/g, ' ')
    .trim();
  const chars = [...text];
  text = chars.length > ERROR_TEXT_MAX ? chars.slice(0, ERROR_TEXT_MAX).join('') : text;
  return text === '' ? 'Error' : text;
}
