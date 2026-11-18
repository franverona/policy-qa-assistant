# policy-qa-assistant

@AGENTS.md

## Brief
Fake customer: Harborline Mutual (fictional insurer) with ~2,000 policy PDFs and an internal wiki. Support agents take ~8 minutes to find the right clause. Build an assistant that answers from those sources and **always cites them** (document + page/section). A wrong answer is a compliance risk, so it must say "I don't know" when the sources don't contain the answer. Success is measured by an eval report: retrieval hit-rate, answer accuracy and IDK on unanswerable questions.

This is a public portfolio repo. **Fake data only. Never commit secrets.**

## Stack
- Next.js (App Router, TypeScript, pnpm). CLIs in `scripts/` run with `tsx`.
- Styling: Tailwind CSS v4 utility classes. No CSS modules, inline styles or component libraries.
- Postgres 17 + pgvector (docker compose), `postgres` driver, plain `.sql` migrations, no ORM.
- Models via Ollama on the host (default `LLM_PROVIDER=ollama`): chat `qwen3:8b`, embeddings `nomic-embed-text`, rerank `bge-reranker-base` (transformers.js). All model names are env vars. Anthropic is optional and only for chat. No LLM framework.
- CI and unit tests never call a model; they replay recorded responses from `fixtures/llm/`.

See PLAN.md for milestones and DECISIONS.md for why things are the way they are.

## Run
- `make dev`: starts Postgres and the Next dev server on http://localhost:3000
- `make down`: stops containers

## Checks (run all before opening a PR)
Available from `m0-engineering` onwards:
```
pnpm lint && pnpm typecheck && pnpm test
```

## How we work
- Fran says "Read PLAN.md and DECISIONS.md and continue with the next PR." The next PR is the first unchecked bullet in PLAN.md.
- **Never commit to main.** Each PR gets its own branch from an up-to-date main (`git switch main && git pull && git switch -c <branch>`), named as in PLAN.md (e.g. `m2-vector-search`).
- Keep PRs to ≤ ~400 changed lines, excluding fixtures, lockfiles and generated code. Large fixtures go in their own PR. If a change will be bigger, propose a split before starting.
- PR titles are conventional (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Squash merge only.
- Open PRs with `gh pr create`. The body covers what changed, how to test, trade-offs, and which files are generated.
- Run the checks before opening a PR. If CI fails: `gh run view <id> --log-failed`, then fix on the same branch.
- Wait for Fran to review and merge before starting the next PR. Fix review comments on the same branch.
- PRs that touch retrieval or prompts: run `pnpm eval` locally and record before/after scores in DECISIONS.md.
- Explain retrieval and LLM decisions briefly; Fran is learning them. **Fran writes the eval scoring logic (`src/evals/score.ts`)**; Claude reviews it.
- The last PR of a milestone ticks it off in PLAN.md and updates this file and DECISIONS.md. After it's merged, tell Fran it's a good point to start a new session.
- gh: always scope `gh issue list` / `gh pr list` with `--json` and only the needed fields.

## Current milestone
**M0 Setup**: next PR is `m0-engineering`.
