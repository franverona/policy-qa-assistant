.PHONY: dev db down

# shortcut: starts db + Next dev server only; Ollama checks, model pulls and seeding arrive in M1.
dev: db
	pnpm dev

db:
	docker compose up -d --wait db

down:
	docker compose down
