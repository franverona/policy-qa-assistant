import type { Sql } from 'postgres'

// One retrieved chunk, with what a citation needs (document + page or anchor).
export type SearchHit = {
  chunkId: number
  documentId: string
  title: string
  headingPath: string
  page: number | null
  anchor: string | null
  content: string
  score: number
}

// BM25-style keyword search over chunks.tsv. websearch_to_tsquery ANDs every word, so a full
// question would only match chunks containing all of them; we turn ' & ' into ' | ' (OR) but
// keep '& !' (from -negation) and phrases ('<->'). ts_rank_cd ranks chunks that match more
// words, closer together, first.
export async function fullTextSearch(sql: Sql, query: string, limit: number) {
  return sql<SearchHit[]>`
    with q as (
      select regexp_replace(websearch_to_tsquery('english', ${query})::text, ' & (?!!)', ' | ', 'g')
             ::tsquery as q
    )
    select c.id::int as "chunkId", c.document_id as "documentId", d.title,
           c.heading_path as "headingPath", c.page, c.anchor, c.content,
           ts_rank_cd(c.tsv, q.q) as score
    from q, chunks c join documents d on d.id = c.document_id
    where c.tsv @@ q.q
    order by score desc, c.id
    limit ${limit}`
}
