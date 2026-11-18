# policy-qa-assistant

[![CI](https://github.com/franverona/policy-qa-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/franverona/policy-qa-assistant/actions/workflows/ci.yml)

> Working name. A cited-answer assistant for insurance support agents: ask a question, get an answer with links to the exact policy page, or an honest "I don't know".

**Status:** in progress. See [PLAN.md](PLAN.md) for milestones and [DECISIONS.md](DECISIONS.md) for the reasoning.

All documents in this repo are fictional (Harborline Mutual is a made-up insurer).

## Run (so far)

Requires Docker, Node 22, pnpm and [gitleaks](https://github.com/gitleaks/gitleaks) (used by the pre-commit hook).

```
pnpm install
make dev            # creates .env from .env.example on first run
```

## License

[MIT](LICENSE)
