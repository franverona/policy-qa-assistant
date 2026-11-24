import { getDb } from '../db/client'
import { embed } from '../llm'
import { hybridSearch } from './hybrid'
import { rerank, type RerankedHit } from './rerank'

// Retrieval knobs (M6 experiments).
export const CANDIDATES = 50 // per list, before fusion
export const FUSED = 20 // fused hits the cross-encoder scores
export const TOP = 5 // what the answer step sees

export type Retrieval = { hits: RerankedHit[]; searchMs: number; rerankMs: number }

// Hybrid search + rerank. Returns all FUSED hits, reranked; callers take the first TOP.
export async function retrieve(query: string): Promise<Retrieval> {
  const t0 = performance.now()
  const fused = await hybridSearch(getDb(), embed, query, { candidates: CANDIDATES, limit: FUSED })
  const t1 = performance.now()
  const hits = await rerank(query, fused)
  const ms = (a: number, b: number) => Math.round(b - a)
  return { hits, searchMs: ms(t0, t1), rerankMs: ms(t1, performance.now()) }
}
