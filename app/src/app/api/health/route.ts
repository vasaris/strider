// Health probe: the minimal real consumer of the workspace TS packages, so that
// build and dev exercise the R1 path (extensionAlias) now. Smoke target for Ivan.
// 3.1-C7: Host check (DNS rebinding) like every API route; the response contract is unchanged.
import { ApiError, errorResponse } from '../../../server/http/errors';
import { checkHost } from '../../../server/http/guard';
import { getJourneyEnv } from '../../../server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request): Response {
  try {
    checkHost(req);
  } catch (err) {
    return errorResponse(err instanceof ApiError ? err : new ApiError('forbidden_host'));
  }
  try {
    const env = getJourneyEnv();
    return Response.json({ ok: true, pack: { id: env.packId, version: env.packVersion } });
  } catch (err) {
    console.error(`health: pack unavailable: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: 'pack_unavailable' }, { status: 503 });
  }
}
