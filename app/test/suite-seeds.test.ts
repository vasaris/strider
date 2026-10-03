// Drift pin (moved here from the C6 round-trip test; 3.1-C7 adds stepsBefore): the shared seed
// list in test/support/suiteSeeds.ts equals the (id, rngSeed, region, eyeGap, stepsBefore)
// tuples of evals/src/harness/suiteSeeds.ts, in order. Read as text: app never imports evals.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SEEDS } from './support/suiteSeeds';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

describe('suite seed drift pin', () => {
  it('matches the (id, rngSeed, region, eyeGap, stepsBefore) tuples of evals/src/harness/suiteSeeds.ts, in order', () => {
    const text = readFileSync(join(REPO, 'evals', 'src', 'harness', 'suiteSeeds.ts'), 'utf8');
    const body = text.slice(text.indexOf('export const SUITE_JOURNEYS'));
    const blocks = body.split(/\n\s*\{\s*\n\s*id: /).slice(1);
    const parsed = blocks.map((b) => {
      const id = /^'([^']+)'/.exec(b)?.[1];
      const rngSeed = /rngSeed: '([^']+)'/.exec(b)?.[1];
      const region = /region: '([^']+)'/.exec(b)?.[1];
      const eyeGap = /eyeGap: (\d+)/.exec(b)?.[1];
      const stepsBefore = /stepsBefore: (\d+)/.exec(b)?.[1];
      return {
        id,
        rngSeed,
        region,
        ...(eyeGap === undefined ? {} : { eyeGap: Number(eyeGap) }),
        ...(stepsBefore === undefined ? {} : { stepsBefore: Number(stepsBefore) }),
      };
    });
    expect(parsed).toEqual(SEEDS);
    expect(parsed.filter((p) => 'stepsBefore' in p).map((p) => p.id)).toEqual(['j.dark.midjourney', 'j.border.arrival']);
  });
});
