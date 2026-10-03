// Production wiring of the session service's ports (3.1-C7). No test-only setters: tests build
// their own ServiceDeps and call the handlers with them.
//   keyPresent  non-empty ANTHROPIC_API_KEY (read from process.env only; never logged, never
//               copied into app/.env*; Ivan starts dev from a keyed shell)
//   keeper      keeperFactory over AnthropicLlmClient (the SDK reads the key itself), model from
//               KEEPER_MODEL or the default; setup loaded per request
//   store       getStore (db/ready.ts: DATABASE_URL pool, role check memoized on success)
//   env         getJourneyEnv (memoized pack load)
//   newSeed     16 random bytes as hex (32 characters; P10 allows 1..128)
//   routeFor    pregenRoute; step: journeyTurn
//   secrets     the key, the auth token and connection strings, redacted from recorded Keeper
//               errors: each raw AND trimmed (the SDK trims ANTHROPIC_* before use, so an error
//               such as an invalid-header TypeError quotes the trimmed form), plus URL passwords
import 'server-only';

import { randomBytes } from 'node:crypto';

import { journeyTurn, pregenRoute } from '@brodyazhnik/orchestrator';
import { AnthropicLlmClient } from '@brodyazhnik/orchestrator/anthropic';

import { getStore } from '../db/ready';
import { getJourneyEnv, repoRoot } from '../env';
import { keeperFactory, keeperModel } from './keeper';
import type { ServiceDeps } from './ports';

const SECRET_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'DATABASE_URL', 'TEST_DATABASE_URL'] as const;

/** A connection URL's password: always the raw form, plus the decoded form when it decodes (an
 *  error may quote either; a malformed escape such as %zz never drops the raw one). */
function urlPassword(v: string): string[] {
  let raw: string;
  try {
    raw = new URL(v).password;
  } catch {
    return [];
  }
  if (raw === '') return [];
  try {
    return [raw, decodeURIComponent(raw)];
  } catch {
    return [raw];
  }
}

let memo: ServiceDeps | undefined;

export function productionDeps(): ServiceDeps {
  if (memo === undefined) {
    memo = {
      keyPresent: () => (process.env['ANTHROPIC_API_KEY'] ?? '').trim() !== '',
      keeper: keeperFactory({
        repoRoot,
        llm: () => new AnthropicLlmClient(),
        model: () => keeperModel(process.env['KEEPER_MODEL']),
      }),
      store: getStore,
      env: getJourneyEnv,
      newSeed: () => randomBytes(16).toString('hex'),
      routeFor: pregenRoute,
      step: journeyTurn,
      secrets: () => {
        const out = new Set<string>();
        for (const k of SECRET_VARS) {
          const v = process.env[k];
          if (v === undefined) continue;
          for (const s of [v, v.trim(), ...urlPassword(v)]) if (s !== '') out.add(s);
        }
        return [...out];
      },
    };
  }
  return memo;
}
