// POST /api/sessions/:id/turns {turnIndex} -> 201 one engine turn + its prose (or 502 with the
// turn saved). turnIndex is 0-based and must equal the session's nextTurnIndex.
import { handlePlayTurn } from '../../../../../server/http/handlers';
import { productionDeps } from '../../../../../server/service/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return handlePlayTurn(req, id, productionDeps());
}
