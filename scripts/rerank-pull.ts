// Downloads the rerank model into .cache/transformers/ (make dev runs this), so the first
// /search doesn't wait for it. Usage: pnpm rerank:pull
import { getConfig } from '../src/config'
import { createReranker } from '../src/search/rerank'
import type { HybridHit } from '../src/search/hybrid'

const cfg = { ...getConfig(), LLM_PROVIDER: 'ollama' as const } // always load the real model
const hit = { chunkId: 0, headingPath: 'warm up', content: 'warm up' } as HybridHit
const t = Date.now()
createReranker(cfg)('warm up', [hit])
  .then(() => console.log(`${cfg.RERANK_MODEL} ready in ${Date.now() - t} ms`))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
