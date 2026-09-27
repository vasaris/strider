import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import type { PackageProvider, RunConfig, Transcript } from './types.js';

/**
 * A package provider that returns a fixed fixture NarrativePackage. The real source
 * (RECONCILE 4, closed at ws-b) is orchestrator's buildNarrativePackage(turn) -- plugged in
 * by INJECTION, not by editing runScenario. fixtureProvider stays for tests that pin a
 * hand-built package.
 */
export function fixtureProvider(pkg: NarrativePackage): PackageProvider {
  return () => pkg;
}

/**
 * Run one scenario through the cycle: seed -> package -> Keeper -> judge -> transcript.
 * All three real collaborators are injected (packageProvider / keeper / judge), so 2.4
 * swaps each by substitution. The judge receives the SAME package object the Keeper got, as
 * `ctx.package` (reviewer decision 27.09 #1, HANDOFF_STAGE3 sec 5; A3.2): injected here in the
 * runner, so it applies to single runs and suites alike. The judge's lengthTarget is sourced from
 * that same package's length_target (RECONCILE 3 closed, A4.1): like the package itself, it WINS
 * over a caller-supplied ctx value.
 */
export async function runScenario(config: RunConfig): Promise<Transcript> {
  const { seed, packageProvider, keeper, judge, ctx = {} } = config;
  const pkg = await packageProvider(seed);
  const output = await keeper.run({ systemPrompt: seed.systemPrompt, package: pkg });
  const verdict = await judge.score(output.prose, {
    ...ctx,
    package: pkg,
    lengthTarget: { minChars: pkg.length_target.min_chars, maxChars: pkg.length_target.max_chars },
  });
  return { scenarioId: seed.id, summary: seed.summary, package: pkg, output, verdict };
}
