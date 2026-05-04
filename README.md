# MIRAI Tasker

Multi-tenant SaaS scaffold: **Express + Sequelize + PostgreSQL** API with **JWT auth**, **per-tenant subscriptions** (new signups default to the **Starter** plan; override with `DEFAULT_SIGNUP_PLAN_CODE`), **project limits**, and a **React + Vite + Tailwind v4** web app (marketing shell plus signed-in **projects, boards, tasks, SLA, reports, and agents**).

### Jira-inspired delivery features

Roadmap and implementation map: **[docs/jira-parity-roadmap.md](docs/jira-parity-roadmap.md)**. Highlights:

- **Workflow:** Board/project Kanban stages; API-validated status transitions; optional resolution and blocked SLA metadata.
- **Tasks:** `dueDate`, validated `metadata` (custom field definitions on the project), `dependencies` with cycle detection, automations on PATCH.
- **Views:** Kanban, **list**, and **week calendar** (by due date) per board; **reports** for SLA, throughput, and cycle time.
- **Notifications:** Project **webhooks** (HMAC-signed JSON, retries) for task updates, assignment, and SLA warning/soft breach.
- **Enterprise / ITSM:** Org policies and **legal hold** (`PATCH /tenant/settings`); **compliance bundle** export when legal hold is on; **public intake** (`/request/:tenantSlug/:projectId`); task **CSAT**, **change calendar** report, ITSM metadata; tenant **audit NDJSON**; **SSO status** probe (full SAML/OIDC login flows still deferred).

See **[docs/jira-parity-roadmap.md](docs/jira-parity-roadmap.md)** for deeper backlog and env notes.

## Prerequisites

- Node.js 20+
- Docker (for Postgres) optional if you run PostgreSQL locally

## Quick start

1. Copy environment template:

   ```bash
   copy .env.example .env
   ```

   On Unix: `cp .env.example .env` — set strong `JWT_*` secrets for anything beyond local dev.

2. Install and migrate (from repo root):

   ```bash
   docker compose up -d db
   npm install
   npm run migrate
   ```

   Postgres is mapped to host port **55432** by default (see `docker-compose.yml`).

3. Start API (terminal 1):

   ```bash
   cd apps/api && npm run dev
   ```

4. Start web UI (terminal 2):

   ```bash
   cd apps/web && npm run dev
   ```

5. Open `http://localhost:5173` — the Vite dev server proxies `/api` to the API on port **4000**. Register creates a **tenant**, **admin membership**, and subscription on the **Starter** plan (active in mock billing, trialing when using Stripe).

For a quick sanity check without starting servers: `npm run verify` (build, typecheck, API unit tests).

### Invitations and email

Tenant **invitations** create an accept token; until SMTP is implemented, `apps/api/src/services/mail.ts` **logs** the accept URL (safe for staging). To enable real email delivery, extend `sendTenantInvitationEmail` with your provider (e.g. nodemailer + `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) and set a public **web origin** for links in the message body. See **[docs/jira-parity-roadmap.md](docs/jira-parity-roadmap.md)** (Environment / Invitations).

Full stack with API in Docker:

```bash
docker compose up -d --build
```

(Run migrations inside the API container on first boot — the image `CMD` runs `sequelize-cli db:migrate` then `node dist/server.js`.)

## Scripts (monorepo root)

```bash
npm install
npm run migrate          # apply DB migrations (from repo root)
npm run build            # production build API + web
npm run verify           # build + typecheck + unit tests (includes slaPolicy + boardTemplatesCatalog)
npm run lint
npm run test
```

API integration tests need `DATABASE_URL` and applied migrations (covers SLA + template HTTP flows):

```bash
cd apps/api
npx sequelize-cli db:migrate
npm run test:integration
```

## API

- `GET /health` — liveness + DB check  
- `GET /docs` — Swagger UI  
- `GET /public/plans` — plan catalog (no internal DB ids)  
- `POST /auth/register` | `login` | `refresh` | `logout` · `GET /auth/me`  
- `GET /auth/sso/status` — whether SAML-related env vars are set (readiness; not a full SSO login)  
- `GET/POST /projects` — tenant-scoped; `POST` enforces plan project limits; `PATCH` can set webhooks, automations, and custom field defs (admin-only for those settings)  
- `GET /projects/:projectId/reports/cycle-time` — cycle time samples (`boardId`, `days` query params)  
- `GET /admin/audit/export` — NDJSON activity export (admin); span limited by `AUDIT_EXPORT_MAX_DAYS`  
- Boards, tasks, SLA, agents, employees — see Swagger at `/docs`  
- `GET /tenants/:tenantId/billing` — admin only; tenant param must match JWT / `X-Tenant-Id` context  

Dev-only: `ALLOW_X_TENANT_ID=true` lets members pass `X-Tenant-Id` to switch tenants **they belong to**. Cross-tenant access returns **403**.

## Security notes

- Do not enable `ALLOW_X_TENANT_ID` in production; prefer subdomain + session per tenant.  
- Configure Stripe + webhook signature verification before `BILLING_MODE=stripe`.  

See [docs/QUALITY.md](docs/QUALITY.md) for CI and review gates.
