// POST /api/sessions/:id/turns/:n/prose -> 201 new prose for turn n (0-based) from the STORED
// package; the engine is not re-run.
import { handleRegenerate } from '../../../../../../../server/http/handlers';
import { productionDeps } from '../../../../../../../server/service/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string; n: string }> }): Promise<Response> {
  const { id, n } = await ctx.params;
  return handleRegenerate(req, id, n, productionDeps());
}
