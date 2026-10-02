// SQLSTATE -> typed error mapping of PostgresSessionStore with a FAKE executor: codes the real
// schema cannot produce in a test (23505 loses to the BRD01 trigger; 22P02 is pre-empted by
// validate.ts) are still mapped, and anything unmapped propagates unchanged.
import { describe, expect, it } from 'vitest';

import type { SqlExecutor } from '../../src/server/db/sql';
import { PostgresSessionStore } from '../../src/server/store/postgres';
import type { NewGeneration, NewSession, NewTurn } from '../../src/server/store/types';

const SID = '00000000-0000-4000-8000-000000000000';
const SHA = 'a'.repeat(64);

function failing(code: string): { store: PostgresSessionStore; err: Error } {
  const err = Object.assign(new Error(`driver error ${code}`), { code });
  const sql: SqlExecutor = {
    async query() {
      throw err;
    },
    async exec() {
      throw err;
    },
  };
  return { store: new PostgresSessionStore(sql), err };
}

const session = { rngSeed: 's', heroRef: 'h', packId: 'kv', packVersion: '0.1.0', initialState: {} } as unknown as NewSession;
const turn = { sessionId: SID, turnIndex: 0, state: {}, pkg: {}, packVersion: '0.1.0' } as unknown as NewTurn;
const generation: NewGeneration = {
  sessionId: SID,
  turnIndex: 0,
  prose: 'p',
  error: null,
  model: 'm',
  keeperPromptPath: 'prompts/k.md',
  keeperPromptSha256: SHA,
  toneSha256: SHA,
  assemblySha256: SHA,
};

describe('PostgresSessionStore SQLSTATE mapping', () => {
  it.each([
    ['23505', 'turn_conflict'],
    ['BRD01', 'turn_conflict'],
    ['23503', 'session_not_found'],
    ['22P02', 'invalid_record'],
    ['23514', 'invalid_record'],
  ])('appendTurn: %s -> %s', async (code, mapped) => {
    await expect(failing(code).store.appendTurn(turn)).rejects.toMatchObject({ code: mapped });
  });

  it.each([
    ['23503', 'turn_not_found'],
    ['22P02', 'invalid_record'],
    ['23502', 'invalid_record'],
  ])('appendGeneration: %s -> %s', async (code, mapped) => {
    await expect(failing(code).store.appendGeneration(generation)).rejects.toMatchObject({ code: mapped });
  });

  it.each(['22P02', '22021', '22P05'])('createSession: %s -> invalid_record', async (code) => {
    await expect(failing(code).store.createSession(session)).rejects.toMatchObject({ code: 'invalid_record' });
  });

  it.each([
    ['createSession', (s: PostgresSessionStore) => s.createSession(session)],
    ['appendTurn', (s: PostgresSessionStore) => s.appendTurn(turn)],
    ['appendGeneration', (s: PostgresSessionStore) => s.appendGeneration(generation)],
    ['getSession', (s: PostgresSessionStore) => s.getSession(SID)],
  ])('%s: an unmapped code (08006) propagates as the same object', async (_, call) => {
    const { store, err } = failing('08006');
    await expect(call(store)).rejects.toBe(err);
  });
});
