import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testSchema } from '../db/test-schema'
import { ingest } from '../ingest/ingest'
import { vectorSearch } from './vector'

const schema = testSchema('vector_test')
// Random vectors: these tests check the mechanics, not semantic quality (that's the M4 eval).
const fakeEmbed = async (texts: string[]) =>
  texts.map(() => Array.from({ length: 768 }, () => Math.random() - 0.5))

// Needs a real Postgres + pgvector: CI provides one; locally run with DATABASE_URL set.
describe.skipIf(!schema)('vectorSearch', { timeout: 60_000 }, () => {
  const { sql, setup, teardown } = schema!
  beforeAll(async () => {
    await setup()
    await ingest(sql, fakeEmbed, { embedModel: 'fake', embedDim: 768 })
  })
  afterAll(teardown)

  it('ranks the chunk with the query embedding first, and every hit is citable', async () => {
    const [row] = await sql`select id::int, embedding::text from chunks
                            where document_id = 'end-water-backup' limit 1`
    const hits = await vectorSearch(sql, JSON.parse(row.embedding), 10)
    expect(hits).toHaveLength(10)
    expect(hits[0].chunkId).toBe(row.id)
    expect(hits[0].score).toBeCloseTo(1, 5)
    for (let i = 1; i < hits.length; i++)
      expect(hits[i].score).toBeLessThanOrEqual(hits[i - 1].score)
    for (const h of hits) expect(h.page ?? h.anchor).toBeTruthy()
  })

  it('returns more than hnsw.ef_search (40) hits when asked', async () => {
    // 339 chunks are few enough that the planner seq-scans; force the HNSW index, which is
    // where the 40-row cap applies.
    const indexed = postgres(process.env.DATABASE_URL!, {
      connection: { search_path: 'vector_test, public', enable_seqscan: 'off' },
    })
    const [query] = await fakeEmbed(['x'])
    expect(await vectorSearch(indexed, query, 60)).toHaveLength(60)
    await indexed.end()
  })
})
