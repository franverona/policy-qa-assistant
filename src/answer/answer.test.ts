import { describe, expect, it, vi } from 'vitest'
import type { Message } from '../llm'
import type { RerankedHit } from '../search/rerank'
import { answer, AskBody, IDK_THRESHOLD } from './answer'
import { buildMessages } from './prompt'

const hit = (chunkId: number, rerankScore: number, page: number | null = 1) =>
  ({
    chunkId,
    documentId: `doc-${chunkId}`,
    title: `Doc ${chunkId}`,
    headingPath: `HM-${chunkId} · Doc › Clause`,
    page,
    anchor: page ? null : `clause-${chunkId}`,
    content: `text ${chunkId}`,
    score: 0.03,
    ranks: [1, 1],
    rerankScore,
  }) as RerankedHit
const hits = [
  hit(10, 0.9),
  hit(11, 0.5, null),
  hit(12, 0.2),
  hit(13, 0.1),
  hit(14, 0.05),
  hit(15, 0.04),
]
const retrieve = async () => ({ hits, searchMs: 0, rerankMs: 0 })
const replying = (answerable: boolean, text: string) =>
  vi.fn(async (_messages: Message[]) => ({ data: { answerable, answer: text } }))

describe('answer', () => {
  it('maps [n] markers to the retrieved chunks, deduplicated in first-use order', async () => {
    const chat = replying(true, 'Covered up to $10,000 [2][1]. Not for floods [2].')
    const res = await answer('q', { retrieve, chat })
    expect(res).toMatchObject({
      answerable: true,
      answer: 'Covered up to $10,000 [2][1]. Not for floods [2].',
    })
    if (!res.answerable) throw new Error('expected an answer')
    expect(res.citations).toEqual([
      {
        n: 2,
        chunkId: 11,
        documentId: 'doc-11',
        title: 'Doc 11',
        headingPath: 'HM-11 · Doc › Clause',
        page: null,
        anchor: 'clause-11',
      },
      {
        n: 1,
        chunkId: 10,
        documentId: 'doc-10',
        title: 'Doc 10',
        headingPath: 'HM-10 · Doc › Clause',
        page: 1,
        anchor: null,
      },
    ])
    // Only the top 5 are sent to the model.
    expect(chat.mock.calls[0][0][1].content).not.toContain('[6]')
  })

  it('gate 1: a low top rerank score is IDK without calling the model', async () => {
    const chat = replying(true, 'x [1]')
    const low = async () => ({ hits: [hit(1, IDK_THRESHOLD / 2)], searchMs: 0, rerankMs: 0 })
    expect(await answer('q', { retrieve: low, chat })).toMatchObject({
      answerable: false,
      reason: 'low_retrieval_score',
    })
    const none = async () => ({ hits: [], searchMs: 0, rerankMs: 0 })
    expect(await answer('q', { retrieve: none, chat })).toMatchObject({
      reason: 'low_retrieval_score',
    })
    expect(chat).not.toHaveBeenCalled()
  })

  it('gate 2: the model declines', async () => {
    const res = await answer('q', { retrieve, chat: replying(false, '') })
    expect(res).toMatchObject({ answerable: false, reason: 'model_declined' })
  })

  it('gate 3: out-of-range markers are stripped, and none left is IDK', async () => {
    const res = await answer('q', {
      retrieve,
      chat: replying(true, 'Yes [6]. Limit is $500 [0][3].'),
    })
    expect(res).toMatchObject({ answerable: true, answer: 'Yes. Limit is $500 [3].' })
    expect(await answer('q', { retrieve, chat: replying(true, 'Yes [7].') })).toMatchObject({
      answerable: false,
      reason: 'no_valid_citations',
    })
    expect(await answer('q', { retrieve, chat: replying(true, 'Yes.') })).toMatchObject({
      reason: 'no_valid_citations',
    })
  })
})

describe('buildMessages', () => {
  it('numbers sources with heading path and page/anchor', () => {
    const [, user] = buildMessages('Is it covered?', hits.slice(0, 2))
    expect(user.content).toBe(
      'Sources:\n\n[1] HM-10 · Doc › Clause (doc-10 p.1)\ntext 10\n\n' +
        '[2] HM-11 · Doc › Clause (doc-11 #clause-11)\ntext 11\n\nQuestion: Is it covered?',
    )
  })
})

describe('AskBody', () => {
  it('trims and rejects empty or oversized questions', () => {
    expect(AskBody.parse({ question: '  hi ' })).toEqual({ question: 'hi' })
    for (const bad of [{}, { question: '   ' }, { question: 'x'.repeat(501) }, null])
      expect(AskBody.safeParse(bad).success).toBe(false)
  })
})
