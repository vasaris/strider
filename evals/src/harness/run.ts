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
 * swaps each by substitution.
 */
export async function runScenario(config: RunConfig): Promise<Transcript> {
  const { seed, packageProvider, keeper, judge, ctx = {} } = config;
  const pkg = await packageProvider(seed);
  const output = await keeper.run({ systemPrompt: seed.systemPrompt, package: pkg });
  const verdict = await judge.score(output.prose, ctx);
  return { scenarioId: seed.id, summary: seed.summary, package: pkg, output, verdict };
}
