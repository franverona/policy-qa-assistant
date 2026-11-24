import { z } from 'zod'
import { chat as llmChat, type Message } from '../llm'
import type { RerankedHit } from '../search/rerank'
import { retrieve as defaultRetrieve, TOP, type Retrieval } from '../search/retrieve'
import { buildMessages } from './prompt'

// Below this top rerank score, nothing retrieved is about the question (gate 1). From the
// m2-rerank check: off-topic queries score ~0.001, the weakest real hit ~0.097. An M6 knob.
export const IDK_THRESHOLD = 0.01

// answerable first: with constrained decoding the model commits to abstaining before any prose.
export const AnswerSchema = z.object({
  answerable: z.boolean(),
  answer: z.string(),
})

// Trust boundary: the /api/ask body.
export const AskBody = z.object({ question: z.string().trim().min(1).max(500) })

export const IDK_MESSAGE = "I don't know: the policy documents and wiki don't cover this."

export type Citation = Pick<
  RerankedHit,
  'chunkId' | 'documentId' | 'title' | 'headingPath' | 'page' | 'anchor' | 'content'
> & { n: number }

export type AnswerResult =
  | { answerable: true; answer: string; citations: Citation[] }
  | {
      answerable: false
      reason: 'low_retrieval_score' | 'model_declined' | 'no_valid_citations'
      answer: string
    }

type Deps = {
  retrieve: (q: string) => Promise<Retrieval>
  chat: (
    messages: Message[],
    schema: typeof AnswerSchema,
  ) => Promise<{ data: z.infer<typeof AnswerSchema> }>
}

const idk = (reason: Extract<AnswerResult, { answerable: false }>['reason']): AnswerResult => ({
  answerable: false,
  reason,
  answer: IDK_MESSAGE,
})

export async function answer(
  question: string,
  { retrieve, chat }: Deps = { retrieve: defaultRetrieve, chat: llmChat },
): Promise<AnswerResult> {
  const hits = (await retrieve(question)).hits.slice(0, TOP)
  // Gate 1: retrieval found nothing relevant, so don't ask the model.
  if (!hits.length || hits[0].rerankScore < IDK_THRESHOLD) return idk('low_retrieval_score')

  const { data } = await chat(buildMessages(question, hits), AnswerSchema)
  // Gate 2: the model says the sources don't answer it.
  if (!data.answerable) return idk('model_declined')

  // Gate 3: only [n] markers that point to a source we sent survive.
  const cited: number[] = []
  const text = data.answer
    .replace(/(\s*)\[(\d+)\]/g, (m, ws: string, d: string, at: number, s: string) => {
      const n = Number(d)
      // Drop an invalid marker; keep its leading space if another marker follows it.
      if (n < 1 || n > hits.length) return s[at + m.length] === '[' ? ws : ''
      if (!cited.includes(n)) cited.push(n)
      return m
    })
    .trim()
  if (!cited.length) return idk('no_valid_citations')

  const citations = cited.map((n) => {
    const { chunkId, documentId, title, headingPath, page, anchor, content } = hits[n - 1]
    return { n, chunkId, documentId, title, headingPath, page, anchor, content }
  })
  return { answerable: true, answer: text, citations }
}
