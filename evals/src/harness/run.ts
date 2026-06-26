import type { PackageProvider, RunConfig, ScenarioPackage, Transcript } from './types.js';

/**
 * A package provider that returns a fixed fixture. The scaffold's stand-in for the real
 * source. SEAM (RECONCILE 4): at chat 2.4 this is replaced by an orchestratorPackageProvider
 * that calls orchestrator's real builder (engine -> NarrativePackage) -- by INJECTION, not
 * by editing runScenario.
 */
export function fixtureProvider(pkg: ScenarioPackage): PackageProvider {
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
  return { scenarioId: seed.id, package: pkg, output, verdict };
}
