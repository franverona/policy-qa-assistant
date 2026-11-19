import { z } from 'zod'
import type { createLlm } from '.'

// One structured chat + one embed of each kind. `pnpm llm:smoke` runs it against the configured
// provider; with LLM_PROVIDER=record it writes the fixtures that llm.test.ts replays in CI.
export async function smoke(llm: Pick<ReturnType<typeof createLlm>, 'chat' | 'embed'>) {
  const reply = await llm.chat(
    [
      { role: 'system', content: 'You answer insurance questions in one short sentence.' },
      { role: 'user', content: 'What is a deductible?' },
    ],
    z.object({ answer: z.string() }),
  )
  const [query] = await llm.embed(['Is water backup covered?'], 'query')
  const docs = await llm.embed(
    [
      'Water backup is excluded unless the Water Backup endorsement is attached.',
      'Roadside assistance covers towing up to 15 miles.',
    ],
    'document',
  )
  return { answer: reply.data.answer, usage: reply.usage, dims: query.length, docs: docs.length }
}
