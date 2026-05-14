# MIRAI Tasker — roadmap & checklist (single source)

Canonical project checklist: **completed** backlog items (T1–T15, T16a, **P11**), **open** items (T16b, P1–P2, P8–P10, P12–P14, **M1–M5**), **not started** AI pipeline (A1–A15). Update statuses **here** only; run `npm run seed:roadmap` to refresh boards.

## Conventions

| Label | Meaning |
|--------|---------|
| **Done** | Shipped in repo; card sits in **Done** on Roadmap boards. |
| **Open** | Committed scope; active or queued product/engineering work. |
| **Not started** | Agreed backlog; no implementation PR merged yet. |

**Boards:** **Roadmap T** (product features T*), **Roadmap P** (platform, quality, notifications, identity), **Roadmap A** (automation / AI pipeline implementation), **Product improvement** (M* — packaging, gating, marketing alignment for Enterprise-only automation). **Related** links in [ROADMAP-TODO-SPECS.md](ROADMAP-TODO-SPECS.md) tie cross-board dependencies.

**Work-item inventory:** Inline `// TODO` / `FIXME` in `apps/*` are **not** used in this codebase today; deferred gaps from docs (e.g. SAML beyond probe, SMTP invites) are tracked as **P13**, **P14**. GitHub issues are **not** auto-imported (no `gh` in CI); add rows here if you track issues externally.

**See also:** [ROADMAP-TODO-SPECS.md](ROADMAP-TODO-SPECS.md) (implementation plans), [feature-matrix.md](feature-matrix.md), [jira-parity-roadmap.md](jira-parity-roadmap.md).

---

## Master checklist

| Status | ID | Area | Item | Notes / next action |
|--------|-----|------|------|---------------------|
| Done | T1 | Invites | Sharable invite links (per role) | `POST /invitations` + `acceptUrl`; Team copy link |
| Done | T2 | Invites | Revoke / regenerate invite | `DELETE /invitations/:id`, `POST /invitations/:id/rotate` |
| Done | T3 | Templates | Business & finance board template | `business_finance` in `boardTemplates.json` |
| Done | T4 | Automation (light) | Recurring tasks | `recurring_task_rules`, worker tick, board UI |
| Done | T5 | Boards | Configurable board columns | Board “Edit columns” → `kanbanStages` |
| Done | T6 | SLA | Org SLA defaults (days by priority) | Org settings P0–P4 + project/ITSM UIs |
| Done | T7 | Notifications | Reminder engine | Worker: due dates + SLA → notifications |
| Done | T8 | Notifications | Notification preferences | Profile: due, mentions, quiet hours + **IANA timezone** (P11) |
| Done | T9 | Notifications | Notification bell + API | `GET/PATCH/POST` notifications; AppShell |
| Done | T10 | Boards | Column width resize | `columnWidths` in board settings |
| Done | T11 | Tasks | My work (cross-board) | `GET /tasks/my-work` |
| Done | T12 | Collaboration | @mention → notification | Comment handles → `UserNotification` |
| Done | T13 | Quality | E2E baseline | `smoke`, `login-page`, `app-flows` (optional `E2E_*`) |
| Done | T14 | Templates | Tenant custom templates | Org JSON + Save as org template (admin) |
| Done | T15 | A11y | Targeted accessibility | Skip link, main landmark, column modal, nav labels |
| Done | T16a | Performance | List view virtualization | Task list virtualized when &gt;48 rows (e.g. list / My Work style views) |
| Open | T16b | Performance | Board card virtualization (Kanban) | Virtualize column card lists + DnD; see specs |
| Open | P1 | Notifications | Email / webhook delivery for alerts | In-app only today; channels TBD |
| Open | P2 | Quality | E2E depth | Invite, template project, board drag; stable selectors |
| Open | P8 | A11y | Focus trap on all modals | Task create, detail panel, notifications mobile |
| Open | P9 | Automation (light) | Recurring tasks across boards | Design + schema; **Related:** T4 |
| Open | P10 | Collaboration | Mention resolution | Display name / handles in UI |
| Done | P11 | Notifications | Quiet hours timezone | `quietHoursTimezone` + `Intl` wall clock; reminders, SLA in-app, @mentions respect quiet |
| Open | P12 | Ops | Rate limits / abuse | Template save, notification fanout |
| Open | P13 | Invites / Ops | SMTP transactional email for invitations | Production delivery; **Related:** jira-parity mail |
| Open | P14 | Identity | SAML SP-initiated SSO | Beyond `/auth/sso/status` probe; **Related:** jira-parity |
| Not started | A1 | AI pipeline | `automation_jobs` table + model | Migration; indexes for `state`, `next_run_at`, locks |
| Not started | A2 | AI pipeline | Job lifecycle | `queued` → `running` → `retrying` / `completed` / `failed`; lease; backoff; SLO |
| Not started | A3 | AI pipeline | Idempotency | Unique `idempotency_key`; enqueue helpers |
| Not started | A4 | AI pipeline | Worker queue drain | Claim/process in worker (or hand off to runner per design) |
| Not started | A5 | AI pipeline | Project automation board | `automationBoardId` + five system stages on that board |
| Not started | A6 | AI pipeline | Mirror on assign-to-agent | Sync mirror task on automation board; link in metadata |
| Not started | A7 | AI pipeline | API query filtering | Hide automation tasks by default; `includeAutomation=true` for privileged roles |
| Not started | A8 | AI pipeline | Board validation | Block accidental human creates on automation board |
| Not started | A9 | AI pipeline | Approve & Execute API | Manager-only; sole execution gate; ActivityLog |
| Not started | A10 | AI pipeline | `task.metadata.automation` summary | Sync summary from jobs: `job_id`, `phase`, `plan`, `pr_url`, `commit_sha`, `retry_count`, `errors[]`, `last_run_at`, `version` |
| Not started | A11 | AI pipeline | Webhook payload v2 | Secondary only; `schemaVersion`, transitions, job id, phase, context, snapshot |
| Not started | A12 | AI pipeline | `automation-runner` service | Separate container; GitHub App; pickup/results contract |
| Not started | A13 | AI pipeline | UI | Automation board entry, plan preview, Approve & Execute, timeline |
| Not started | A14 | AI pipeline | Security | HMAC; automation rate limits; runner key rotation runbook |
| Not started | A15 | AI pipeline | ActivityLog coverage | Phase changes, approval, job transitions |
| Open | M1 | Product / packaging | Enterprise + subscription gate for automation | Single source of truth (`plan` + `subscriptionStatus`); server helpers; feature flag hook |
| Open | M2 | Product / marketing | Landing + pricing copy | `LandingPage`, `pricingMatrix`, `planAvailabilityNotice`; Enterprise-only automation board |
| Open | M3 | Product / GTM | Feature matrix + tier intent | `docs/feature-matrix.md`; separate recurring tasks vs AI automation board |
| Open | M4 | Product / API | Enforce automation eligibility server-side | Block automation board provision, privileged queries, assign-to-agent unless Enterprise + active subscription |
| Open | M5 | Product / web | Conditional automation UI | Hide automation board entry, queue, CTAs unless tenant eligible; admin messaging |
| Open | M6 | Product / UX | Glassmorphic enterprise design system | Apply Stitch design language across board canvas + inspector; tokens, glass surfaces, nav cohesion |
| Open | M7 | Product / UX | Command palette (Cmd/Ctrl+K) | Global jump to projects/boards; fast navigation without changing APIs |
| Open | M8 | Product / UX | Board quick switcher | Switch boards inside project header; keep context; reduce clicks |
| Open | M9 | Product / UX | Inspector usability pass | Better hierarchy, sticky actions, consistent glass surfaces, smoother mobile behavior |
| Open | M10 | Product / UX | Saved views (v1) | Save per-board filters/density locally (no backend) and expose in toolbar |

