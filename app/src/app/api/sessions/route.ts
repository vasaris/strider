// POST /api/sessions {region} -> 201 { session, nextTurnIndex: 0, journeyComplete: false }.
// GET /api/sessions -> 200 { sessions: [{ session, nextTurnIndex, journeyComplete }] }, the 20 most
// recent (createdAt desc). Turn indices are 0-based; see server/service/sessions.ts for the order
// of checks.
import { handleCreateSession, handleListSessions } from '../../../server/http/handlers';
import { productionDeps } from '../../../server/service/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request): Promise<Response> {
  return handleListSessions(req, productionDeps());
}

export function POST(req: Request): Promise<Response> {
  return handleCreateSession(req, productionDeps());
}
