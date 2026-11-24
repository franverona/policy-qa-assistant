import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { citeHref } from '../answer/prompt'
import { testSchema } from '../db/test-schema'
import { serveDoc } from './serve'

describe('citeHref', () => {
  it('links PDFs to a page and wiki pages to an anchor', () => {
    expect(citeHref({ documentId: 'end-water-backup', page: 2, anchor: null })).toBe(
      '/docs/end-water-backup#page=2',
    )
    expect(citeHref({ documentId: 'wiki-auto-claims', page: null, anchor: 'glass-claims' })).toBe(
      '/docs/wiki-auto-claims#glass-claims',
    )
  })
})

const schema = testSchema('docs_test')
const pdf = 'corpus/rendered/end-water-backup.pdf'
const html = 'corpus/rendered/wiki-auto-claims.html'

// Needs a real Postgres: CI provides one; locally run with DATABASE_URL set.
describe.skipIf(schema.skip)('serveDoc', () => {
  const { sql, setup, teardown } = schema
  beforeAll(async () => {
    await setup()
    await sql`insert into documents (id, title, type, path, content_hash) values
      ('end-water-backup', 'Water Backup', 'policy', ${pdf}, 'h'),
      ('wiki-auto-claims', 'Auto Claims', 'wiki', ${html}, 'h')`
  })
  afterAll(teardown)

  it('serves a policy PDF', async () => {
    const res = await serveDoc(sql, 'end-water-backup')
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(Buffer.from(await res.arrayBuffer()).equals(readFileSync(pdf))).toBe(true)
  })

  it('serves a wiki page sandboxed, so its scripts never run', async () => {
    const res = await serveDoc(sql, 'wiki-auto-claims')
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('content-security-policy')).toBe('sandbox')
    expect(await res.text()).toContain('id="glass-claims"')
  })

  it('404s an unknown id instead of touching the filesystem', async () => {
    for (const id of ['nope', '../../.env']) expect((await serveDoc(sql, id)).status).toBe(404)
  })
})
