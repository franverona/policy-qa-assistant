import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testSchema } from '../db/test-schema'
import { ingest } from './ingest'

const schema = testSchema('ingest_test')

let calls = 0
const fakeEmbed = async (texts: string[]) => {
  calls++
  return texts.map(() => Array(768).fill(0.1))
}
const opts = { embedModel: 'fake', embedDim: 768 }
const DOCS = 30

// Needs a real Postgres + pgvector: CI provides one; locally run with DATABASE_URL set.
describe.skipIf(schema.skip)('ingest', { timeout: 60_000 }, () => {
  const { sql: db, setup, teardown } = schema
  beforeAll(setup)
  afterAll(teardown)

  it('ingests every doc with citable chunks', async () => {
    const r = await ingest(db, fakeEmbed, opts)
    expect(r.ingested).toHaveLength(DOCS)
    const rows = await db`select d.type, c.page, c.anchor, c.ordinal, c.document_id
                          from chunks c join documents d on d.id = c.document_id`
    for (const row of rows) expect(row.type === 'policy' ? row.page : row.anchor).toBeTruthy()
    const firsts = rows.filter((r) => r.ordinal === 0).map((r) => r.document_id)
    expect(new Set(firsts).size).toBe(DOCS)
  })

  it('skips unchanged docs, re-ingests all with force, never duplicates', async () => {
    const [before] = await db`select count(*)::int as n from chunks`
    calls = 0
    expect((await ingest(db, fakeEmbed, opts)).skipped).toHaveLength(DOCS)
    expect(calls).toBe(0)
    expect((await ingest(db, fakeEmbed, { ...opts, force: true })).ingested).toHaveLength(DOCS)
    const [after] = await db`select count(*)::int as n from chunks`
    expect(after.n).toBe(before.n)
  })

  it('removes docs that left the corpus', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'corpus-'))
    try {
      cpSync('corpus', dir, { recursive: true })
      rmSync(path.join(dir, 'sources/wiki-auto-claims.md'))
      const r = await ingest(db, fakeEmbed, { ...opts, dir })
      expect(r.removed).toEqual(['wiki-auto-claims'])
      const [left] =
        await db`select count(*)::int as n from chunks where document_id = 'wiki-auto-claims'`
      expect(left.n).toBe(0)
    } finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('refuses an EMBED_DIM that does not match the column', async () => {
    await expect(ingest(db, fakeEmbed, { ...opts, embedDim: 1024 })).rejects.toThrow(
      /vector\(768\) but EMBED_DIM=1024/,
    )
  })
})
