// Health probe: the minimal real consumer of the workspace TS packages, so that
// build and dev exercise the R1 path (extensionAlias) now. Smoke target for Ivan.
import { getJourneyEnv } from '../../../server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): Response {
  try {
    const env = getJourneyEnv();
    return Response.json({ ok: true, pack: { id: env.packId, version: env.packVersion } });
  } catch (err) {
    console.error(`health: pack unavailable: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: 'pack_unavailable' }, { status: 503 });
  }
}
