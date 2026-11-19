.PHONY: dev db down

# shortcut: starts db + Next dev server only; Ollama checks, model pulls and seeding arrive in M1.
dev: .env db
	pnpm dev

# First run: create a local env file from the committed template.
.env:
	cp .env.example .env

db: .env
	docker compose up -d --wait db
	pnpm db:migrate

down:
	docker compose down
