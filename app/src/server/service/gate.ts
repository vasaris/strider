// The live prose gate (K4, LG1): scanTurnProse from @brodyazhnik/prose-gate -- the same
// deterministic scan the judges run -- over a generation's prose with the pack's VK addendum and
// the turn's STORED package. The verdict is never stored (R3): it is computed when a generation is
// written AND every time a turn is read, so a stricter gate later re-hides old prose.
//
// F3: prose with a BLOCK finding is hidden (never returned by any endpoint); the mechanics stay
// visible. Findings leave the server as { list, term, severity } only: the matched term, never a
// wider prose excerpt, never the offset.
import 'server-only';

import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import { scanTurnProse, type ListId, type Severity, type StopEntry } from '@brodyazhnik/prose-gate';

export interface GateFinding {
  readonly list: ListId;
  readonly term: string;
  readonly severity: Severity;
}

export interface GateVerdict {
  readonly blocked: boolean;
  readonly findings: readonly GateFinding[];
}

export function gateProse(prose: string, vk: readonly StopEntry[], pkg: NarrativePackage): GateVerdict {
  const findings = scanTurnProse(prose, vk, pkg).map((v) => ({ list: v.list, term: v.term, severity: v.severity }));
  return { blocked: findings.some((f) => f.severity === 'block'), findings };
}

/** U+0000 removed (Postgres text cannot hold it: 22021). Applied to Keeper prose before the gate
 *  and the write. */
export const stripNul = (s: string): string => s.replaceAll('\u0000', '');
