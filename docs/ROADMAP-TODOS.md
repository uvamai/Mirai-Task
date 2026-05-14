# MIRAI Tasker — roadmap & checklist (single source)

Canonical project checklist: **completed** backlog items (T1–T15, T16a, **P11**), **open** items (T16b, P1–P2, P8–P10, P12–P14, **M1–M5**, **PM1–PM22** — ClickUp University–aligned PM parity track), **not started** AI pipeline (A1–A15). Update statuses **here** only; run `npm run seed:roadmap` to refresh boards.

## Conventions

| Label | Meaning |
|--------|---------|
| **Done** | Shipped in repo; card sits in **Done** on Roadmap boards. |
| **Open** | Committed scope; active or queued product/engineering work. |
| **Not started** | Agreed backlog; no implementation PR merged yet. |

**Boards:** **Roadmap T** (product features T*), **Roadmap P** (platform, quality, notifications, identity), **Roadmap A** (automation / AI pipeline implementation), **Product improvement** (M* — packaging, gating, marketing alignment for Enterprise-only automation), **Roadmap PM** (PM* — [ClickUp University](https://university.clickup.com/)–mapped shell, views, fields, depth features; see master plan in [ROADMAP-TODO-SPECS.md](ROADMAP-TODO-SPECS.md)). **Related** links in [ROADMAP-TODO-SPECS.md](ROADMAP-TODO-SPECS.md) tie cross-board dependencies.

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
| Done | T17 | Onboarding / Import | Excel/CSV import → new board with dynamic mapping | Manager-only; multi-step wizard (upload → map → confirm); preview + commit + 5-minute undo; plan-tiered row + rate caps; works on every plan. See specs. |
| Done | T17a | Onboarding / Import | T17 Backend MVP | `xlsx` parser, preview/commit/cancel/undo routes, normalizers, `assertCanImportRowCount`, `assertImportRateLimit`, unit + integration tests |
| Done | T17b | Onboarding / Import | T17 Frontend wizard | `ImportExcelModal` (upload → map → confirm → done) + toolbar button + empty-state CTA |
| Done | T17c | Onboarding / Import | T17 PM follow-through | `POST /projects/:id/members/bulk` (existing tenant users + email invitations); unresolved-owners banner on imported board |
| Done | T17d | Onboarding / Import | T17 GTM | `planMatrix` + landing + feature-matrix + README updates; row-cap badge per tier |
| Done | T17e | Onboarding / Import | T17 Power-user (P5) | Mapping presets keyed on header signature (`tenant.settings.importPresets`); idempotent re-upload guard (24h SHA-256 window); outbound `board.imported` webhook; async path for &gt; 2000-row files via `import_jobs` + `FOR UPDATE SKIP LOCKED` worker drain |
| Open | P1 | Notifications | Email / webhook delivery for alerts | In-app only today; channels TBD |
| Done | P2 | Quality | E2E depth | Three Playwright specs (`invitations.spec.ts`, `template-project.spec.ts`, `board-dnd.spec.ts`) gated by per-test `E2E_*` env flags; stable `data-testid` selectors on invite form, project create form, board column + card + drag handle; pricing smoke heading aligned with current copy |
| Done | P8 | A11y | Focus trap on all modals | `useFocusTrap` hook applied to TaskDetailPanel, TaskCreateModal, ImportExcelModal, CreateBoardModal, PlanLimitModal, and the inline column/template dialogs on BoardPage; ESC closes each, role+aria-modal set, focus returns on close |
| Open | P9 | Automation (light) | Recurring tasks across boards | Design + schema; **Related:** T4 |
| Done | P10 | Collaboration | Mention resolution | API `/tasks/:id/comments` now batch-resolves `@handle` → `mentionDisplay[{ handle, userId, displayName, email }]` via a single tenant-scoped `User.findAll`; web `formatCommentBody` renders inline `@John Doe` chips inside the comment body (unknown handles fall back to plain `@handle`); footer pill list shows resolved names + clearly tags non-member handles |
| Done | P11 | Notifications | Quiet hours timezone | `quietHoursTimezone` + `Intl` wall clock; reminders, SLA in-app, @mentions respect quiet |
| Done | P12 | Ops | Rate limits / abuse | Generic `assertTenantRateLimit` / `tryTenantRateLimit` / `tryUserRateLimit` (sliding window, minute or hour) applied to: tenant settings template-save (30/h), single invite create (60/h), bulk member add (20/h), outbound webhook fanout (120/min, soft), per-recipient notifications (500/h, soft) + per-tenant notifications (2000/min, soft); 429 + `Retry-After` for hard limits; unit tests in `planLimits.test.ts`. **Note:** in-memory single-process — see specs for the Redis migration path. |
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
| Done | M6 | Product / UX | Glassmorphic enterprise design system | M6 tokens added in `index.css` (`glass-surface`, `glass-toolbar`, `glass-modal-card`, `glass-section`); adopted by inspector + board toolbar this pass; legacy `glass-card/panel/header/sidebar` kept for back-compat |
| Done | M7 | Product / UX | Command palette (Cmd/Ctrl+K) | `CommandPalette` now ships full keyboard navigation (↑/↓/Home/End/Enter), focus trap via `useFocusTrap`, grouped sections (Recent · Projects · Boards), and a per-browser recent-visits cache (`useRecentNavigation`, last 8, localStorage) that auto-populates as users land on a board route; ESC closes; selected row is highlighted with the indigo brand colour |
| Done | M8 | Product / UX | Board quick switcher | New `BoardSwitcher` dropdown replaces the native `<select>` in the project header — soft-navigates via React Router (preserves client state), records visits into the palette's recents, supports ↑/↓/Home/End/Enter/Esc, marks the active board, and exposes an inline "+ New board" CTA (Manager/Admin only) |
| Done | M9 | Product / UX | Inspector usability pass | TaskDetailPanel converted to center modal (T17 follow-up); `glass-modal-card`, sticky header + sticky footer with primary Close, wider `max-w-5xl`, 4-up Priority/Status/Estimate/Due row at md+; ESC + focus trap |
| Done | M10 | Product / UX | Saved views (v1) | `useSavedViews` hook persists per-board filters to localStorage (FIFO 50); board search + multi-priority filter wired into BoardPage `tasksByStatus`; toolbar Views dropdown with apply / save / delete |
| Open | PM1 | Product / PM shell | North-star + phased execution (Starlink / CU benchmark) | **University map:** [ROADMAP-TODO-SPECS.md](ROADMAP-TODO-SPECS.md) “ClickUp University: feature map…”; stages A–H; update this row + PM\* notes when each stage gates |
| Done | PM2 | Product / PM shell | Views system (+ View, per-view persistence) | Shell `useBoardShellView`; `mirai.viewColumnPrefs.v1` + `useViewColumnPrefs`; M10 saved views + column snapshots; board / list / **table** (`/boards/:id/table`, PM9 lite) / calendar; toolbars + Fields (PM3) |
| Done | PM3 | Product / PM shell | Fields / column visibility panel | **2026-05-14:** `FieldsPanel` slide-over (`components/board/FieldsPanel.tsx`); **Fields** toolbar CTA on board + list; `useViewColumnPrefs` + `resetDefaults` / `createDefaultViewColumnPrefs`; list + board sections with hints + workflow stage line; focus trap + Esc; quick chips unchanged (PM2). **Later:** server-side prefs, WIP limits, custom field columns (PM17) |
| Partial | PM4 | Product / PM shell | Task context menu (waves) | **Wave A:** `TaskCardContextMenu`; `?task=` URL; copy link/key/id; Open; Duplicate (Admin/Manager). **Wave B:** Open in new tab; **Move to** via `PATCH /tasks/:id`. **Wave C (2026-05-14):** `GET /tasks/:id/related` when menu opens — list related tasks, open same board / navigate cross-board (`boardShellAppPath` + `?task=`), open related in new tab; **Copy dependency IDs** for blocking `dependencies[]`. **Later:** subtype, keyboard-first, batch |
| Partial | PM5 | Product / PM shell | Task detail — scheduling + relationships rail | **Related work (2026-05-14):** `TaskDetailPanel` lists `GET /tasks/:id/related`, deep-links (`?task=`), link/unlink via POST/DELETE related (Admin/Manager or assignee). **Still open:** `startDate`, dedicated side rail, dependency graph viz |
| Open | PM6 | Product / PM shell | Activity side rail + rich composer | Threaded activity, @mentions, attachments stub; optional collapse behavior matching reference UX |
| Partial | PM7 | Product / PM shell | Templates center (lite) | `ProjectTemplatesPage` → `/app/projects/:id/templates` (GET `/board-templates`); link to `/app` to create with template; org JSON templates = T14. **Missing:** marketplace, apply-to-existing-project |
| Partial | PM8 | Product / PM shell | Onboarding / import hub pages | `ProjectGettingStartedPage` → `/app/projects/:id/getting-started`; **Get data in** in `ProjectTabs`. **Missing:** launcher-wide hub page, Import modal deep-link without opening board |
| Partial | PM9 | Product / PM shell | Gantt + Table views | **Table (lite)** shipped (shared `TaskListPage`, forced table layout). **Gantt:** not started — needs schedule bars, critical path, T16b perf |
| Open | PM10 | Product / PM shell | Whiteboards (optional product line) | Spike: embed vs native canvas; defer if out of core MV |
| Open | PM11 | Product / PM shell | Integrations + automation platform | Webhooks, email-in, rule builder depth — tie to P1 and automation eligibility (M*) |
| Not started | PM12 | Product / PM parity | Time tracking, timesheets, approvals | [University time tracking paths](https://university.clickup.com/); native vs integration ADR; see §PM12 |
| Not started | PM13 | Product / PM parity | Collaborative Docs / Wiki | University Docs + Wiki; §PM13 |
| Not started | PM14 | Product / PM parity | Forms builder and response routing | Beyond `intakePublic` / `PublicIntakePage`; visual builder + mapping; §PM14 |
| Not started | PM15 | Product / PM parity | Dashboards and portfolio reporting | Widget model, scoped queries; §PM15 |
| Not started | PM16 | Product / PM parity | Team Chat (channels, DMs, context threads) | Largest scope; bridge vs native ADR first; §PM16 |
| Not started | PM17 | Product / PM parity | Custom fields platform (manager, types) | After PM3; extend API `customFields`; §PM17 |
| Not started | PM18 | Product / PM parity | Sprints and agile ceremonies (lite) | Sprint entity, filters, burndown optional; §PM18 |
| Not started | PM19 | Product / PM parity | Tenant ClickApps-style feature modules | Safe toggles + server enforcement; §PM19 |
| Open | PM20 | Product / PM parity | Home, Inbox, Planner hub | **Partial:** T11 My work, M7 palette, T9 bell; **Next:** unified `/home`, planner, inbox triage per §PM20 |
| Not started | PM21 | Product / PM parity | Workspace AI UX (Brain / Agents class) | Gated on A* + M4/M5; §PM21 |
| Not started | PM22 | Product / PM parity | Goals, OKRs, portfolio rollups | Links PM12 capacity when present; §PM22 |

### PM1–PM22 — what “implement all” means (honest status)

| ID | In-repo today | Cannot ship without (dependencies) |
|----|----------------|-------------------------------------|
| PM1 | Stages A–H + University map live in [ROADMAP-TODO-SPECS.md](ROADMAP-TODO-SPECS.md) | Product sign-off per stage; not a single code deliverable |
| PM2 | **Done** — views, shell prefs, table route | Server-synced view presets (optional future) |
| PM3 | **Done** — `FieldsPanel` + prefs | Server prefs, WIP limits (PM17 ties in) |
| PM4 | **Partial** — waves A–C (copy, move, duplicate, **related** + **dep IDs** in ⋮ menu) | Subtype picker, **keyboard-first** menu, **batch** |
| PM5 | **Partial** — due, status, deps UUIDs, ITSM, **Related work** (`TaskRelation` in inspector) | Side **rail** layout, **startDate**, dependency **graph** |
| PM6 | **Partial** — Activity list inside `TaskDetailPanel` | Side rail layout, threading, attachments, composer parity |
| PM7 | **Partial** — templates browse page | Marketplace, apply template to existing project |
| PM8 | **Partial** — getting-started hub + tab | Full wizard unifying import without board context |
| PM9 | **Partial** — table view only | **Gantt:** new UI + date math + dep layout; likely new deps on T16b |
| PM10 | Not implemented | ADR: embed (Excalidraw/Figma) vs native canvas; legal/licensing |
| PM11 | **Partial** — webhooks exist in API for some events | Email-in (P1), rule builder UX, M4/M5 automation gating |
| PM12–PM16 | Not implemented | **PM12** ADR native vs integration; **PM13–16** large new services (editor, chat, dashboards) |
| PM17 | Partial — custom fields on task form | Field **manager** UI, governance, validation rules |
| PM18–PM19 | Not implemented | Sprint entity + migrations; tenant module toggles + enforcement |
| PM20 | **Partial** — `/app`, My work, palette, bell | Unified `/home`, planner calendar, inbox triage UX |
| PM21 | Not implemented | **A1–A15** pipeline + M4/M5 |
| PM22 | Not implemented | PM12/18 data; portfolio query layer |

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
- **Sync tasks to boards:** `npm run seed:roadmap` — creates/updates boards **T, P, A, M, PM**; loads [ROADMAP-TODO-SPECS.md](ROADMAP-TODO-SPECS.md) when present (implementation sections on cards). Use `API_BASE_URL=http://127.0.0.1:9080/api` when calling through the Docker web proxy. Optional: `.env.roadmap` (see [.env.roadmap.example](../.env.roadmap.example)); optional `MIRAI_ROADMAP_BOARD_M` / `MIRAI_ROADMAP_NAME_M`, **`MIRAI_ROADMAP_BOARD_PM` / `MIRAI_ROADMAP_NAME_PM`** for Roadmap PM.
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
| 2026-05-14 | **Roadmap PM (PM1–PM11):** ClickUp-style project shell / parity track; `seed-roadmap-tasks.mjs` gains board **PM**, `inferGroup` + spec heading regex for `PM*` IDs; Phase 1a web: app launcher, +View modal, project header chrome |
| 2026-05-14 | **ClickUp University master plan:** [university.clickup.com](https://university.clickup.com/) taxonomy + stages A–H in ROADMAP-TODO-SPECS; new backlog **PM12–PM22** (time, docs, forms, dashboards, chat, fields platform, sprints, modules, home hub, AI UX, goals); PM1/PM20 notes updated |
| 2026-05-14 | **PM2 ship:** per-board List/Board/Calendar default entry (`mirai.boardShellViewByBoardId`), Customize modal, navigation helpers; project layout board id from pathname (List/Calendar tabs correct) |
| 2026-05-14 | **PM4 Wave C:** task card ⋮ menu — related tasks (`GET /related`), cross-board deep links, copy dependency UUIDs |
| 2026-05-14 | **PM5 slice:** Task inspector **Related work** — `TaskRelation` list + link/unlink + deep-links (`TaskDetailPanel`) |
