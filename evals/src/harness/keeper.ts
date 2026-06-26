import type { Keeper, KeeperInput, KeeperOutput } from './types.js';

/**
 * Deterministic stand-in for the narrative model. Returns canned prose and does NOT read
 * the package internals -- which is exactly why the PROVISIONAL ScenarioPackage alias is
 * safe to keep minimal, and why the stub path is byte-deterministic (golden-able).
 *
 * The real AnthropicKeeper (chat 2.4) implements this SAME interface -- an Anthropic API
 * call behind `run()` -- so wiring it in does not touch the runner or the judge. No
 * network / API key is used here.
 */
export class StubKeeper implements Keeper {
  constructor(
    private readonly prose: string,
    private readonly questions: readonly string[] = [],
  ) {}

  run(_input: KeeperInput): Promise<KeeperOutput> {
    const out: KeeperOutput =
      this.questions.length > 0 ? { prose: this.prose, questions: this.questions } : { prose: this.prose };
    return Promise.resolve(out);
  }
}

// AnthropicKeeper -> chat 2.4 (slot, not built here):
//   class AnthropicKeeper implements Keeper {
//     async run(input) { /* Anthropic API call: narrative model + input.systemPrompt +
//       a rendered package; returns { prose, questions? } */ }
//   }
// It lives behind the Keeper interface; the real LLM path is judge-scored, not
// byte-golden (the LLM is not byte-deterministic) -- see harness.test.ts.
