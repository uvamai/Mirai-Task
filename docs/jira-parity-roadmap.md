# Jira-inspired roadmap — implementation reference

This document mirrors the [Jira Software feature pillars](https://www.atlassian.com/software/jira/features) roadmap and records **what is implemented** in this repository. The original narrative plan (gaps, non-goals, mermaid) may live in your Cursor plans directory as `jira-parity_roadmap_*.plan.md`; the **implementation status** section was appended there as well when this doc was added.

## Implementation summary

| Area | Status | Primary locations |
|------|--------|-------------------|
| Workflow (stages, transitions, resolution, blocked) | Shipped | `apps/api/src/services/workflowService.ts`, `apps/api/src/routes/tasks.ts`, `apps/api/src/routes/agents.ts`, `apps/api/src/services/slaService.ts` |
| Custom fields (`metadata` + defs) | Shipped | `apps/api/src/services/customFields.ts`, `apps/api/src/models/Task.ts`, `apps/api/src/routes/projects.ts`, web `TaskCreateModal`, `TaskDetailPanel` |
| SLA defaults + project override + start policy | Shipped | `apps/api/src/services/slaPolicy.ts` (defaults P0=1 … P4=7; `slaDaysByPriority`, `slaStartPolicy`), `PATCH /projects/:projectId/sla-policy`, `project.settings.slaUseBusinessDays` / `slaHolidayCalendar`; web `ProjectItsmSettingsPage` |
| Board templates (14+ categories) + previews | Shipped | `apps/api/src/config/boardTemplates.json`, `boardTemplatesCatalog.ts`, `GET /public/board-templates`, `GET /public/board-templates/:key`; `POST /projects` + `templateKey` / `seedSampleTasks`; web `CreateBoardModal` |
| Email invites + accept + org invite policy | Shipped | `tenant_invitations` model + `invitations` routes, `invitationService`, `orgPolicies` (`whoCanInvite`, `inviteMaxRole`); `mail.ts` logs accept URL until SMTP is wired; web `EmployeesPage` / accept flow, `TenantOrgSettingsPage` |
| Reporting (cycle time + SLA + throughput + utilization) | Shipped | `reportingService.ts`, `GET …/reports/utilization`, `GET …/reports/portfolio/utilization`, `GET …/reports/capacity`; `ProjectReportsPage.tsx` |
| Notifications (webhooks, signed, retry) | Shipped | `outboundWebhook.ts` (delivery log on `project.settings.webhookDeliveryLog`), `tasks.ts`, `slaTick.ts`, `GET …/webhook-deliveries` |
| List + calendar views | Shipped | `apps/web/src/pages/TaskListPage.tsx`, `TaskCalendarPage.tsx`, `App.tsx`, `ProjectLayout.tsx` |
| Dependencies (DAG / no cycles) | Shipped | `apps/api/src/services/dependencyGraph.ts`, `tasks.ts` PATCH; board/list/detail UI |
| Parent tasks + subtasks | Shipped | `tasks.parent_task_id`, `taskParentage.ts`, task detail API + `TaskDetailPanel` |
| Comment @mentions | Shipped | `task_comments.mentions`, `commentMentions.ts`, `TaskDetailPanel` comments |
| Automation rules (subset on PATCH) | Shipped | `apps/api/src/services/automationEngine.ts`, `project.settings.automations`, web `ProjectAutomationsPage` |
| Audit export (NDJSON) | Shipped | `apps/api/src/routes/admin.ts` — `GET /admin/audit/export` |
| Activity log retention | Shipped | `apps/api/src/services/activityRetention.ts`, `apps/api/src/server.ts`, env `ACTIVITY_LOG_RETENTION_DAYS` |
| SAML / SSO | Scaffold only | `apps/api/src/routes/authSso.ts` — `GET /auth/sso/status` (env probe; no SP-initiated login) |

## Database

- Migration `apps/api/migrations/20260504100000-task-workflow-fields.js`: `tasks.resolution`, `tasks.due_date`, `tasks.metadata` (JSONB); indexes `idx_activity_logs_tenant_created`, `idx_activity_logs_task_created`.

## API additions (high level)

- `GET /projects/:projectId/reports/cycle-time` — query `boardId`, `days` (1–366); cycle time samples from `activity_logs` for Done tasks.
- `GET /projects/:projectId/reports/utilization` — per-assignee workload; `GET /reports/portfolio/utilization` — tenant rollup (Admin/Manager).
- `PATCH /projects/:projectId/sla-policy` — `slaStartPolicy`, `slaDaysByPriority` (Admin/Manager/Project Lead).
- `GET /public/board-templates` / `GET /public/board-templates/:templateKey` — template gallery for onboarding and board create.
- `POST /projects` — optional `templateKey`, `seedSampleTasks` to align first board with catalog and optional sample cards.
- `GET /admin/audit/export` — NDJSON activity stream; `from` / `to`; span capped by `AUDIT_EXPORT_MAX_DAYS` (default 366).
- `GET /auth/sso/status` — whether SAML-related env vars are set (readiness only).
- `PATCH /auth/me/preferences` — merge JSON into `tenant_memberships.preferences` (saved views / notes).
- Invitations: `POST /invitations` (policy-aware), `POST /public/invitations/accept` — see Swagger `/docs`.
- Project `PATCH` (Admin): optional `settings.webhooks`, `settings.automations`, `settings.customFieldDefs`, `slaUseBusinessDays`, `slaHolidayCalendar`, `olaHandoffs` (Managers cannot set webhooks/automations/custom fields/OLA handoffs).
- Task create/patch: `dueDate`, `metadata`, `resolution`, `dependencies`, `parentTaskId`, `blockedReason` (with workflow and metadata validation).

## Web UI

- Project nav: **Board**, **List**, **Calendar**, **Team** (if permitted), **ITSM intake** (admin), **Automations** (admin), **Reports**.
- Reports: SLA overview, throughput (14d), cycle time (30d default in UI), utilization where exposed.
- Task create/edit: due date, custom fields from defs, resolution, dependency UUIDs, optional parent task UUID; detail shows parent/subtasks and comment @mentions.
- Kanban cards: due line and dependency count when present.
- **Org settings** (`/app/org-settings`): project creation policy, invite policy, legal hold.
- **Profile**: membership `preferences` (e.g. workspace notes) via `PATCH /auth/me/preferences`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ACTIVITY_LOG_RETENTION_DAYS` | When set to a positive integer, periodically delete `activity_logs` older than N days (global). |
| `AUDIT_EXPORT_MAX_DAYS` | Max date span for `GET /admin/audit/export`. |
| `SAML_ENTRY_POINT`, `SAML_ISSUER`, `SAML_IDP_CERT` | Probed by `/auth/sso/status` only; full SAML flow not wired. |
| `DATABASE_URL` | PostgreSQL URL; required for `apps/api` **integration** tests (`npm run test:integration`). |

### Invitations email (operator notes)

Invitation **accept URLs** are logged via `apps/api/src/services/mail.ts` when SMTP is not configured. For production delivery, add SMTP (or SendGrid/Postmark) inside `sendTenantInvitationEmail` — typical env names: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, plus a public **app base URL** for links in email bodies.

## Quality / tests

- **Unit:** `apps/api/src/services/slaPolicy.test.ts` (defaults P0–P4, overrides, calendar span); `boardTemplatesCatalog.test.ts` (catalog keys + public list shape).
- **Integration:** `apps/api/src/routes/slaTemplates.integration.test.ts` — public template routes, `POST /projects` with `templateKey`, board stages, `PATCH …/sla-policy` + SLA on task create (needs `DATABASE_URL` + migrations).

## Deferred (not in scope of current implementation)

- Goals/initiatives, timeline/Gantt view, full SAML login/JIT, marketplace-style OAuth apps, AI sprint summaries, HTML invitation templates (logging-only delivery today).
- Org-wide **project creation** policy is shipped under `tenant.settings.orgPolicies`; advanced portfolio planning remains future work.

---

## Archived roadmap outline (for context)

Priorities **P0 → P1 → P2** emphasized workflow depth, trustworthy metrics, permissions/audit, then multi-view and automation, then enterprise controls. **P3** (integrations marketplace, AI assist) remains future work beyond the core PM bundle (templates, SLA, invites, utilization).
