# Plan

Cited-answer assistant for insurance support agents. Architecture, model choices and retrieval design are in [DECISIONS.md](DECISIONS.md); this file tracks progress.

Rules: one PR per bullet, branch named after it (from an up-to-date `main`), ≤ ~400 changed lines excluding fixtures, lockfiles and generated code. The last PR of a milestone ticks the milestone and updates CLAUDE.md and DECISIONS.md.

## M0 Setup ✅

- [x] `m0-scaffold`: Next.js app, Tailwind, docker compose (db), PLAN.md, CLAUDE.md, DECISIONS.md, README stub
- [x] `m0-engineering`: CI (lint, typecheck, tests), `.env.example` + zod config, husky + lint-staged + Prettier + gitleaks, PR template, repo settings (squash only, secret scanning, push protection, topics), CI badge

## M1 Ingestion

- [x] `m1-corpus-renderer`: corpus source format, PDF/HTML render script, 2 sample docs
- [x] `m1-corpus-fixtures`: remaining ~28 docs + generated PDFs (fixtures only)
- [ ] `m1-schema`: migrations (documents, chunks, HNSW + GIN), db client, migrate script, pgvector service container in CI
- [ ] `m1-llm-module`: `chat()`/`embed()` behind `LLM_PROVIDER` (ollama, fixture), recording script
- [ ] `m1-parse-chunk`: PDF (per page) and HTML (per section) parsers, clause-aware chunker, tests
- [ ] `m1-ingest`: idempotent `pnpm ingest`, app service in compose, `make dev` pulls models and seeds

## M2 Search

- [ ] `m2-fulltext-search`: tsvector + `websearch_to_tsquery`
- [ ] `m2-vector-search`: pgvector HNSW cosine
- [ ] `m2-hybrid-rrf`: Reciprocal Rank Fusion
- [ ] `m2-rerank`: cross-encoder rerank + `/search` debug page

## M3 Chat with citations

- [ ] `m3-answer-pipeline`: prompt, structured output, citation validation, three IDK gates, `/api/ask`
- [ ] `m3-doc-viewer`: `/docs/[id]` serves PDFs (`#page=N`) and wiki pages (`#anchor`)
- [ ] `m3-chat-ui`: chat page, inline citation chips, source side panel

## M4 Evals

- [ ] `m4-eval-questions`: 55 questions (45 answerable, 10 unanswerable) — fixtures only
- [ ] `m4-eval-runner`: runner, JSON + Markdown reports with models/config, `score.ts` stub
- [ ] `m4-scoring`: scoring logic — **written by Fran**, reviewed by Claude
- [ ] `m4-baseline`: first report committed, baseline recorded in DECISIONS.md

## M5 Cost and latency tracking

- [ ] `m5-query-logging`: `query_logs` table, per-stage latency, tokens, cost price table
- [ ] `m5-anthropic-provider`: opt-in Claude chat provider (Ollama stays the default)
- [ ] `m5-logs-page`: `/logs` with p50/p95 latency, tokens, cost; averages in eval reports

## M6 Tuning

One PR per experiment, chosen from baseline failures, each with before/after scores in DECISIONS.md. Candidates: chunk size / heading prefix, candidate counts and RRF k, IDK threshold, prompt wording, chat model A/B (`llama3.1:8b`), `bge-m3` embeddings.

## M7 Case study

- [ ] `m7-readme`: problem, results, Mermaid diagram, how to run, key decisions, next steps, "How I built this", demo GIF
