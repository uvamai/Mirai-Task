# Contributing to MIRAI Tasker

## Before you code

1. Read [docs/QUALITY.md](docs/QUALITY.md) for security and test gates.
2. Sketch threats for your change (IDOR, webhook replay, upload abuse).
3. Add or update tests and OpenAPI entries in `apps/api/src/swagger.ts`.

## Commands

```bash
npm install
npm run typecheck        # all workspaces
npm run lint
npm run test -w @mirai/api
npm run migrate -w @mirai/api
npm run test:integration -w @mirai/api   # needs Postgres + migrations
```

## Secrets

Never commit `.env`. Copy from `.env.example` and generate unique JWT secrets (32+ characters) for non-local environments.
