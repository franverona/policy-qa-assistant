import { describe, expect, it, vi } from 'vitest'
import type { RerankedHit } from '../search/rerank'
import type { Question } from './questions'
import { toMarkdown, type ReportMeta } from './report'
import { runEval } from './run'
import { score } from './score'

const hit = (chunkId: number, documentId: string, clause: string) =>
  ({
    chunkId,
    documentId,
    title: documentId,
    headingPath: `HM-X · Doc › ${clause}`,
    page: 1,
    anchor: null,
    content: `text ${chunkId}`,
    score: 0.03,
    ranks: [1, 1],
    rerankScore: 0.9,
  }) as RerankedHit

const questions: Question[] = [
  {
    id: 'q01',
    question: 'What is the deductible?',
    answerable: true,
    category: 'lookup',
    sources: [{ doc: 'end-water-backup', clause: '4 Deductible' }],
    facts: ['$1,000'],
    reference: '$1,000.',
  },
  {
    id: 'u01',
    question: 'How much is the premium?',
    answerable: false,
    category: 'pricing',
    reference: 'Not in the corpus.',
  },
]

const meta: ReportMeta = {
  date: '2026-11-25T10:00:00.000Z',
  commit: 'abc1234',
  provider: 'fixture',
  models: { chat: 'qwen3:8b', embed: 'nomic-embed-text', rerank: 'bge-reranker-base' },
  knobs: { candidates: 50, fused: 20, top: 5, idkThreshold: 0.01 },
  questions: 2,
  durationMs: 3000,
}

describe('runEval', () => {
  it('retrieves once per question, strips chunk text and records errors', async () => {
    const retrieve = vi.fn(async (q: string) => {
      if (q.includes('premium')) throw new Error('ollama down')
      return {
        hits: [hit(1, 'other', '1 Scope'), hit(2, 'end-water-backup', '4 Deductible')],
        searchMs: 7,
        rerankMs: 3,
      }
    })
    const chat = vi.fn(async () => ({ data: { answerable: true, answer: '$1,000 [2].' } }))

    const records = await runEval(questions, { retrieve, chat })

    expect(retrieve).toHaveBeenCalledTimes(2)
    const [ok, failed] = records
    expect(ok.ms).toMatchObject({ search: 7, rerank: 3 })
    expect(ok.retrieved).toHaveLength(2)
    expect(ok.retrieved[0]).not.toHaveProperty('content')
    expect(ok.result).toMatchObject({ answerable: true, citations: [{ n: 2, chunkId: 2 }] })
    if (!ok.result?.answerable) throw new Error('expected an answer')
    expect(ok.result.citations[0]).not.toHaveProperty('content')
    expect(failed).toMatchObject({ result: null, error: 'ollama down', retrieved: [] })

    const md = toMarkdown({ meta, scores: score(records), records })
    expect(md).toContain('`qwen3:8b`')
    expect(md).toContain('| — | — | — | — | — |') // score.ts is still a stub
    expect(md).toContain('| q01 | lookup | ✓ | $1,000 [2]. |')
    expect(md).toContain('| u01 | pricing |  | **error:** ollama down |')
    expect(md).toContain('1 errors')
  })

  it('counts IDKs per gate in the report', async () => {
    const retrieve = async () => ({ hits: [hit(1, 'x', 'y')], searchMs: 0, rerankMs: 0 })
    const chat = async () => ({ data: { answerable: false, answer: '' } })
    const records = await runEval(questions, { retrieve, chat })
    expect(records.map((r) => r.result)).toMatchObject([
      { answerable: false, reason: 'model_declined' },
      { answerable: false, reason: 'model_declined' },
    ])
    const md = toMarkdown({ meta, scores: score(records), records })
    expect(md).toContain('- `model_declined`: 2')
    expect(md).toContain('| q01 | lookup | ✗ | IDK (model_declined) |')
  })
})
