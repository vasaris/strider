// The SessionStore contract on PostgresSessionStore over a freshly migrated PGlite.
import { PostgresSessionStore } from '../../src/server/store/postgres';
import { migratedDb } from '../support/pglite';
import { runSessionStoreContract } from './contract';

runSessionStoreContract('postgres (PGlite)', async () => new PostgresSessionStore((await migratedDb()).sql));
