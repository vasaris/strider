// ONE contract for every SessionStore implementation (memory, postgres): methods, ordering,
// null-returns, typed errors, P10 bounds, contiguity, prose XOR error, provenance round-trip,
// the shared input rules (validate.ts: string types, no lone surrogates) and their order, and
// immutability of every returned record and of inputs after the call.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadJourneyEnv, journeyTurn, PREGEN_HERO_REF, startJourney } from '@brodyazhnik/orchestrator';
import { beforeAll, describe, expect, it } from 'vitest';

import type { KeeperProvenance, NewGeneration, NewSession, NewTurn, SessionStore } from '../../src/server/store/types';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const env = loadJourneyEnv(join(REPO, 'content-packs', 'kv'));

const START = startJourney(env.cfg, { rngSeed: 'a3-3', region: 'dark_lands' }); // at least 3 turns (j.dark.midjourney)
const T0 = journeyTurn(START, env.cfg);
const T1 = journeyTurn(T0.next, env.cfg);
const T2 = journeyTurn(T1.next, env.cfg);
const TURNS = [T0, T1, T2];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ABSENT = '00000000-0000-4000-8000-000000000000';

const PROV: KeeperProvenance = {
  model: 'claude-test-model',
  keeperPromptPath: 'prompts/keeper.v0.3.md',
  keeperPromptSha256: '0'.repeat(64),
  toneSha256: '1'.repeat(63) + 'f',
  assemblySha256: 'ab'.repeat(32),
};

const newSession = (over: Partial<Record<keyof NewSession, unknown>> = {}): NewSession =>
  ({ rngSeed: 'a3-1', heroRef: PREGEN_HERO_REF, packId: env.packId, packVersion: env.packVersion, initialState: START, ...over }) as NewSession;

const newTurn = (sessionId: string, turnIndex: number, over: Partial<Record<keyof NewTurn, unknown>> = {}): NewTurn => {
  const t = TURNS[turnIndex] ?? T0;
  return { sessionId, turnIndex, state: t.next, pkg: t.pkg, packVersion: env.packVersion, ...over } as NewTurn;
};

const prose = (sessionId: string, turnIndex: number, text = 'The wind smelled of rain.', over: Record<string, unknown> = {}): NewGeneration =>
  ({ sessionId, turnIndex, ...PROV, prose: text, error: null, ...over }) as NewGeneration;

const failure = (sessionId: string, turnIndex: number, error = 'keeper_failed'): NewGeneration =>
  ({ sessionId, turnIndex, ...PROV, prose: null, error }) as NewGeneration;

/** Deep-mutate anything (records are readonly by type; the point is that nothing leaks back). */
function scribble(v: unknown): void {
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const x = o[k];
    if (x !== null && typeof x === 'object') scribble(x);
    else o[k] = typeof x === 'number' ? -999 : 'scribbled';
  }
}

const clone = <T>(v: T): T => structuredClone(v);

