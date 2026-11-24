import type { Sql } from 'postgres'
import type { Embed } from '../llm'
import { fullTextSearch, type SearchHit } from './fulltext'
import { vectorSearch } from './vector'

// score is the fused RRF score; ranks[i] is the chunk's 1-based rank in input list i (null if
// that list didn't return it), so the /search page can show why a chunk landed where it did.
export type HybridHit = SearchHit & { ranks: (number | null)[] }

// k=60 from the original RRF paper: it flattens the curve, so agreement between lists beats a
// single first place (two 10th places = 2/70 > one 1st place = 1/61). An M6 knob.
export const RRF_K = 60

// Reciprocal Rank Fusion: each list adds 1/(k + rank) per chunk. Only ranks are used, so
// ts_rank_cd (unbounded) and cosine (0–1) never have to be put on the same scale.
export function rrf(lists: SearchHit[][], k = RRF_K): HybridHit[] {
  const fused = new Map<number, HybridHit>()
  lists.forEach((list, i) =>
    list.forEach((hit, r) => {
      const h = fused.get(hit.chunkId) ?? { ...hit, score: 0, ranks: lists.map(() => null) }
      h.score += 1 / (k + r + 1)
      h.ranks[i] = r + 1
      fused.set(hit.chunkId, h)
    }),
  )
  return [...fused.values()].sort((a, b) => b.score - a.score || a.chunkId - b.chunkId)
}

// Embeds the query once, runs both searches with `candidates` each, and fuses them.
export async function hybridSearch(
  sql: Sql,
  embed: Embed,
  query: string,
  { candidates, limit }: { candidates: number; limit: number },
) {
  const [vec] = await embed([query], 'query')
  const lists = await Promise.all([
    fullTextSearch(sql, query, candidates),
    vectorSearch(sql, vec, candidates),
  ])
  return rrf(lists).slice(0, limit)
}
