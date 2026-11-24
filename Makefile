.PHONY: dev db models seed down

# Postgres + migrations, Ollama models, corpus ingest, then the Next dev server.
dev: .env seed
	pnpm dev

# First run: create a local env file from the committed template.
.env:
	cp .env.example .env

db: .env
	docker compose up -d --wait db
	pnpm db:migrate

# Ollama runs on the host. `ollama pull` only downloads layers that changed.
models: .env
	@set -a; . ./.env; set +a; \
	curl -sf "$$OLLAMA_BASE_URL/api/version" > /dev/null \
	  || { echo "Ollama not reachable at $$OLLAMA_BASE_URL: start it with 'ollama serve'"; exit 1; }; \
	ollama pull "$$CHAT_MODEL" && ollama pull "$$EMBED_MODEL"
	pnpm rerank:pull

# Idempotent: unchanged docs are skipped.
seed: db models
	pnpm ingest

down:
	docker compose down