### AI pipeline architecture (reference)

- One **automation board per project**; **assign-to-agent** mirrors into it.
- System phases: **Plan Draft**, **Plan Approved**, **Executing**, **PR/Review**, **QA** (other columns optional around these).
- **`automation_jobs`** = legal source of truth; **`task.metadata.automation`** = summary.
- **API** alone enqueues jobs; **worker** drains; **webhooks** = informational v2 payloads.
- **Approve & Execute** only starts execution; column moves are informational.
- **automation-runner** only holds git/GitHub App write credentials.

---

## Ops

- After pull: `npm run migrate -w @mirai/api` (or API container migrations on deploy).
- Playwright: optional `E2E_EMAIL`, `E2E_PASSWORD` when API is reachable from tests.
- **Sync tasks to boards:** `npm run seed:roadmap` — creates/updates boards **T, P, A, M**; loads [ROADMAP-TODO-SPECS.md](ROADMAP-TODO-SPECS.md) when present (implementation sections on cards). Use `API_BASE_URL=http://127.0.0.1:9080/api` when calling through the Docker web proxy. Optional: `.env.roadmap` (see [.env.roadmap.example](../.env.roadmap.example)); optional `MIRAI_ROADMAP_BOARD_M` / `MIRAI_ROADMAP_NAME_M` for Product improvement.
- **Done transitions:** set row **Status** to `Done` in the table, then run `ROADMAP_COMPLETION_COMMENTS=1 npm run seed:roadmap` (or `--completion-comments`) so each card that **newly** moves to Done gets a **Roadmap: Delivered** comment (skipped on no-op re-runs).
- **ID renames (P8–P14):** Older syncs used duplicate **P2** / **P3** IDs; cards with old UIDs may remain on boards—archive or delete orphans after re-seeding.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-05 | Initial `ROADMAP-TODOS.md` |
| 2026-05-05 | Single master table: T1–T16 + P1–P3 + A1–A15 with Done/Open/Not started |
| 2026-05-05 | Split T16 → T16a (Done, list virtualization) + T16b (Open, board cards); deduped extra P1 performance row |
| 2026-05-05 | Added `scripts/seed-roadmap-tasks.mjs` + `npm run seed:roadmap` |
| 2026-05-07 | Normalized unique P IDs (P8–P14); added P13 SMTP, P14 SAML; specs in ROADMAP-TODO-SPECS.md |
| 2026-05-07 | **P11 Done:** timezone-aware quiet hours (`notificationPrefs`, Profile, SLA + mention suppression) |
| 2026-05-07 | **Product improvement board (M):** M1–M5 packaging/gating/marketing for Enterprise-only automation; seed script + `metadata.roadmap.group` **M** |
