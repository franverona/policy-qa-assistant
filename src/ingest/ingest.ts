import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Sql } from 'postgres'
import { parseSource } from '../corpus/source'
import type { EmbedKind } from '../llm'
import { chunk } from './chunk'
import { parseHtml, parsePdf } from './parse'

type Embed = (texts: string[], kind: EmbedKind) => Promise<number[][]>
type Options = { embedModel: string; embedDim: number; dir?: string; force?: boolean }

// Loads corpus/sources/*.md (metadata) + corpus/rendered/<id>.pdf|html (text) into the db.
// Idempotent: a doc whose hash is unchanged is skipped; one transaction per changed doc.
export async function ingest(sql: Sql, embed: Embed, opts: Options) {
  const { embedModel, embedDim, dir = 'corpus', force = false } = opts

  const [col] = await sql`select format_type(atttypid, atttypmod) as type from pg_attribute
                          where attrelid = 'chunks'::regclass and attname = 'embedding'`
  if (col?.type !== `vector(${embedDim})`)
    throw new Error(
      `chunks.embedding is ${col?.type} but EMBED_DIM=${embedDim}: add a migration and re-ingest`,
    )

  const stored = new Map(
    (await sql`select id, content_hash from documents`).map((r) => [r.id, r.content_hash]),
  )
  const result = { ingested: [] as string[], skipped: [] as string[], removed: [] as string[] }
  const files = (await readdir(path.join(dir, 'sources'))).filter((f) => f.endsWith('.md')).sort()
  const ids: string[] = []

  for (const file of files) {
    const source = await readFile(path.join(dir, 'sources', file))
    const { meta } = parseSource(source.toString('utf8'), file)
    const rel = path.join(dir, 'rendered', `${meta.id}.${meta.type === 'policy' ? 'pdf' : 'html'}`)
    const rendered = await readFile(rel)
    ids.push(meta.id)

    // The model is part of the hash, so switching EMBED_MODEL re-embeds everything.
    const hash = createHash('sha256').update(source).update(rendered).update(embedModel)
    const contentHash = hash.digest('hex')
    if (!force && stored.get(meta.id) === contentHash) {
      result.skipped.push(meta.id)
      continue
    }

    const sections =
      meta.type === 'policy'
        ? await parsePdf(new Uint8Array(rendered))
        : parseHtml(rendered.toString('utf8'))
    const chunks = chunk(sections)
    // Embed before opening the transaction, so an Ollama failure leaves the old version intact.
    const vectors = chunks.length
      ? await embed(
          chunks.map((c) => `${c.headingPath}\n\n${c.content}`),
          'document',
        )
      : []

    await sql.begin(async (tx) => {
      await tx`delete from documents where id = ${meta.id}` // chunks cascade
      await tx`insert into documents ${tx({
        id: meta.id,
        title: meta.title,
        type: meta.type,
        code: meta.code ?? null,
        effective: meta.effective ?? null,
        path: rel,
        content_hash: contentHash,
      })}`
      if (!chunks.length) return
      const rows = chunks.map((c, i) => ({
        document_id: meta.id,
        ordinal: c.ordinal,
        heading_path: c.headingPath,
        page: c.page ?? null,
        anchor: c.anchor ?? null,
        content: c.content,
        embedding: JSON.stringify(vectors[i]), // '[0.1,0.2,...]' is pgvector's text format
      }))
      await tx`insert into chunks ${tx(rows)}`
    })
    result.ingested.push(meta.id)
  }

  const gone = await sql`delete from documents where not (id = any(${ids})) returning id`
  result.removed = gone.map((r) => r.id)
  return result
}
