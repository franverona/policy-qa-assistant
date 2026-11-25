import { answer, type AnswerResult, type Citation } from '../answer/answer'
import type { Retrieval } from '../search/retrieve'
import type { Question } from './questions'

type Deps = NonNullable<Parameters<typeof answer>[1]>

// Chunk text is left out of reports: it's in the db, and 55 × 20 chunks would bloat the JSON.
export type Retrieved = Pick<
  Retrieval['hits'][number],
  'chunkId' | 'documentId' | 'headingPath' | 'page' | 'anchor' | 'rerankScore'
>

type Answered = Extract<AnswerResult, { answerable: true }>
export type EvalResult =
  | Exclude<AnswerResult, Answered>
  | (Omit<Answered, 'citations'> & { citations: Omit<Citation, 'content'>[] })

export type EvalRecord = {
  question: Question
  retrieved: Retrieved[] // all reranked hits (FUSED), best first; answer() saw the first TOP
  result: EvalResult | null // null when the question threw
  error?: string
  ms: { search: number; rerank: number; answer: number }
}

// One question at a time: Ollama serves one model, and sequential timings stay comparable.
export async function runEval(
  questions: Question[],
  { retrieve, chat }: Deps,
  onRecord?: (r: EvalRecord, i: number) => void,
): Promise<EvalRecord[]> {
  const records: EvalRecord[] = []
  for (const question of questions) {
    const record: EvalRecord = {
      question,
      retrieved: [],
      result: null,
      ms: { search: 0, rerank: 0, answer: 0 },
    }
    try {
      const retrieval = await retrieve(question.question)
      record.ms.search = retrieval.searchMs
      record.ms.rerank = retrieval.rerankMs
      record.retrieved = retrieval.hits.map(
        ({ chunkId, documentId, headingPath, page, anchor, rerankScore }) => ({
          chunkId,
          documentId,
          headingPath,
          page,
          anchor,
          rerankScore,
        }),
      )
      const t0 = performance.now()
      // Hand answer() this retrieval so it doesn't search a second time.
      const result = await answer(question.question, { retrieve: async () => retrieval, chat })
      record.ms.answer = Math.round(performance.now() - t0)
      record.result = result.answerable
        ? { ...result, citations: result.citations.map(({ content: _, ...c }) => c) }
        : result
    } catch (err) {
      // A long run keeps going; scoring counts an errored question as a miss.
      record.error = err instanceof Error ? err.message : String(err)
    }
    records.push(record)
    onRecord?.(record, records.length)
  }
  return records
}