export function runSessionStoreContract(name: string, makeStore: () => Promise<SessionStore>): void {
  describe(`SessionStore contract: ${name}`, () => {
    let store: SessionStore;
    beforeAll(async () => {
      store = await makeStore();
    });

    const seeded = async (turns = 0) => {
      const s = await store.createSession(newSession());
      for (let i = 0; i < turns; i++) await store.appendTurn(newTurn(s.id, i));
      return s.id;
    };

    describe('sessions', () => {
      it('createSession returns the record and getSession reads it back', async () => {
        const input = newSession();
        const rec = await store.createSession(input);
        expect(rec.id).toMatch(UUID);
        expect(rec.createdAt).toMatch(ISO);
        expect(rec).toEqual({ id: rec.id, createdAt: rec.createdAt, ...input });
        expect(await store.getSession(rec.id)).toEqual(rec);
        expect(await store.getSession(rec.id.toUpperCase())).toEqual(rec);
      });

      it('gives every session its own id', async () => {
        const a = await store.createSession(newSession());
        const b = await store.createSession(newSession());
        expect(a.id).not.toBe(b.id);
      });

      it('getSession returns null for an absent or malformed id', async () => {
        expect(await store.getSession(ABSENT)).toBeNull();
        expect(await store.getSession('nope')).toBeNull();
        expect(await store.getSession('')).toBeNull();
      });

      it("P10: rng_seed 'a3-1', 1 and 128 characters are accepted; '' and 129 are not", async () => {
        for (const rngSeed of ['a3-1', 'x', 'x'.repeat(128), '\u00e9'.repeat(128)]) {
          expect((await store.createSession(newSession({ rngSeed }))).rngSeed).toBe(rngSeed);
        }
        for (const rngSeed of ['', 'x'.repeat(129)]) {
          await expect(store.createSession(newSession({ rngSeed }))).rejects.toMatchObject({ code: 'invalid_record' });
        }
      });

      it('accepts the six characters \\u0000 (a backslash, not NUL) in json', async () => {
        const initialState = { ...START, note: '\\u0000' } as unknown as NewSession['initialState'];
        const rec = await store.createSession(newSession({ initialState }));
        expect((await store.getSession(rec.id))?.initialState).toEqual(initialState);
      });

      it('accepts surrogate pairs in text and json', async () => {
        const initialState = { ...START, ['k\uD83D\uDE00']: 'v\uD83D\uDE00' } as unknown as NewSession['initialState'];
        const rec = await store.createSession(newSession({ heroRef: 'h\uD83D\uDE00', initialState }));
        const back = await store.getSession(rec.id);
        expect(back?.heroRef).toBe('h\uD83D\uDE00');
        expect(back?.initialState).toEqual(initialState);
      });

      it.each([
        ['heroRef empty', { heroRef: '' }],
        ['heroRef 129 characters', { heroRef: 'h'.repeat(129) }],
        ['packId empty', { packId: '' }],
        ['packVersion empty', { packVersion: '' }],
        ['rngSeed missing', { rngSeed: undefined }],
        ['rngSeed with NUL', { rngSeed: 'a\u0000b' }],
        ['initialState an array', { initialState: [] }],
        ['initialState a string', { initialState: 'state' }],
        ['initialState null', { initialState: null }],
        ['initialState missing', { initialState: undefined }],
        ['initialState with a NUL string', { initialState: { ...START, x: '\u0000' } }],
        ['rngSeed a number', { rngSeed: 123 }],
        ['heroRef an object', { heroRef: { ref: 'h' } }],
        ['heroRef with a lone high surrogate', { heroRef: 'h\uD800' }],
        ['packId with a lone low surrogate', { packId: '\uDC00kv' }],
        ['initialState with a lone surrogate in a nested string', { initialState: { ...START, x: { y: ['ok', 'a\uDC00'] } } }],
        ['initialState with a lone surrogate in a key', { initialState: { ...START, ['k\uD800']: 1 } }],
      ])('rejects %s as invalid_record', async (_, over) => {
        await expect(store.createSession(newSession(over))).rejects.toMatchObject({ code: 'invalid_record' });
      });
    });

    describe('turns', () => {
      it('appends 0, 1, 2 and reads them back in order', async () => {
        const sid = await seeded();
        for (let i = 0; i < 3; i++) {
          const input = newTurn(sid, i);
          const rec = await store.appendTurn(input);
          expect(rec.createdAt).toMatch(ISO);
          expect(rec).toEqual({ ...input, createdAt: rec.createdAt });
          expect(await store.getTurn(sid, i)).toEqual(rec);
          expect(await store.latestTurn(sid)).toEqual(rec);
        }
        const list = await store.listTurns(sid);
        expect(list.map((t) => t.turnIndex)).toEqual([0, 1, 2]);
        expect(list.map((t) => t.state)).toEqual([T0.next, T1.next, T2.next]);
        expect(list.map((t) => t.pkg)).toEqual([T0.pkg, T1.pkg, T2.pkg]);
      });

      it('returns null / [] for absent turns and sessions', async () => {
        const sid = await seeded(1);
        expect(await store.getTurn(sid, 1)).toBeNull();
        expect(await store.getTurn(sid, -1)).toBeNull();
        expect(await store.getTurn(sid, 0.5)).toBeNull();
        expect(await store.getTurn(ABSENT, 0)).toBeNull();
        expect(await store.getTurn('nope', 0)).toBeNull();
        expect(await store.listTurns(ABSENT)).toEqual([]);
        expect(await store.listTurns('nope')).toEqual([]);
        expect(await store.latestTurn(ABSENT)).toBeNull();
        expect(await store.latestTurn('nope')).toBeNull();
        expect(await store.latestTurn(await seeded())).toBeNull();
        expect(await store.listTurns(await seeded())).toEqual([]);
      });

      it('keeps sessions apart', async () => {
        const a = await seeded(2);
        const b = await seeded(1);
        expect((await store.listTurns(a)).map((t) => t.sessionId)).toEqual([a, a]);
        expect((await store.listTurns(b)).map((t) => t.sessionId)).toEqual([b]);
        expect((await store.latestTurn(b))?.turnIndex).toBe(0);
      });

      it('checks id shapes, then input rules, then the session: the same order in every store', async () => {
        const bad = { state: { ...T0.next, x: '\uD800' } };
        await expect(store.appendTurn(newTurn('nope', 0, bad))).rejects.toMatchObject({ code: 'session_not_found' });
        await expect(store.appendTurn(newTurn(ABSENT, 0, bad))).rejects.toMatchObject({ code: 'invalid_record' });
        await expect(store.appendGeneration(prose('nope', 0, 'a\uD800'))).rejects.toMatchObject({ code: 'turn_not_found' });
        await expect(store.appendGeneration(prose(ABSENT, 0, 'a\uD800'))).rejects.toMatchObject({ code: 'invalid_record' });
      });

      it('session_not_found for an absent or malformed session id', async () => {
        await expect(store.appendTurn(newTurn(ABSENT, 0))).rejects.toMatchObject({ code: 'session_not_found' });
        await expect(store.appendTurn(newTurn('nope', 0))).rejects.toMatchObject({ code: 'session_not_found' });
      });

      it('turn_conflict for a gap, a duplicate, a first index other than 0, a negative index', async () => {
        const sid = await seeded();
        await expect(store.appendTurn(newTurn(sid, 1))).rejects.toMatchObject({ code: 'turn_conflict' });
        await expect(store.appendTurn(newTurn(sid, -1))).rejects.toMatchObject({ code: 'turn_conflict' });
        await store.appendTurn(newTurn(sid, 0));
        await expect(store.appendTurn(newTurn(sid, 0))).rejects.toMatchObject({ code: 'turn_conflict' });
        await expect(store.appendTurn(newTurn(sid, 2))).rejects.toMatchObject({ code: 'turn_conflict' });
        await store.appendTurn(newTurn(sid, 1));
        expect((await store.listTurns(sid)).map((t) => t.turnIndex)).toEqual([0, 1]);
      });

      it.each([
        ['a fractional index', { turnIndex: 0.5 }],
        ['an index beyond int32', { turnIndex: 2 ** 31 }],
        ['state an array', { state: [] }],
        ['state null', { state: null }],
        ['pkg a number', { pkg: 7 }],
        ['pkg missing', { pkg: undefined }],
        ['packVersion empty', { packVersion: '' }],
        ['packVersion a number', { packVersion: 1 }],
        ['packVersion with a lone surrogate', { packVersion: '0.1.0\uD800' }],
        ['state with a lone surrogate in a nested string', { state: { ...T0.next, x: [{ y: '\uDC00' }] } }],
        ['pkg with a lone surrogate in a key', { pkg: { ...T0.pkg, ['\uD800']: 'v' } }],
      ])('rejects %s as invalid_record', async (_, over) => {
        const sid = await seeded();
        await expect(store.appendTurn(newTurn(sid, 0, over))).rejects.toMatchObject({ code: 'invalid_record' });
        expect(await store.listTurns(sid)).toEqual([]);
      });
    });

    describe('generations', () => {
      it('appends prose and errors with provenance; lists in creation order; latest is the last', async () => {
        const sid = await seeded(2);
        const inputs = [prose(sid, 0, 'first'), failure(sid, 0), prose(sid, 0, 'second'), prose(sid, 1, 'other turn')];
        const recs = [];
        for (const g of inputs) {
          const rec = await store.appendGeneration(g);
          expect(rec.id).toMatch(/^[1-9]\d*$/);
          expect(rec.createdAt).toMatch(ISO);
          expect(rec).toEqual({ ...g, id: rec.id, createdAt: rec.createdAt });
          recs.push(rec);
        }
        const ids = recs.map((r) => BigInt(r.id));
        expect([...ids].sort((a, b) => (a < b ? -1 : 1))).toEqual(ids);
        expect(await store.listGenerations(sid, 0)).toEqual(recs.slice(0, 3));
        expect(await store.listGenerations(sid, 1)).toEqual([recs[3]]);
        expect(await store.latestGeneration(sid, 0)).toEqual(recs[2]);
        const back = await store.latestGeneration(sid, 1);
        expect(back).toMatchObject({ ...PROV, prose: 'other turn', error: null });
      });

      it('returns [] / null where there are none', async () => {
        const sid = await seeded(1);
        expect(await store.listGenerations(sid, 0)).toEqual([]);
        expect(await store.latestGeneration(sid, 0)).toBeNull();
        expect(await store.listGenerations(sid, 5)).toEqual([]);
        expect(await store.latestGeneration(ABSENT, 0)).toBeNull();
        expect(await store.listGenerations('nope', 0)).toEqual([]);
        expect(await store.latestGeneration('nope', 0)).toBeNull();
      });

      it('turn_not_found for a missing turn or session', async () => {
        const sid = await seeded(1);
        await expect(store.appendGeneration(prose(sid, 1))).rejects.toMatchObject({ code: 'turn_not_found' });
        await expect(store.appendGeneration(prose(ABSENT, 0))).rejects.toMatchObject({ code: 'turn_not_found' });
        await expect(store.appendGeneration(prose('nope', 0))).rejects.toMatchObject({ code: 'turn_not_found' });
        await expect(store.appendGeneration(prose(sid, 0.5))).rejects.toMatchObject({ code: 'turn_not_found' });
      });

      it.each([
        ['prose and error both set', { error: 'e' }],
        ['prose and error both null', { prose: null }],
        ['empty prose', { prose: '' }],
        ['empty error', { prose: null, error: '' }],
        ['empty model', { model: '' }],
        ['empty keeperPromptPath', { keeperPromptPath: '' }],
        ['uppercase keeper sha', { keeperPromptSha256: 'A'.repeat(64) }],
        ['short tone sha', { toneSha256: 'a'.repeat(63) }],
        ['long assembly sha', { assemblySha256: 'a'.repeat(65) }],
        ['sha with a trailing newline', { assemblySha256: `${'a'.repeat(64)}\n` }],
        ['missing model', { model: undefined }],
        ['prose with NUL', { prose: 'a\u0000' }],
        ['prose a number', { prose: 5 }],
        ['model an array', { model: ['m'] }],
        ['prose with a lone surrogate', { prose: 'a\uDC00b' }],
        ['error with a lone surrogate', { prose: null, error: '\uD800' }],
        ['keeperPromptPath with a lone surrogate', { keeperPromptPath: 'prompts/\uD800.md' }],
        ['prose undefined with an error', { prose: undefined, error: 'e' }],
        ['error undefined with prose', { error: undefined }],
      ])('rejects %s as invalid_record', async (_, over) => {
        const sid = await seeded(1);
        await expect(store.appendGeneration(prose(sid, 0, 'p', over))).rejects.toMatchObject({ code: 'invalid_record' });
        expect(await store.listGenerations(sid, 0)).toEqual([]);
      });
    });

    describe('immutability', () => {
      it('mutating a returned record or the input after the call does not change what is read back', async () => {
        const sInput = clone(newSession());
        const s = await store.createSession(sInput);
        const sExpected = clone(s);
        scribble(s);
        scribble(sInput);
        const sRead = await store.getSession(sExpected.id);
        expect(sRead).toEqual(sExpected);
        scribble(sRead);
        expect(await store.getSession(sExpected.id)).toEqual(sExpected);

        const tInput = clone(newTurn(sExpected.id, 0));
        const t = await store.appendTurn(tInput);
        const tExpected = clone(t);
        scribble(t);
        scribble(tInput);
        const tRead = await store.getTurn(sExpected.id, 0);
        expect(tRead).toEqual(tExpected);
        scribble(tRead);
        expect(await store.listTurns(sExpected.id)).toEqual([tExpected]);
        const listed = await store.listTurns(sExpected.id);
        scribble(listed);
        const tLatest = await store.latestTurn(sExpected.id);
        expect(tLatest).toEqual(tExpected);
        scribble(tLatest);
        expect(await store.latestTurn(sExpected.id)).toEqual(tExpected);
        expect(await store.getTurn(sExpected.id, 0)).toEqual(tExpected);
        expect(await store.listTurns(sExpected.id)).toEqual([tExpected]);

        const gInput = clone(prose(sExpected.id, 0));
        const g = await store.appendGeneration(gInput);
        const gExpected = clone(g);
        scribble(g);
        scribble(gInput);
        const gRead = await store.latestGeneration(sExpected.id, 0);
        expect(gRead).toEqual(gExpected);
        scribble(gRead);
        expect(await store.latestGeneration(sExpected.id, 0)).toEqual(gExpected);
        scribble(await store.listGenerations(sExpected.id, 0));
        expect(await store.listGenerations(sExpected.id, 0)).toEqual([gExpected]);
        expect(await store.latestGeneration(sExpected.id, 0)).toEqual(gExpected);
      });
    });
  });
}
