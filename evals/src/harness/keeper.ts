import type { Keeper, KeeperInput, KeeperOutput } from './types.js';

/**
 * Deterministic stand-in for the narrative model. Returns canned prose and does NOT read
 * the package internals -- which is why swapping the package to the real NarrativePackage
 * (ws-b) is safe, and why the stub path is byte-deterministic (golden-able).
 *
 * The real AnthropicKeeper (./anthropicKeeper.ts) implements this SAME interface -- the
 * model call behind `run()` is an injected LlmClient -- so wiring it in does not touch the
 * runner or the judge. No network / API key is used here.
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

// The real Keeper is AnthropicKeeper (./anthropicKeeper.ts): same Keeper interface, the model
// call behind an injected LlmClient. Its path is judge-scored, not byte-golden (the LLM is not
// byte-deterministic) -- see harness.test.ts.
