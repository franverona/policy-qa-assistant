# Decisions

Short records of retrieval, LLM and engineering decisions. Changes that touch retrieval or prompts record eval scores before and after.

Format: **date — decision.** Why. Alternatives considered. Scores (when relevant).

## Eval scores log

| Date | PR  | Models (chat / embed / rerank) | hit@5 | MRR | Answer accuracy | IDK precision | IDK recall | Notes                  |
| ---- | --- | ------------------------------ | ----- | --- | --------------- | ------------- | ---------- | ---------------------- |
| —    | —   | —                              | —     | —   | —               | —             | —          | baseline arrives in M4 |

## Records

**2026-11-18 — TypeScript / Next.js for everything.** One language end to end, so the UI, API, ingestion and eval runner share types. Python has better PDF/ML tooling, but `unpdf` (pdf.js) gives per-page text, which is all citations need. Alternative: FastAPI + Next.js (two languages, two CIs).

**2026-11-18 — Tailwind CSS v4 for styling.** Quick to build the chat UI with, styles stay next to the markup, and there's no design system to maintain for a demo. Alternatives: CSS modules (more files, slower to iterate) or a component library (more weight than a few screens need).

**2026-11-18 — Postgres + pgvector for both search modes.** Full-text (`tsvector`, GIN) and vector (HNSW cosine) live in one table, so hybrid search is one database and one transaction. Alternatives: a dedicated vector DB plus Elasticsearch (more moving parts, nothing gained at this scale).

**2026-11-18 — Local models through Ollama by default.** No API costs, and the data never leaves the machine (a selling point for an insurer). Chat `qwen3:8b`, embeddings `nomic-embed-text` (768-d), rerank `bge-reranker-base` via transformers.js, sized for an M1 Pro with 16 GB. All model names are env vars. `LLM_PROVIDER=anthropic` is optional and only for chat; Anthropic has no embeddings API, so embeddings always use Ollama.

**2026-11-18 — Clause-aware chunking with heading paths.** Chunks follow numbered clauses (~350 tokens, split only when a clause is long, ~15% overlap), and each one is prefixed with `Document › Section › Clause`. Clauses are the unit agents cite. The prefix lets BM25 and embeddings tell apart near-identical clauses from different products and years. Alternative: fixed-size windows (simpler, but they cut clauses in half and lose which policy a chunk belongs to).

**2026-11-18 — Hybrid search with RRF, then a cross-encoder.** Full-text catches exact policy codes and clause numbers. Vectors catch paraphrases. Reciprocal Rank Fusion (k=60) merges ranks without normalising scores. A cross-encoder reranks the top 20 to 5, because it reads the query and the chunk together.

**2026-11-18 — Three "I don't know" gates.** (1) A rerank score below a threshold returns IDK before the LLM is called. (2) The LLM can return `answerable: false`. (3) Every citation must point to a retrieved chunk, and an answer with no valid citations becomes IDK. A wrong answer is a compliance risk, so the system prefers to abstain.

**2026-11-18 — Evals run locally, CI uses fixtures.** CI never calls a model. It runs the eval runner and scoring against recorded responses as a smoke test. Real evals run locally with `pnpm eval`, and each report records the models that produced it.

**2026-11-18 — No streaming at first.** Structured JSON answers are easier to validate whole. shortcut: revisit if latency hurts the demo.

**2026-11-18 — Config: no defaults in code, checked at server start.** Every value, model names included, comes from `.env`, with `.env.example` as the single place that holds defaults. `src/config.ts` (zod) runs from `instrumentation.ts`, so a missing variable stops the server with a list of what's missing, instead of failing on the first request. It's lazy, so `next build` works in CI without an env file. Alternative: defaults in code (fewer variables to set, but two sources of truth and silent fallbacks).

**2026-11-18 — Pre-commit only formats and scans for secrets.** lint-staged runs Prettier on staged files, then `gitleaks git --pre-commit --staged`. Lint, type-check and tests run in CI, which keeps commits fast. GitHub secret scanning and push protection are a second line of defence, because the repo is public.

**2026-11-18 — Code style copied from blitzr.** Same Prettier config (no semicolons, single quotes, 100 columns, `prettier-plugin-tailwindcss` sorts classes) and the same ESLint presets (Next core-web-vitals + TypeScript, `eslint-config-prettier` last), so Fran's repos read the same. CI runs `pnpm format:check`, which also catches commits that skipped the hook. The PR-title check (commitlint in CI) is copied too, limited to `feat|fix|chore|docs|test`. Squash merges use the PR title as the commit message, so this keeps main's history conventional without a commit-message hook. Left out: `eslint --fix` in lint-staged (the hook here only formats) and blitzr's lockfile-pinned commitlint install (it exists for Dependabot's cooldown; this repo has no Dependabot, and `--frozen-lockfile` already pins).

**2026-11-18 — Failing CI blocks merges.** A repository ruleset on main requires the `check` and `commitlint` jobs (from GitHub Actions) to pass. It doesn't require the branch to be up to date with main: PRs are small and sequential, so the extra rebase step isn't worth it. A ruleset, not classic branch protection, because rulesets are the current API and are visible under Settings → Rules.

**2026-11-18 — CI without Postgres for now.** Nothing touches the database yet. The pgvector service container arrives with the first database code in `m1-schema`.

**2026-11-18 — Corpus is written as Markdown and rendered to PDF/HTML.** Each doc in `corpus/sources/` is a small Markdown subset (`#` title, `##` section, `###` clause, `-` bullets, paragraphs) with `key: value` frontmatter (`id`, `title`, `type: policy | wiki`, optional `code`, `effective`). `pnpm corpus:render` turns policies into PDFs with pdfkit and wiki pages into HTML with an `id` on every heading, so citations can point to `#page=N` or `#anchor`. The rendered files are committed, so ingestion and CI never need the renderer. Built-in fonts and fixed PDF dates keep the output byte-identical, which makes re-renders show up as real diffs. Pages break wherever the text runs out, so some clauses cross pages, just like real PDFs. Alternatives: hand-made PDFs (can't be reviewed or diffed), or HTML-to-PDF with a headless browser (a much heavier dependency for the same result).
