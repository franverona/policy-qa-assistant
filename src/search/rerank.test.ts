import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { fixtureKey, writeFixture } from '../llm/fixtures'
import type { HybridHit } from './hybrid'
import { createReranker } from './rerank'

const dir = mkdtempSync(path.join(tmpdir(), 'rerank-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const hit = (chunkId: number, ranks: (number | null)[]) =>
  ({
    chunkId,
    headingPath: `H${chunkId}`,
    content: `text ${chunkId}`,
    score: 0.03,
    ranks,
  }) as HybridHit
const hits = [hit(1, [1, null]), hit(2, [null, 1]), hit(3, [2, 2])]
const docs = hits.map((h) => `${h.headingPath}\n\n${h.content}`)

// Replays scores, so these tests never load the model (same rule as chat/embed fixtures).
describe('rerank', () => {
  const rerank = createReranker({ LLM_PROVIDER: 'fixture', RERANK_MODEL: 'fake' }, dir)

  it('sorts by the cross-encoder score and keeps each hit as it was', async () => {
    const key = fixtureKey('rerank', { query: 'q', docs })
    await writeFixture(dir, key, { model: 'fake', request: {}, response: [0.2, 0.9, 0.2] })
    const ranked = await rerank('q', hits)
    expect(ranked.map((h) => [h.chunkId, h.rerankScore])).toEqual([
      [2, 0.9],
      [1, 0.2], // tie with 3, broken by chunk id
      [3, 0.2],
    ])
    expect(ranked[2]).toMatchObject({ headingPath: 'H3', score: 0.03, ranks: [2, 2] })
  })

  it('returns nothing for no hits without scoring', async () => {
    expect(await rerank('q', [])).toEqual([])
  })

  it('tells you how to record a missing fixture', async () => {
    await expect(rerank('other query', hits)).rejects.toThrow(/LLM_PROVIDER=record/)
  })
})
