// GET /api/sessions/:id -> { session, turns, nextTurnIndex (0-based), journeyComplete, packCurrent }.
import { handleGetSession } from '../../../../server/http/handlers';
import { productionDeps } from '../../../../server/service/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return handleGetSession(req, id, productionDeps());
}
