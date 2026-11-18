# Decisions

Short records of retrieval, LLM and engineering decisions. Changes that touch retrieval or prompts record eval scores before and after.

Format: **date — decision.** Why. Alternatives considered. Scores (when relevant).

## Eval scores log

| Date | PR | Models (chat / embed / rerank) | hit@5 | MRR | Answer accuracy | IDK precision | IDK recall | Notes |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | baseline arrives in M4 |

## Records

**2026-11-18 — TypeScript / Next.js for everything.** One language end to end, so the UI, API, ingestion and eval runner share types. Python has better PDF/ML tooling, but `unpdf` (pdf.js) gives per-page text, which is all citations need. Alternative: FastAPI + Next.js (two languages, two CIs).

**2026-11-18 — Postgres + pgvector for both search modes.** Full-text (`tsvector`, GIN) and vector (HNSW cosine) live in one table, so hybrid search is one database and one transaction. Alternatives: a dedicated vector DB plus Elasticsearch (more moving parts, nothing gained at this scale).

**2026-11-18 — Local models through Ollama by default.** No API costs, and the data never leaves the machine (a selling point for an insurer). Chat `qwen3:8b`, embeddings `nomic-embed-text` (768-d), rerank `bge-reranker-base` via transformers.js, sized for an M1 Pro with 16 GB. All model names are env vars. `LLM_PROVIDER=anthropic` is optional and only for chat; Anthropic has no embeddings API, so embeddings always use Ollama.

**2026-11-18 — Clause-aware chunking with heading paths.** Chunks follow numbered clauses (~350 tokens, split only when a clause is long, ~15% overlap), and each one is prefixed with `Document › Section › Clause`. Clauses are the unit agents cite. The prefix lets BM25 and embeddings tell apart near-identical clauses from different products and years. Alternative: fixed-size windows (simpler, but they cut clauses in half and lose which policy a chunk belongs to).

**2026-11-18 — Hybrid search with RRF, then a cross-encoder.** Full-text catches exact policy codes and clause numbers. Vectors catch paraphrases. Reciprocal Rank Fusion (k=60) merges ranks without normalising scores. A cross-encoder reranks the top 20 to 5, because it reads the query and the chunk together.

**2026-11-18 — Three "I don't know" gates.** (1) A rerank score below a threshold returns IDK before the LLM is called. (2) The LLM can return `answerable: false`. (3) Every citation must point to a retrieved chunk, and an answer with no valid citations becomes IDK. A wrong answer is a compliance risk, so the system prefers to abstain.

**2026-11-18 — Evals run locally, CI uses fixtures.** CI never calls a model. It runs the eval runner and scoring against recorded responses as a smoke test. Real evals run locally with `pnpm eval`, and each report records the models that produced it.

**2026-11-18 — No streaming at first.** Structured JSON answers are easier to validate whole. shortcut: revisit if latency hurts the demo.
