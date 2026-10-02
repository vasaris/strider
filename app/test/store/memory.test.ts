// The SessionStore contract on the in-memory implementation.
import { MemorySessionStore } from '../../src/server/store/memory';
import { runSessionStoreContract } from './contract';

runSessionStoreContract('memory', async () => new MemorySessionStore());
