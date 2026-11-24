import { getDb } from '@/db/client'
import { serveDoc } from '@/docs/serve'

// GET /docs/<id>#page=N (policy PDFs) or /docs/<id>#anchor (wiki pages): citation targets.
export async function GET(_req: Request, ctx: RouteContext<'/docs/[id]'>) {
  return serveDoc(getDb(), (await ctx.params).id)
}
