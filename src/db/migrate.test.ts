import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { migrate } from './migrate'

const url = process.env.DATABASE_URL
const sql = url ? postgres(url, { onnotice: () => {} }) : undefined
const ROLLBACK = new Error('rollback')

// Needs a real Postgres + pgvector: CI provides one; locally run with DATABASE_URL set.
describe.skipIf(!sql)('migrate', () => {
  const db = sql!
  afterAll(() => db.end())

  it('applies everything, then nothing on a second run', async () => {
    await migrate(db)
    expect(await migrate(db)).toEqual([])
    const idx = await db`select indexname from pg_indexes where tablename = 'chunks'`
    expect(idx.map((r) => r.indexname)).toEqual(
      expect.arrayContaining(['chunks_embedding_idx', 'chunks_tsv_idx']),
    )
  })

  it('fills tsv and rejects uncitable chunks', async () => {
    const vec = `[${Array(768).fill(0.1).join(',')}]`
    await expect(
      db.begin(async (tx) => {
        await tx`insert into documents (id, title, type, path, content_hash)
                 values ('t', 'Test', 'policy', 't.pdf', 'h')`
        const [row] =
          await tx`insert into chunks (document_id, ordinal, heading_path, page, content, embedding)
          values ('t', 0, 'Test › Deductibles', 3, 'The deductible is 500 dollars', ${vec})
          returning tsv::text`
        // English stemming: 'Deductibles' → 'deduct'; the heading path is indexed too ('test')
        expect(row.tsv).toContain("'deduct'")
        expect(row.tsv).toContain("'test'")
        await expect(
          tx`insert into chunks (document_id, ordinal, heading_path, content, embedding)
             values ('t', 1, 'x', 'y', ${vec})`,
        ).rejects.toThrow(/check constraint/)
        throw ROLLBACK
      }),
    ).rejects.toBe(ROLLBACK)
  })
})
