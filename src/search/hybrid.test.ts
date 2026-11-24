import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testSchema } from '../db/test-schema'
import { ingest } from '../ingest/ingest'
import type { SearchHit } from './fulltext'
import { hybridSearch, RRF_K, rrf } from './hybrid'

const hit = (chunkId: number) => ({ chunkId }) as SearchHit

describe('rrf', () => {
  it('ranks agreement between lists above a single first place', () => {
    // chunk 3 is 10th in both lists; chunk 1 is 1st in only one.
    const a = [1, 4, 5, 6, 7, 8, 9, 10, 11, 3].map(hit)
    const b = [2, 12, 13, 14, 15, 16, 17, 18, 19, 3].map(hit)
    const fused = rrf([a, b])
    expect(fused[0]).toMatchObject({ chunkId: 3, ranks: [10, 10] })
    expect(fused[0].score).toBeCloseTo(2 / (RRF_K + 10))
    expect(fused.find((h) => h.chunkId === 1)).toMatchObject({ ranks: [1, null] })
  })

  it('breaks ties by chunk id and keeps every chunk once', () => {
    const fused = rrf([[hit(7)], [hit(2)]])
    expect(fused.map((h) => h.chunkId)).toEqual([2, 7])
    expect(
      rrf([
        [hit(1), hit(2)],
        [hit(2), hit(1)],
      ]),
    ).toHaveLength(2)
  })

  it('passes one list through when the other is empty', () => {
    expect(rrf([[], [hit(5), hit(6)]]).map((h) => h.chunkId)).toEqual([5, 6])
  })
})

const schema = testSchema('hybrid_test')
const fakeEmbed = async (texts: string[]) =>
  texts.map(() => Array.from({ length: 768 }, () => Math.random() - 0.5))

// Needs a real Postgres + pgvector: CI provides one; locally run with DATABASE_URL set.
describe.skipIf(schema.skip)('hybridSearch', { timeout: 60_000 }, () => {
  const { sql, setup, teardown } = schema
  beforeAll(async () => {
    await setup()
    await ingest(sql, fakeEmbed, { embedModel: 'fake', embedDim: 768 })
  })
  afterAll(teardown)

  it('fuses the full-text and the vector results', async () => {
    // The "query embedding" is a wiki chunk's own vector, so vector search ranks it first.
    const [row] = await sql`select id::int, embedding::text from chunks
                            where document_id = 'wiki-auto-claims' limit 1`
    const embed = async () => [JSON.parse(row.embedding) as number[]]
    const hits = await hybridSearch(sql, embed, 'HM-END-04', { candidates: 20, limit: 10 })
    expect(hits).toHaveLength(10)
    expect(hits.map((h) => h.documentId)).toContain('end-water-backup')
    expect(hits.find((h) => h.chunkId === row.id)?.ranks[1]).toBe(1)
    for (const h of hits) expect(h.page ?? h.anchor).toBeTruthy()
  })
})
