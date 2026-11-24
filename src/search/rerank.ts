import path from 'node:path'
import { getConfig, type Config } from '../config'
import { FIXTURE_DIR } from '../llm'
import { fixtureKey, readFixture, writeFixture } from '../llm/fixtures'
import type { HybridHit } from './hybrid'

export type RerankedHit = HybridHit & { rerankScore: number }

type RerankConfig = Pick<Config, 'LLM_PROVIDER' | 'RERANK_MODEL'>

// Loaded once per process. Imported lazily so tests and CI (fixture provider) never load
// onnxruntime. q8: the quantized ONNX is ~4x smaller and faster on CPU than fp32.
let loaded: Promise<(query: string, docs: string[]) => Promise<number[]>> | undefined
async function loadModel(name: string) {
  const { AutoModelForSequenceClassification, AutoTokenizer, env } =
    await import('@huggingface/transformers')
  env.cacheDir = path.join(process.cwd(), '.cache/transformers') // survives pnpm install
  const [tokenizer, model] = await Promise.all([
    AutoTokenizer.from_pretrained(name),
    AutoModelForSequenceClassification.from_pretrained(name, { dtype: 'q8' }),
  ])
  return async (query: string, docs: string[]) => {
    // A cross-encoder reads each (query, chunk) pair together; one batched forward pass.
    const inputs = tokenizer(Array(docs.length).fill(query), {
      text_pair: docs,
      padding: true,
      truncation: true,
    })
    const { logits } = await model(inputs)
    // One relevance logit per pair; sigmoid maps it to 0–1, easier to threshold in M3.
    return Array.from(logits.data as Float32Array, (x) => 1 / (1 + Math.exp(-x)))
  }
}

export function createReranker(cfg: RerankConfig, fixtureDir = FIXTURE_DIR) {
  // fixture: replay, never load the model · record: score and save · otherwise: score.
  async function scores(query: string, docs: string[]): Promise<number[]> {
    const key = fixtureKey('rerank', { query, docs })
    if (cfg.LLM_PROVIDER === 'fixture') return (await readFixture(fixtureDir, key)) as number[]
    const result = await (await (loaded ??= loadModel(cfg.RERANK_MODEL)))(query, docs)
    if (cfg.LLM_PROVIDER === 'record')
      await writeFixture(fixtureDir, key, {
        model: cfg.RERANK_MODEL,
        request: { query, docs },
        response: result,
      })
    return result
  }

  // Scores every hit (heading path + content, as embedded) and sorts by that score.
  return async function rerank(query: string, hits: HybridHit[]): Promise<RerankedHit[]> {
    if (!hits.length) return []
    const s = await scores(
      query,
      hits.map((h) => `${h.headingPath}\n\n${h.content}`),
    )
    return hits
      .map((h, i) => ({ ...h, rerankScore: s[i] }))
      .sort((a, b) => b.rerankScore - a.rerankScore || a.chunkId - b.chunkId)
  }
}

let cached: ReturnType<typeof createReranker> | undefined
export function rerank(query: string, hits: HybridHit[]) {
  return (cached ??= createReranker(getConfig()))(query, hits)
}
