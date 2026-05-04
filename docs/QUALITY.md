# Quality and security gates

This repo follows the MIRAI Tasker plan: **shift-left** checks before merging features.

## Before you open a PR

- Threat sketch for the change (assets, trust boundaries, abuse cases).  
- Tests: happy path + auth/tenant negative cases for new routes.  
- OpenAPI: update `apps/api/src/swagger.ts` when routes change.  
- No secrets in git — use `.env` locally (copy from `.env.example` only).

## Local commands

```bash
npm run lint
npm run test
cd apps/api && npm run test:integration   # requires Postgres + migrations
```

## CI (GitHub Actions)

On pull request: install workspaces, lint API + web, run API unit tests, `npm audit` (high severity policy may be adjusted).

## Integration tests

`apps/api` integration tests expect:

- `DATABASE_URL` pointing at a migrated database  
- `ALLOW_X_TENANT_ID=true` for tenant header scenarios (set in `src/test/bootstrap.integration.ts`)

Run migrations first:

```bash
cd apps/api
npx sequelize-cli db:migrate
npm run test:integration
```
