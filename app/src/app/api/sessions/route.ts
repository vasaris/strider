// POST /api/sessions {region} -> 201 { session, nextTurnIndex: 0, journeyComplete: false }.
// Turn indices are 0-based; see server/service/sessions.ts for the order of checks.
import { handleCreateSession } from '../../../server/http/handlers';
import { productionDeps } from '../../../server/service/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req: Request): Promise<Response> {
  return handleCreateSession(req, productionDeps());
}
