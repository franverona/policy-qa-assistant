import type { Sql } from 'postgres'
import type { SearchHit } from './fulltext'

// Nearest chunks by cosine distance (<=>) to a query embedding; the caller embeds the question
// with embed([q], 'query'). pgvector only uses the HNSW index for `order by <=> limit`, and an
// index scan returns at most hnsw.ef_search rows (default 40), so we raise it to the limit.
// score = cosine similarity (1 - distance), higher is better, like the full-text score.
export async function vectorSearch(sql: Sql, embedding: number[], limit: number) {
  const vec = JSON.stringify(embedding) // '[0.1,0.2,...]' is pgvector's text format
  return sql.begin(async (tx) => {
    await tx`select set_config('hnsw.ef_search', ${String(Math.max(40, limit))}, true)`
    return tx<SearchHit[]>`
      select c.id::int as "chunkId", c.document_id as "documentId", d.title,
             c.heading_path as "headingPath", c.page, c.anchor, c.content,
             1 - (c.embedding <=> ${vec}::vector) as score
      from chunks c join documents d on d.id = c.document_id
      order by c.embedding <=> ${vec}::vector
      limit ${limit}`
  })
}
