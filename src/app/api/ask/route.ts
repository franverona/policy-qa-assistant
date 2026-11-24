import { z } from 'zod'
import { answer, AskBody } from '@/answer/answer'

// POST { question } → a cited answer or an "I don't know" with the gate that triggered it.
export async function POST(request: Request) {
  const body = AskBody.safeParse(await request.json().catch(() => null))
  if (!body.success) return Response.json({ error: z.prettifyError(body.error) }, { status: 400 })
  return Response.json(await answer(body.data.question))
}
