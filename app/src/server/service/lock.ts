// In-process generation lock (K4, API-RES1 (3)), keyed by (sessionId, turnIndex): playing a turn
// (for the index being created) and regenerating its prose hold it for the whole request, so a
// second concurrent request for the same turn gets 409 generation_in_progress and never starts a
// second Keeper call. Released in finally (also on throw).
//
// SINGLE PROCESS ONLY: the map lives in this Node process (production: one module-level instance
// in deps.ts). Several server processes would need a database-level lock (DEFERRED, 3.4.b).
import 'server-only';

export interface GenerationLock {
  /** True when acquired; false when the turn is already held. */
  tryAcquire(sessionId: string, turnIndex: number): boolean;
  release(sessionId: string, turnIndex: number): void;
  isHeld(sessionId: string, turnIndex: number): boolean;
}

const key = (sessionId: string, turnIndex: number) => `${sessionId.toLowerCase()}#${turnIndex}`;

export class InProcessGenerationLock implements GenerationLock {
  private readonly held = new Set<string>();

  tryAcquire(sessionId: string, turnIndex: number): boolean {
    const k = key(sessionId, turnIndex);
    if (this.held.has(k)) return false;
    this.held.add(k);
    return true;
  }

  release(sessionId: string, turnIndex: number): void {
    this.held.delete(key(sessionId, turnIndex));
  }

  isHeld(sessionId: string, turnIndex: number): boolean {
    return this.held.has(key(sessionId, turnIndex));
  }

  /** Number of held turns (tests assert release). */
  get size(): number {
    return this.held.size;
  }
}
