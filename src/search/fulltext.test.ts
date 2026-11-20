import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testSchema } from '../db/test-schema'
import { ingest } from '../ingest/ingest'
import { fullTextSearch } from './fulltext'

const schema = testSchema('search_test')
const fakeEmbed = async (texts: string[]) => texts.map(() => Array(768).fill(0.1))

// Needs a real Postgres + pgvector: CI provides one; locally run with DATABASE_URL set.
describe.skipIf(!schema)('fullTextSearch', { timeout: 60_000 }, () => {
  const { sql, setup, teardown } = schema!
  const search = (q: string) => fullTextSearch(sql, q, 10)
  beforeAll(async () => {
    await setup()
    await ingest(sql, fakeEmbed, { embedModel: 'fake', embedDim: 768 })
  })
  afterAll(teardown)

  it('ranks the matching clause first, and every hit is citable', async () => {
    const hits = await search('water backup sump')
    expect(hits[0].documentId).toBe('end-water-backup')
    expect(hits[0].score).toBeGreaterThan(hits.at(-1)!.score)
    for (const h of hits) expect(h.page ?? h.anchor).toBeTruthy()
  })

  it('stems words', async () => {
    const hits = await search('deductibles')
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) expect(`${h.headingPath} ${h.content}`).toMatch(/deductible/i)
  })

  it('ORs the words but keeps negation', async () => {
    expect((await search('water backup zebra')).length).toBeGreaterThan(0)
    const hits = await search('water -backup')
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) expect(`${h.headingPath} ${h.content}`).not.toMatch(/backup/i)
  })

  it('returns nothing for a query of stop words', async () => {
    expect(await search('what is the')).toHaveLength(0)
  })
})
