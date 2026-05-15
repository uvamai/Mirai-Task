# Roadmap item specifications

This file is merged into **task descriptions** on Roadmap boards by `scripts/seed-roadmap-tasks.mjs` (see `## Item specifications` below). Keep **###** headings aligned with the **ID** column in [ROADMAP-TODOS.md](ROADMAP-TODOS.md) (T*, P*, A*, **M*** on Product improvement, **PM*** on Roadmap PM through **PM22**).

**Status labels** on cards follow the table: **Done** → column **Done**; **Open** / **Not started** → **Backlog** by default.

---

## ClickUp University: feature map and master implementation plan

**Official reference (paths, courses, webinars):** [ClickUp University](https://university.clickup.com/)

University content clusters **hierarchy & navigation**, **views** (List/Board/Calendar/Gantt/Table, filters, favorites), **custom statuses and workflows**, **ClickApps** (space-level modules), **custom fields** (including AI-assisted fields), **automations**, **dashboards**, **Docs/Wiki**, **Forms**, **Chat** (DMs, channels, location-based threads), **ClickUp Brain / AI** (knowledge, writer, project assist, agents), **time tracking & timesheets/approvals**, **Sprints/agile**, **capacity planning**, **whiteboards**, **templates**, **Home/Inbox/Planner**, **guests & admin**. This map informs MIRAI sequencing; it is **not** a commitment to clone ClickUp.

### Updating the todo list after each stage

When a **stage** below is code-complete and reviewed: (1) set the matching row(s) in [ROADMAP-TODOS.md](ROADMAP-TODOS.md) **Status** and refresh **Notes / next action** (one-line ship log + “Next: …”); (2) under the relevant `### PM*` section in this file, add an **Implemented (YYYY-MM-DD):** bullet list; (3) run `npm run seed:roadmap` so Roadmap PM tasks stay in sync.

### Feature taxonomy (University topics to MIRAI IDs)

| CU cluster | Example University themes | MIRAI IDs | Mirai baseline / intent |
|------------|----------------------------|-----------|-------------------------|
| Shell & navigation | Hierarchy best practices; CU interface; sidebar/toolbar | PM1, PM2, PM8, M7, M8 | Tenant/project/board; palette + board switcher shipped |
| Views & persistence | “Navigating with Views”; filters, favorites, search | PM2, PM3, PM9, M10 | M10 = saved filters v1; PM2 extends per-view state |
| Fields & data shape | Custom fields overview; field manager; AI fields (later) | PM3, PM17, T5, T10 | PM3 = show/hide; PM17 = definitions, types, governance |
| Task operations | Create task; relationships; cross-functional / linked work | PM4, PM5, T11, PM9 | My Work exists; multi-list metaphor = future |
| Collaboration | Comments; Chat learning paths; Inbox/Home | PM6, PM16, PM20, T12, P10 | Comments + mentions; Chat net-new |
| Knowledge | Docs & Wiki; Brain search | PM13, PM21 | No first-class wiki yet |
| Forms & intake | Forms simplify data collection | PM14, T17 | Public intake API + page exist; visual builder = PM14 |
| Automation & modules | Automate workflow; ClickApps for work styles | PM11, PM19, T4, P9 | Recurring per board; cross-board P9 open |
| Time & capacity | Time tracking path; timesheets; capacity planning | PM12, PM18, PM22 | Not started (product decision: native vs integration) |
| Planning | Planner; Calendar; Home | PM20, PM2 | Calendar route stub in +View modal |
| Reporting | Dashboards / TIML-style reporting | PM15 | Reports routes partial from project header |
| Agile | Software teams path; sprint planning series | PM18 | Optional lite sprints after PM9 |
| Visual collaboration | Whiteboards courses / Feature Fest | PM10 | Spike only until Stage F gate |
| AI | Brain; Agents; Super Agents paths | PM21, A1–A15 | Automation pipeline separate board; gating M* |
| Admin & identity | Admin cert prep; Guests | P14, T1–T2, roles | SAML P14 open |

### Master delivery stages (execution order)

Each stage lists **engineering outcomes**. Dependency: complete earlier stages before expanding surface area (especially PM16/PM13/PM21).

**Stage A — Stabilize core PM path (parallel OK)**  
Board list virtualization (**T16b**), notification delivery groundwork (**P1** where needed for parity stories), merge **M10** semantics into the PM2 view-state design doc before coding persistence. **Gate:** primary board/list flows pass smoke + typecheck; no open P0 UX regressions on M7/M8.

**Stage B — PM2 view persistence + PM8 hub links**  
Schema for per-user or per-board `viewPresets` (JSON versioned); restore last active view; “Customize view” drawer; onboarding hub (**PM8**) links import (**T17**), invites, first-board CTA. **Gate:** reload preserves view + visible columns for List and Board.

**Stage C — PM3 Fields + PM4 task menu**  
Column/card field visibility (`FieldsPanel` + PM2 chips); context menu (copy / duplicate / deep link / move column via **Wave A–B**). **Gate:** common task ops doable without opening inspector.

**Stage D — PM5 scheduling + PM6 activity**  
Start/due, dependencies UI wired to existing relation APIs; activity stream + composer (mention parity **P10**). **Gate:** comment and activity both usable for standup-style review.

**Stage E — PM7 templates center + PM8 completion**  
Browse Mirai + org templates; apply-to-project; polish empty states. **Gate:** template-driven project start documented for CS.

**Stage F — PM9 Gantt/Table**  
Shared column model with PM3; performance budget with **T16b**. **Gate:** two new view types read/write tasks through same API contracts.

**Stage G — PM11 integrations + PM19 ClickApps-style modules**  
Webhooks hardening, inbound signals, admin toggles for optional modules (safe defaults). **Gate:** no orphan premium nav; server enforces eligibility.

**Stage H — Depth backlog (spike → MVP each; order by GTM)**  
Pick one stream at a time unless staffed: **H1 PM12** time, **H2 PM13** docs, **H3 PM14** forms builder, **H4 PM15** dashboards, **H5 PM16** chat *or* bridge, **H6 PM17** custom fields platform, **H7 PM18** sprints, **H8 PM20** home/planner, **H9 PM21** AI UX on **A\***, **H10 PM22** goals/portfolio. **Gate (each):** ADR + security review + roadmap row moved to **Done** with verification bullets.

### Risks (short)

| Risk | Mitigation |
|------|------------|
| Scope creep on Chat/Docs/AI | Keep PM16/PM13/PM21 **Not started** until Stage F; prefer ship **bridge** or **embed** options |
| JSON view settings compatibility | Version key on `board.settings.viewPresets` / user prefs; migration helper |
| Cross-project leaks in dashboards | Tenant-scoped aggregates only; explicit project picker per widget |
| AI trust & compliance | PM21 follows M4/M5 and tenant data residency policy |

---

## Item specifications

### T1

**Outcome:** Role-scoped invitation links with `acceptUrl` for onboarding.

**Verification:** `POST /invitations`, public accept route, `EmployeesPage` copy flow; see [jira-parity-roadmap.md](jira-parity-roadmap.md).

**Related:** P13 (email delivery for invites).

---

### T2

**Outcome:** Operators can revoke or rotate invite tokens without DB surgery.

**Verification:** `DELETE` / `POST …/rotate` on invitations API.

**Related:** T1, P13.

---

### T3

**Outcome:** `business_finance` template available in catalog and project create.

**Verification:** `boardTemplates.json`, template gallery.

**Related:** T14.

---

### T4

**Outcome:** Per-board recurring rules, worker tick, board UI for rules.

**Verification:** `recurring_task_rules`, worker, `ProjectAutomationsPage` / board integrations.

**Related:** P9 (cross-board recurrence).

---

### T5

**Outcome:** Kanban stages editable per board; persisted in `kanbanStages`.

**Verification:** Board settings PATCH, column editor UI.

**Related:** T16b (virtualization must respect column model).

---

### T6

**Outcome:** Org and project SLA defaults (P0–P4), ITSM UI surfaces.

**Verification:** `slaPolicy`, `ProjectItsmSettingsPage`, org settings.

**Related:** T7.

---

### T7

**Outcome:** Worker generates notifications from due dates and SLA transitions.

**Verification:** `slaTick` / reminder paths, `UserNotification` rows.

**Related:** P1, P11.

---

### T8

**Outcome:** Users control channels (due, mentions) and quiet hours (UTC baseline).

**Verification:** Profile preferences API + UI.

**Related:** P11.

---

### T9

**Outcome:** In-app notification center with unread counts.

**Verification:** AppShell bell, `GET/PATCH` notifications API.

**Related:** P1.

---

### T10

**Outcome:** Column widths persisted in board `settings.columnWidths`.

**Verification:** Board UI resize, API persistence.

**Related:** T16b.

---

### T11

**Outcome:** Cross-board assigned work with sorting.

**Verification:** `GET /tasks/my-work`, `MyWorkPage`.

**Related:** T16a.

---

### T12

**Outcome:** Comment @handles enqueue mention notifications.

**Verification:** `commentMentions`, `TaskDetailPanel`.

**Related:** P10.

---

### T13

**Outcome:** Playwright smoke + login + optional app flows with env-gated credentials.

**Verification:** `apps/web` e2e specs, CI docs.

**Related:** P2.

---

### T14

**Outcome:** Org-level custom templates (JSON) and save-board-as-template (admin).

**Verification:** Org settings, template APIs.

**Related:** T3.

---

### T15

**Outcome:** Baseline a11y: skip link, landmarks, modal labels, nav.

**Verification:** Manual audit + lint where configured.

**Related:** P8.

---

### T16a

**Outcome:** List-style views virtualize long task lists (&gt;48 rows).

**Verification:** List / My Work paths use virtual list.

**Related:** T16b, T11.

---

### T17

**Requirement:** Project managers (and Admins) can create a new board by uploading an Excel/CSV file and mapping spreadsheet columns to task fields (title, status, priority, assignee, due date, tags, custom fields). The feature must work on every subscription plan, respect per-project board caps, and stay rate-limited per tenant.

**Why:** Onboarding from existing trackers / spreadsheets is the #1 friction for new tenants. Solving it once unlocks every plan tier and converts pure "evaluation" sessions into long-lived boards.

**Constraints:**
- Manager/Admin only; multipart upload ≤ 5 MB; row caps per plan (200/5,000/50,000/∞).
- Imported boards count toward each plan's `maxBoardsPerProject` cap (Starter=3, Standard=10, Pro=25, Enterprise=∞).
- Per-tenant import rate limits (2/10/30/∞ imports/hour).
- Title is the only required mapping; everything else is optional with sensible defaults.
- All inputs validated by Joi; same `assertProjectMemberAccess` gate as `/projects/:id/boards`.

**Dependencies:** existing `Board`/`Task` models, `assertCanCreateBoard`, `customFields`, `socket.emitBoardTasksUpdated`, `invitationService` (for the bulk follow-through).

**Acceptance criteria:**

- `POST /projects/:id/imports/excel/preview` returns a non-persisted snapshot: sheets, headers, sample rows, distinct status/priority/owner values, suggested mapping.
- `POST /projects/:id/imports/excel/commit` creates the board in a single transaction, inserts all rows as tasks, snaps each row's status onto the derived/explicit Kanban stages, and records `board.import.excel` in `ActivityLog`.
- `DELETE /projects/:id/imports/excel/:uploadId` cancels a preview before commit.
- `POST /projects/:id/boards/:boardId/undo-import` deletes a freshly-imported board (and its tasks) within 5 minutes.
- `POST /projects/:id/members/bulk` accepts both `userId` (existing tenant member → ProjectMember) and `email` (creates `TenantInvitation` if user is unknown).
- Frontend wizard at `ImportExcelModal` (upload → map → confirm → done) is reachable from the project header toolbar and the empty-board state.
- Pricing matrix, landing page, README, and feature matrix advertise the feature with row-cap and rate-cap badges per tier.

**Implementation plan (delivered):**

1. **P0 — Foundation:** `xlsx` dep in `apps/api`; service skeleton at `apps/api/src/services/excelImport.ts`; synthetic `excel_import` template registered in `boardTemplatesCatalog.ts`.
2. **P1 — Backend MVP:** pure-function parser + mapping (priority/date/owner normalizers, custom-field targets), `preview`/`commit`/`cancel`/`undo-import` routes, row-cap + rate-limit, Joi validators in `apps/api/src/validation/imports.ts`, 18 unit tests + integration test.
3. **P2 — Frontend wizard:** `apps/web/src/pages/ImportExcelModal.tsx` (upload/map/confirm/done) with header-driven mapping selects, "derive Kanban stages from Status" toggle, downloadable project-aware template; wired into `ProjectLayout` toolbar and `ProjectBoardIndex` empty state.
4. **P3 — PM follow-through:** `POST /projects/:id/members/bulk` (existing tenant users + email invitations); imported board renders an `ImportBanner` listing unresolved owner references with one-click bulk add/invite.
5. **P4 — GTM / docs:** `pricingMatrix.ts` (all four plans), `LandingPage.tsx`, `PricingPage.tsx` (explicit row/rate-cap comparison strip), README, `docs/feature-matrix.md`, `docs/ROADMAP-TODOS.md` (this entry). **Call-out:** the `standard` plan is referenced in `pricingMatrix.ts` but is not yet seeded in `subscription_plans` (initial-schema migration only seeded `starter`/`pro`/`enterprise`). Backfilling it is intentionally deferred to a separate PR; today no tenant maps to `standard` so the row-cap fallback to "pro" caps is dead code.
6. **P5 — Power-user (delivered as part of T17 follow-up, see T17e):** mapping presets persisted on `tenant.settings.importPresets` keyed by header signature; idempotent re-upload guard via `metadata.importedFrom.fileHash` (24h window); outbound `board.imported` webhook; async worker path for files > 2000 rows via `import_jobs` table using `FOR UPDATE SKIP LOCKED`.

**Related:** T14 (templates), P12 (rate limits), M4 (plan eligibility).

---

### T16b

**Requirement:** Kanban columns must scale to large card counts without DOM blow-up, while preserving **dnd-kit** (or equivalent) drag-and-drop semantics and accessibility.

**Why:** Board view remains the primary execution surface; list virtualization (T16a) does not cover per-column card stacks. Pro/Enterprise positioning assumes responsive boards (see [feature-matrix.md](feature-matrix.md)).

**Constraints:** Must work with existing `kanbanStages`, column scroll, and task card chrome; must not break multi-column DnD or “Blocked/Waiting” overlays if present.

**Dependencies:** T5, T10; coordinate with **P2** (E2E must cover DnD after virtualization).

**Acceptance criteria:**

- Columns with N cards (e.g. 200+) keep scroll FPS within interactive range on mid-tier laptops.
- Drag start / move / drop behavior matches pre-virtualization baselines for same-column and cross-column moves.
- Keyboard-accessible move paths still function where supported today.
- No loss of task fields on cards (assignee, due, priority, dependency badge).

**Alternatives considered:** (1) Non-virtual full DOM with pagination—rejected: breaks “scan the column” UX. (2) Replace DnD library—rejected: high regression cost. (3) **Hybrid virtual list inside column** + DnD bridge (e.g. measured items, drag overlay)—**short-listed**. (4) Windowed rendering only when column &gt; threshold—**short-listed** for lower risk.

**Chosen approach:** **Threshold-gated virtualization per column** using a measured row strategy compatible with **dnd-kit** (custom collision / drag overlay as needed). Prefer incremental rollout behind a board or tenant flag if implementation risk warrants.

**Implementation plan:**

1. **Spike (1–2d):** Prototype virtualized column + single-card DnD in isolation; document gaps (measurement, placeholder height, drop targets).
2. **Architecture:** Introduce a `VirtualizedBoardColumn` wrapper; feed stable `task.id` keys; preserve `boardId` / `status` in drag payload.
3. **Data path:** No API change; ensure `GET /boards/:id/tasks` ordering stable for virtual indices.
4. **UI:** Match existing card component; add skeleton/placeholder for dynamic height if cards vary.
5. **Testing:** Unit tests for ordering helpers; Playwright scenario: create many tasks, drag across columns; perf smoke (optional).
6. **Rollout:** Feature flag or column-count threshold; monitor error telemetry.

**Related:** T16a, P2, T5.

---

### P1

**Requirement:** Deliver notification events through **email** and/or **customer webhooks** (beyond existing project task webhooks), aligned to plan tiers in [feature-matrix.md](feature-matrix.md).

**Why:** In-app bell is insufficient for operational response SLAs; Pro/Enterprise expect outbound channels.

**Constraints:** Tenant secrets storage; idempotent delivery; rate limits (**P12**); quiet hours (**P11**) must filter send times.

**Dependencies:** T7–T9; outbound delivery worker; provider credentials in tenant or org settings.

**Acceptance criteria:**

- Admin can configure at least one email provider path (SMTP or API) and/or notification webhook URL with signing secret.
- Notification events respect user/channel preferences and quiet hours.
- Failed deliveries retry with backoff; delivery log visible to admin (extend or mirror `webhookDeliveryLog` patterns).

**Alternatives considered:** (1) SMTP-only—simple but weak for scale. (2) Provider API (SendGrid/Postmark)—ops complexity. (3) **Dual: SMTP + HTTP webhook for notifications**—**chosen** for mid-market flexibility.

**Chosen approach:** **Pluggable channel interface** in worker: `email(smtp|api)` + `httpNotificationWebhook`; configuration under tenant settings with encryption at rest for secrets.

**Implementation plan:**

1. **Model & config:** Extend tenant/org settings schema; validation; admin UI section.
2. **Worker:** Fan-out from existing notification events; template rendering (text first).
3. **Security:** HMAC or signed headers for webhooks; redact PII in logs.
4. **UI:** Org settings: test send, channel toggles.
5. **Tests:** Integration tests with mock SMTP/server; contract tests for webhook payload.
6. **Rollout:** Feature-flag per plan tier; docs for operators.

**Related:** P11, P12, T7, A11 (avoid payload overlap—keep automation webhooks separate).

---

### P2

**Requirement:** Broaden E2E to cover invite acceptance, template-based project creation, and board drag-and-drop.

**Why:** Core revenue paths (invite → collaborate → manage board) need regression safety.

**Constraints:** Flaky DnD in headless browsers; must use stable `data-testid` / roles; `E2E_*` env for credentials.

**Dependencies:** T1–T3, T5, T16b (coordinate selectors after board changes).

**Acceptance criteria:**

- CI or documented local command runs invite + project + board DnD happy paths.
- Failures produce traces/screenshots under `test-results/`.

**Alternatives considered:** (1) API-only tests—rejected for DnD. (2) Visual regression—optional future. (3) **Playwright user journeys**—**chosen**.

**Chosen approach:** **Three focused specs** with shared fixtures; gate DnD spec if `E2E_DND=0`.

**Implementation plan:**

1. Inventory selectors; add missing `aria` / test ids.
2. Seed helpers for invite + accept (mail catcher or API shortcut).
3. Implement flows; parallel-safe data (unique emails).
4. Document env in `CONTRIBUTING.md` / Ops.

**Implemented (2026-05-12):**

- New specs: `apps/web/e2e/invitations.spec.ts`, `template-project.spec.ts`, `board-dnd.spec.ts` — each gated by its own opt-in env (`E2E_INVITES`, `E2E_TEMPLATE_PROJECT`, `E2E_BOARD_DND`) on top of `E2E_EMAIL` / `E2E_PASSWORD`, so CI runs that don't want side effects can skip.
- Added `data-testid` hooks on the invite form (`invite-email`, `invite-role`, `invite-submit`, `invitation-row`), the project create form (`project-name`, `project-template`, `project-seed-samples`, `create-project-submit`, `project-link`), and the board (`board-column`, `board-card`, `board-card-drag-handle`).
- DnD spec drives dnd-kit via `page.mouse.*` stepping past the 6px PointerSensor activation distance — no third-party plugin required.
- Fixed the pre-existing pricing smoke heading regression (`Per-tenant` → `Subscription plans`) so the `smoke` suite is green again.
5. Optional CI job when secrets available.

**Related:** T13, T16b.

---

### P8

**Requirement:** All modals trap focus, restore focus on close, and support Escape; includes task create, detail panel, notifications drawer on mobile.

**Why:** WCAG-consistent modals; [feature-matrix.md](feature-matrix.md) lists modal focus coverage as planned.

**Constraints:** Nested modals (confirm over create); mobile viewports; React portals.

**Dependencies:** T15 baseline.

**Acceptance criteria:**

- axe or manual checklist passes for sampled modals.
- No background focus leakage; visible focus ring.

**Alternatives considered:** (1) Per-modal `useFocusTrap`—**chosen** for control. (2) Third-party headless primitives—evaluate if duplication hurts.

**Chosen approach:** Shared **`FocusTrap` wrapper** + `react-remove-scroll` (or native `inert` where supported) with unit tests for open/close lifecycle.

**Implementation plan:**

1. Audit modal entry points; list inventory in PR.
2. Implement wrapper; migrate highest-traffic modals first.
3. Mobile pass on notifications sheet.
4. Add Playwright a11y smoke (optional).
5. Document pattern for new modals.

**Related:** T15, P2.

---

### P9

**Requirement:** Extend recurring tasks to **multiple boards** / projects with clear ownership and limits.

**Why:** Operations teams repeat work across portfolios; today recurrence is per-board (**T4**).

**Constraints:** Plan limits (`maxProjects`, task volume); worker idempotency; no duplicate spawns.

**Dependencies:** T4, worker architecture, plan limits service.

**Acceptance criteria:**

- Rule can target a template or multiple boards with explicit scope.
- Failure in one board does not poison others; logs identify board/rule.

**Alternatives considered:** (1) Duplicate rules per board—rejected (operational burden). (2) **Org-level recurrence policy object**—**chosen** as north star; phase 1 may allow **enumerated board IDs** on rule.

**Chosen approach:** **Phase 1:** JSON array `boardIds` on rule with validation; **Phase 2:** template-based expansion.

**Implementation plan:**

1. Schema migration + API validation.
2. Worker scheduling loop iterates scoped boards.
3. UI: multi-select boards with plan guardrails.
4. Tests: integration across two boards.
5. Docs + feature flag.

**Related:** T4, P12.

---

### P10

**Requirement:** Resolve @mentions to **display names** and stable handles; clarify collisions.

**Why:** Mention notifications (**T12**) fire; UI still shows raw handles in places.

**Constraints:** Privacy (hide email); tenant-scoped directory; performance on large tenants.

**Dependencies:** User directory APIs, comment renderer.

**Acceptance criteria:**

- Task comments and notifications show display name with handle fallback.
- Collisions surfaced (e.g. `@jane.doe` disambiguation).

**Alternatives considered:** (1) Client-only map—stale. (2) **Server resolves mention metadata on write**—**chosen** for consistency.

**Chosen approach:** Enrich comment payload with `mentionsResolved: { userId, label }[]` at POST time; backfill job optional.

**Implementation plan:**

1. Extend comment create service.
2. Web renderer uses resolved labels.
3. Notification deep links preserve mapping.
4. Tests for collision + rename latency.

**Implemented (2026-05-12):**

- API: new `resolveMentionDisplay(tenantId, handles[])` in `apps/api/src/services/mentionUsers.ts` returns `Map<handle, { handle, userId, displayName, email }>` via a single tenant-scoped `User.findAll`. `GET /tasks/:taskId/comments` now batches every unique handle across the result set into one resolve call and attaches `mentionDisplay[]` to each row (alongside the raw `mentions[]` for back-compat).
- Web: `apps/web/src/features/tasks/formatMentions.tsx` exposes `formatCommentBody(body, mentions)` which tokenises `@(handle)` against the resolved set and renders styled `@DisplayName` chips inline; unknown handles fall through to plain `@handle` so we never silently lose info when a member leaves.
- `TaskCommentsSection` now uses the new util for both the inline body and the pill row; non-member handles are surfaced in a separate slate-tone pill so authors notice typos.

**Related:** T12, P2.

---

### P11

**Outcome (shipped 2026-05-07):** `preferences.notifications.quietHoursTimezone` (IANA). `quietHoursBlock()` uses `Intl.DateTimeFormat` wall clock in that zone (fallback **UTC** if unset/invalid). **Due reminders** (`reminderTick`), **SLA in-app notifications** (`slaTick`), and **@mention** creates (`tasks.ts`) skip delivery during the quiet window.

**Tests:** `apps/api/src/services/notificationPrefs.test.ts`.

**Profile:** timezone `<select>` + clarified copy; `quietHoursStart` / `quietHoursEnd` / `quietHoursTimezone` saved atomically.

**Follow-ups (optional):** browser-suggested default on first visit; mention/SLA **queue** instead of drop (out of scope v1).

**Related:** T8, P1.

---

### P12

**Requirement:** Rate limits and abuse controls for expensive endpoints (template save, notification fanout, invite creation).

**Why:** Protect tenants; Enterprise posture in matrix.

**Constraints:** Per-tenant fairness; configurable limits; observability.

**Dependencies:** Existing `authLimiter` patterns; Redis optional—may use in-memory for single-node dev.

**Acceptance criteria:**

- 429 with `Retry-After` on burst; admin-visible counters (optional phase 2).

**Alternatives considered:** (1) Global IP limit only—insufficient. (2) **Per-tenant token bucket**—**chosen**.

**Chosen approach:** Middleware + Redis (production) with in-memory fallback for dev.

**Implementation plan:**

1. Identify hot routes; define defaults.
2. Implement limiter service; wire middleware.
3. Tests for threshold behavior.
4. Runbook + env knobs.

**Implemented (2026-05-12, v1 — in-memory):**

- `apps/api/src/services/planLimits.ts` now exposes three helpers backed by a single `rateBuckets: Map<string, number[]>` (sliding window, minute or hour):
  - `assertTenantRateLimit({ tenantId, key, cap, window?, label? })` — throws `TenantRateLimitError` (HTTP 429 + `Retry-After`) when the per-tenant cap is exceeded for a given `key`.
  - `tryTenantRateLimit(...)` / `tryUserRateLimit(...)` — soft variants returning `false` instead of throwing; used for fanout (drop + log).
  - `_resetRateLimits()` for tests.
- Surfaces wired up:
  - `PATCH /tenant/settings` (when `customBoardTemplates` or `tagCatalog` is mutated) — 30/hour/tenant (`tenant_settings_write`).
  - `POST /invitations` — 60/hour/tenant (`invitation_create`) layered on top of the existing IP-based `inviteCreateLimiter`.
  - `POST /projects/:id/members/bulk` — 20/hour/tenant (`members_bulk`).
  - `fireProjectWebhooks` — 120/minute/tenant soft cap (`webhook_fanout`); dropped deliveries are logged and recorded in the project's `webhookDeliveryLog` with `ok:false, httpStatus:0` for observability.
  - `createUserNotification` — 2000/minute/tenant + 500/hour/user soft caps (`notifications_create`); drops with `logger.warn`.
- 429 responses include `code: "LIMIT_RATE_<KEY>"`, `retryAfterSeconds`, and a `Retry-After` HTTP header.
- Unit tests in `apps/api/src/services/planLimits.test.ts` cover per-tenant isolation, per-key isolation, reset, hard vs soft variants, and the sliding-window lookback.
- **Known limit:** single-process / single-node. For multi-instance API deployments, migrate `rateBuckets` to Redis (`INCR` + `EXPIRE` per `t:<tenantId>:<key>:<windowBucket>`) before turning these caps down meaningfully.

**Related:** P1, P9.

---

### P13

**Requirement:** Production-ready **SMTP (or provider API)** delivery for invitation emails (replace log-only / dev behavior documented in [jira-parity-roadmap.md](jira-parity-roadmap.md)).

**Why:** Self-serve onboarding cannot rely on console logs.

**Constraints:** Secrets in Key Vault / env; bounce handling out of scope v1; align with **P1** if shared mailer.

**Dependencies:** `mail.ts`, `sendTenantInvitationEmail`, tenant settings.

**Acceptance criteria:**

- Invite email delivered in staging with real provider.
- Failures logged with non-secret diagnostics; retries where safe.

**Alternatives considered:** (1) Embedded SendGrid only—**rejected** (lock-in). (2) **SMTP + optional HTTP API adapter**—**chosen** to mirror P1 strategy.

**Chosen approach:** **Shared mailer module** used by invites first; extend to notifications later.

**Implementation plan:**

1. Env vars + validation (`SMTP_*` or API key).
2. Implement provider; HTML + text templates.
3. Wire invitation flow; feature flag.
4. Observability + integration test with mock server.
5. Security review (secrets, injection).

**Related:** T1, P1, P14 (SSO may change invite copy).

---

### P14

**Requirement:** **SP-initiated SAML SSO** beyond `/auth/sso/status` readiness probe.

**Why:** Enterprise deals; item listed as scaffold-only in jira-parity.

**Constraints:** JIT provisioning policy; multi-tenant IdP metadata; session compatibility with refresh tokens.

**Dependencies:** `authSso` routes expansion, IdP certs, Entra/Okta test tenants.

**Acceptance criteria:**

- User can sign in via IdP; tenant membership resolved per policy.
- Logout / session refresh coherent with JWT issuance.

**Alternatives considered:** (1) OIDC first—may parallel-track. (2) **SAML 2.0 Web SSO**—**chosen** per existing scaffold naming.

**Chosen approach:** Use established Node SAML lib; store IdP metadata per tenant; map `NameID` → user linkage rules.

**Implementation plan:**

1. Threat model + metadata storage schema.
2. Implement ACS + request signing; clock skew handling.
3. JIT vs invite-only policy flag.
4. E2E with test IdP container (optional).
5. Docs for admins.

**Related:** P10 (identity display), jira-parity SAML notes.

---

### A1

**Requirement:** Durable **`automation_jobs`** table as source of truth for AI/automation execution (state, lease, next run).

**Why:** Mirrors product architecture in ROADMAP-TODOS; tasks alone cannot coordinate leases/backoff.

**Constraints:** Postgres JSONB for payload; indexes for worker queries; migration reversible in dev.

**Dependencies:** Sequelize models; worker process.

**Acceptance criteria:** Migration applied; model + basic repository; no UI yet.

**Alternatives:** Queue-only (SQS)—defer; **DB-first** chosen for transactional consistency with tasks.

**Implementation plan:** (1) Migration + model. (2) Indexes `(tenant_id, state, next_run_at)`. (3) Unit tests for state guards. **Related:** A2–A4.

---

### A2

**Requirement:** Job state machine: `queued` → `running` → `retrying` | `completed` | `failed` with lease, stale-worker reclaim, bounded backoff.

**Why:** Reliable automation without duplicate execution.

**Constraints:** At-least-once delivery; idempotent handlers (**A3**).

**Acceptance criteria:** Integration test simulates crash mid-run; job becomes reclaimable.

**Alternatives:** Celery/BullMQ external—future scale-out; **in-DB lease** chosen for v1.

**Implementation plan:** (1) Service module for transitions. (2) Worker loop with `FOR UPDATE SKIP LOCKED` pattern. (3) Metrics hooks. **Related:** A1, A4, A14.

---

### A3

**Requirement:** **`idempotency_key`** unique per tenant (or global) to prevent duplicate enqueues.

**Why:** API retries and webhooks must not double-run expensive work.

**Acceptance criteria:** Duplicate POST returns existing job reference.

**Alternatives:** Natural key on taskId+phase—**composite unique** chosen as variant.

**Implementation plan:** (1) Column + partial index. (2) Helper `enqueueAutomationJob`. **Related:** A9.

---

### A4

**Requirement:** Worker drains queue: claim, execute hook (stub), complete/fail.

**Why:** Separates API latency from long-running work.

**Dependencies:** Existing API worker container pattern.

**Implementation plan:** (1) Register tick in `worker.js`. (2) Pluggable executor interface. **Related:** A12.

---

### A5

**Requirement:** Per-project **automation board** with five system stages (Plan Draft → QA).

**Why:** Visual contract for managers; aligns with ITSM mental model.

**Acceptance criteria:** Board created with enforced stage names; referenced on project settings `automationBoardId`.

**Alternatives:** Virtual board—rejected for visibility.

**Implementation plan:** (1) Settings field. (2) Provision on enable flag. (3) Seed columns. **Related:** A8.

---

### A6

**Requirement:** **Assign-to-agent** creates/updates mirror task on automation board; links `metadata.automation` / job id.

**Why:** Single pane for humans watching automation.

**Implementation plan:** (1) Hook in assign route. (2) Idempotent mirror upsert. **Related:** A5, A10.

---

### A7

**Requirement:** Default API/list views **hide** automation-board tasks; `includeAutomation=true` for privileged roles.

**Why:** Reduces noise for general users.

**Implementation plan:** (1) Query filters in task list services. (2) Audit logging on privileged queries. **Related:** A5.

---

### A8

**Requirement:** Block human task create on automation board (except system/service principal).

**Why:** Prevents process corruption.

**Implementation plan:** (1) Guard in `POST` task. (2) Integration tests. **Related:** A5.

---

### A9

**Requirement:** **Approve & Execute** API—manager-only; sole gate to move job to executing phase; ActivityLog entries.

**Why:** Governance; column moves are informational only (architecture doc).

**Implementation plan:** (1) Route + policy middleware. (2) Wire to A2 transitions. **Related:** A13.

---

### A10

**Requirement:** **`task.metadata.automation`** summary mirrored from job rows (`job_id`, `phase`, `plan`, `pr_url`, `commit_sha`, `retry_count`, `errors[]`, `last_run_at`, `version`).

**Why:** Fast UI reads without joining heavy job payload every time.

**Implementation plan:** (1) Validator in `customFields` reserved keys. (2) Sync on job events. **Related:** A1, customFields patterns.

---

### A11

**Requirement:** **Webhook payload v2** (informational): `schemaVersion`, transition, `automation_job_id`, phase, tenant/project/board/task context, metadata snapshot.

**Why:** External SOAR integrations.

**Implementation plan:** (1) Versioned serializer. (2) Dual-publish v1+v2 during migration. **Related:** P1 (don’t conflate user notifications with automation hooks).

---

### A12

**Requirement:** **`automation-runner`** container with GitHub App credentials; pickup/results contract with API.

**Why:** Least privilege—API/worker does not hold repo write tokens.

**Implementation plan:** (1) AuthN between runner and API (mTLS or signed JWT). (2) Job lease protocol. **Related:** A14.

---

### A13

**Requirement:** Web UI: automation board entry, plan preview, **Approve & Execute**, phase timeline.

**Why:** Operator trust and transparency.

**Implementation plan:** (1) Routes under project. (2) Read-only plan until approved. **Related:** A9, A10.

---

### A14

**Requirement:** **HMAC** verification for inbound runner/webhook endpoints; rate limits; key rotation runbook.

**Why:** Attack surface grows with automation.

**Implementation plan:** (1) Middleware. (2) Docs `docs/` ops runbook. **Related:** P12.

---

### A15

**Requirement:** **ActivityLog** entries for phase changes, approvals, job transitions (correlation ids).

**Why:** Audit for Enterprise tier.

**Implementation plan:** (1) Emit from A2/A9. (2) Export compatibility with audit NDJSON. **Related:** jira-parity audit export.

---

### M1

**Requirement:** **Authoritative eligibility** for AI/automation board features: **`enterprise` plan (or contractual equivalent)** and **active subscription** (paid/current term—not expired or churned).

**Why:** Product positions the automation board and agent execution pipeline as Enterprise-only; enforcement must not rely on UI hiding alone.

**Constraints:** Align with existing `Tenant` / plan resolution; handle dev/staging overrides via env only; document trial behavior (e.g. Enterprise trial flag if product adds one).

**Acceptance criteria:**

- Single helper e.g. `tenantAutomationEligible(tenant)` used by API routes and workers.
- Unit tests for plan + subscription combinations.
- No automation board ID persisted for ineligible tenants unless migration backfill is explicit.

**Implementation plan:**

1. **Model:** Confirm fields for `planCode`, `subscriptionStatus` / billing term end; extend if only implicit today.
2. **Service:** Central `automationEligibility` module; log reason codes for 403s (optional).
3. **Wire:** Call from board provisioning (A5), task assign-to-agent (A6), `includeAutomation` paths (A7).
4. **Flags:** Optional `FEATURE_AUTOMATION_ENTERPRISE` for staged rollout.

**Related:** M4, M5, A5–A7, [feature-matrix.md](feature-matrix.md).

---

### M2

**Requirement:** **Public marketing surfaces** state clearly: **dedicated AI/automation board**, **agent assign / review queue**, and **Approve & Execute** are **Enterprise** capabilities and require an **active Enterprise subscription**—not included in Starter, Standard, or Pro.

**Why:** Avoid misleading “automation” language on Pro when only **recurring tasks** (schedule-based) apply there.

**Acceptance criteria:**

- `apps/web/src/content/pricingMatrix.ts`: Pro describes operational/recurring/SLA depth without implying AI board; Enterprise lists automation board + subscription qualifier.
- `LandingPage.tsx` (and pricing section copy): aligned bullets and hero subcopy.
- `planAvailabilityNotice` updated if it mentions feature availability.

**Implementation plan:**

1. Edit `pricingMatrix` features + Enterprise description; tighten Pro `description` string.
2. Landing “Why MIRAI” + subscriptions intro paragraph.
3. Quick pass on `PricingPage.tsx` only if headings need the same wording (inherits matrix).

**Related:** M3, M1.

---

### M3

**Requirement:** **`docs/feature-matrix.md`** adds explicit rows: **AI automation board / agent pipeline** = **Enterprise only** (with **subscription** note); **recurring tasks** remain **Pro+** as today; tier intent prose distinguishes **process automation (recurring)** vs **AI automation board**.

**Why:** GTM single source for sales and engineering.

**Implementation plan:**

1. Add matrix rows for automation board, review/approval workflow, runner integration (map to A* roadmap).
2. Adjust “Pro: operational scale, automation” phrasing to **recurring + SLA** where it implies AI.
3. Planned summary bullet for Enterprise automation packaging.

**Related:** M2, A1–A15.

---

### M4

**Requirement:** **Server-side enforcement** of M1: reject or no-op **automation board creation**, **mirror task** creation, **`includeAutomation`**, and **Approve & Execute** when tenant is not Enterprise + active subscription.

**Why:** Security and contract alignment; prevents API bypass.

**Acceptance criteria:**

- Appropriate HTTP status (403/404 per product policy) with stable `code` in error body if API has pattern.
- Integration tests for denied vs allowed tenant fixtures.

**Implementation plan:**

1. List endpoints touched by A5–A9 and task filters (A7).
2. Add middleware or service guard; reuse M1 helper.
3. Tests + audit log on denied attempts (optional).

**Related:** M1, A5–A9, P12.

---

### M5

**Requirement:** **Web UI** hides or disables automation entry points (board tab, project settings toggle, assign-to-agent, queue) when `tenantAutomationEligible` is false; show **upgrade / Contact Sales** CTA where appropriate.

**Why:** Consistent with packaging; reduces support confusion.

**Acceptance criteria:**

- Eligible tenants see full flows (behind feature flags if A* not shipped).
- Ineligible tenants never see dead links to automation routes.

**Implementation plan:**

1. Expose read-only `automationEnabled` (or derive client-side from `tenant.plan` + subscription if already in session).
2. Gate routes and nav in `AppShell` / project layout.
3. Copy for “Enterprise feature” tooltip or empty state.

**Related:** M1, M2, A13.

---

### M7

**Requirement:** Global Cmd/Ctrl+K command palette that lets the user jump to any project or board without leaving the keyboard.

**Why:** Tasker-style apps live or die by the fast-path navigation. Pre-this work the palette existed but lacked focus trap, arrow-key navigation, and recent-history; users had to type to find the row they wanted even when they were jumping between two boards.

**Constraints:** No API changes; works on macOS (⌘+K) and Windows/Linux (Ctrl+K); must not conflict with text-input shortcuts.

**Implemented (2026-05-12):**

- Global keybinding (`useEffect` in `AppShell.tsx`) opens the palette with `Ctrl/Cmd+K` from anywhere in the authenticated app.
- `apps/web/src/hooks/useRecentNavigation.ts` (last 8, FIFO, localStorage-backed) records each board visit. `ProjectLayout` pushes the current board into the cache on mount so the palette is useful immediately.
- `CommandPalette` rewrite:
  - `useFocusTrap` so Tab is contained inside the modal.
  - `↑/↓/Home/End` cursor moves the highlighted row; `Enter` opens; `Esc` closes.
  - Grouped sections (Recent · Projects · Boards) with sticky group headers when the query is empty.
  - Active row uses the indigo brand colour + reverse-style hint pill.
  - Footer key-hint legend so the shortcuts are discoverable.
- Recents survive a hard reload (localStorage) but are scoped per browser; storage-event listener keeps multiple open tabs in sync.

**Related:** M8, P8.

---

### M8

**Requirement:** Switch boards inside the project header without leaving the current view, replacing the native `<select>` that triggered a full page reload.

**Why:** Going through a hard navigation lost client-side state (filters, scroll position, draft comments) and broke optimistic updates.

**Implemented (2026-05-12):**

- `apps/web/src/components/project/BoardSwitcher.tsx` is a custom listbox dropdown:
  - Uses `useNavigate` for soft React-Router navigation; component state and query cache survive the swap.
  - `useFocusTrap` while the menu is open.
  - Keyboard: `↑/↓/Home/End` move cursor, `Enter`/`Space` select, `Esc` closes and returns focus to the trigger button.
  - Marks the currently active board with an emerald "Active" badge.
  - Includes an inline **"+ New board…"** action for Admins / Managers that wires to the existing `CreateBoardModal`.
  - Each navigation also pushes the visited board into the Cmd/Ctrl+K recent-navigation cache, so the palette becomes richer the more the user hops.
- `ProjectLayout` no longer has the legacy native `<select>` + duplicate active-name span; layout is denser.

**Related:** M7, P8.

---

### PM1

**Reference:** [ClickUp University: feature map and master implementation plan](#clickup-university-feature-map-and-master-implementation-plan) (topic taxonomy, stages A–H, stage-gate checklist).

**Outcome:** A single north-star document for “MIRAI as PM tool” parity (ClickUp-class project shell), aligned to the Starlink / internal benchmark capture: workspace chrome, project header, views rail, fields, task menus, activity, templates, and onboarding surfaces — with an explicit **MVP boundary** so engineering ships in waves.

**Phased execution order (suggested):**

1. **Phase 1 — Shell + early views UX:** breadcrumb workspace/project, favorite, project ••• actions, **All apps** launcher (`AppLauncherModal`), **+ View** entry with real navigators for List/Board/Calendar and honest “coming soon” for Gantt/Table/Timeline/Docs/Forms; reuse M7/M8 navigation patterns.
2. **Phase 2 — Views persistence:** per-user or per-board saved view configuration (columns, filters, grouping) shared by List/Board where applicable; foundation for PM9.
3. **Phase 3 — Fields (PM3)** then **task context menu (PM4)** in parallel where possible.
4. **Phase 4 — Task detail scheduling + relationships rail (PM5)**; **activity rail (PM6)**.
5. **Phase 5 — Templates lite (PM7), onboarding hub (PM8)**.
6. **Phase 6 — Gantt/Table (PM9)**; **integrations depth (PM11)** with P1/M*; **whiteboards (PM10)** only after spike.

**Verification:** This section + rows PM1–PM11 in `ROADMAP-TODOS.md` stay the checklist; PM2 notes carry dated ship log for incremental delivery.

**Related:** M7, M8, M10, PM2–PM11, P1.

---

### PM2

**Outcome:** Users discover and add project views from a consistent entry point; primary views route correctly; secondary views are visibly queued.

**Implemented (2026-05-14):**

- `AppLauncherModal`, `AddProjectViewModal`, `ProjectHeader` — apps launcher, +View gallery, breadcrumb / favorite / project actions (Phase 1a shell).
- `apps/web/src/hooks/useBoardShellView.ts` — local map `mirai.boardShellViewByBoardId`; `getBoardShellView` / `setBoardShellView`; `boardShellAppPath` / `boardShellRelativePath`; `shellViewFromPathname`; `parseBoardIdFromProjectPath` for robust board id from URL (List/Calendar child routes).
- `apps/web/src/components/project/CustomizeBoardEntryModal.tsx` — “Default board entry” (Board / List / Calendar); focus trap + Esc.
- `ProjectTabs` — **Customize** opens modal when a board is active.
- `ProjectLayout` — syncs shell view from pathname; recent-nav `to` uses `boardShellAppPath`; **route board id** from pathname (replaces strict `useMatch` so multi-board List/Calendar show correct tabs/switcher).
- `apps/web/src/hooks/useViewColumnPrefs.ts` — `mirai.viewColumnPrefs.v1` map keyed by board id; list + board boolean maps; `applySavedViewColumnSnapshot`; labels + `listGridTemplate` / `visibleListColumnKeys` / `prefsDifferFromDefaults`.
- `TaskListPage` — shared toolbar + `matchesFilters` pipeline; dynamic grid/table from `visibleListColumnKeys` + `listGridTemplate`; virtualized rows use same template.

**Next:** Calendar shell column JSON; optional server sync for `viewColumnPrefs`; merge “Customize board entry” with field strip.

**Related:** M10, PM1, PM3, PM9.

---

### PM3

**Outcome:** A ClickUp-style **Fields** control: show/hide list columns and board card fields without leaving the view; respects role capabilities and board `kanbanStages`.

**Constraints:** No breaking API for existing boards; start read-only toggles client-side if needed, then promote to board settings when stable.

**Implemented (2026-05-14):** `FieldsPanel` — right-edge drawer from **Fields** in `BoardToolbar` (board + list shells); two sections (list columns, board card fields) with short hints; status column hint lists current `workflowStages` from the board; checkboxes mirror `useViewColumnPrefs` toggles (still at least one column + one card field); **Reset all to defaults** calls `resetDefaults()` on the hook. `createDefaultViewColumnPrefs()` ensures a fresh object on reset. Toolbar chip rows (PM2) remain for quick edits.

**Later:** WIP hints per column; persist prefs to board settings API; custom-field-driven columns (PM17).

**Related:** T5, T10, PM2.

---

### PM4

**Outcome:** Task row/card **•••** (and keyboard) exposes: copy link, copy public id, duplicate, move to column/board (where API exists), open dependencies — shipped in waves A→D to limit risk.

**Wave A (shipped 2026-05-14):** `apps/web/src/features/tasks/TaskCardContextMenu.tsx` — board cards (`BoardPage` / `SortableTaskCard`) and list rows (`TaskListPage`, including virtualized grid). Actions: Open (sets `?task=<uuid>`), Copy link (absolute URL with current pathname + `task`), Copy task key, Copy task ID; **Duplicate** for Admin/Manager via `POST /boards/:boardId/tasks` with copied title/description/priority/status/tags/estimate/dueDate (fresh metadata; no parent). `BoardPage` and `TaskListPage` derive `TaskDetailPanel` task id from `useSearchParams` so shared links open the inspector.

**Wave B (shipped 2026-05-14):** **Open in new tab** (same deep link); **Move to** — scrollable submenu of workflow columns; calls existing `PATCH /tasks/:id` with `{ status }` (same contract as drag on board). Wired on kanban cards and list rows; errors surface via existing task `PATCH` mutation toasts on `BoardPage` / `TaskListPage`.

**Wave C (shipped 2026-05-14):** When the card/list **⋮** menu opens, **`GET /tasks/:taskId/related`** loads **TaskRelation** peers. Each row: primary click opens the task (same board → `onOpen` / `?task=`; other board → `navigate` with `boardShellAppPath` + `?task=`); **↗** opens that deep link in a new tab. **Blocking dependencies:** if `task.dependencies` is non-empty, **Copy dependency IDs** copies UUID list (blocking graph still edited in inspector). Exported helper **`relatedTaskHref(projectId, boardId, taskId)`** for deep links to another board’s task.

**Related:** P10, PM5.

---

### PM5

**Outcome:** Task detail surfaces start/due, simple dependency/blocker visualization, and deep-links consistent with PM4.

**Implemented (2026-05-14):** **Related work** in `TaskDetailPanel` — loads `GET /tasks/:taskId/related`; lists key, status, title; opens linked task via `/app/projects/:projectId/boards/:boardId?task=` (closes modal). **Link task** (UUID) + remove use `POST /tasks/:taskId/related` and `DELETE …/related/:toTaskId` (same rules as API: Admin/Manager, or Employee on assigned user task). Blocking dependencies remain the existing `dependencies` PATCH field on the edit form.

**Related:** PM4, existing `TaskRelation` / graph services if present.

---

### PM6

**Outcome:** Dedicated activity stream with composer parity to comments (@mentions, attachments policy TBD); layout option: rail vs modal per design tokens.

**Related:** P10, M9.

---

### PM7

**Outcome:** In-app **Templates** entry: Mirai catalog + org-saved templates; “Apply to project” uses existing template/board flows (T14, board templates).

**Implemented (lite 2026-05-14):** `ProjectTemplatesPage` at `/app/projects/:projectId/templates` — lists `GET /board-templates`; links to workspace `/app` to create a project with a template key.

**Related:** T3, T14.

---

### PM8

**Outcome:** Central **Get data in** / onboarding hub linking import (T17), invites, and first-board guidance; linked from launcher and org settings.

**Implemented (lite 2026-05-14):** `ProjectGettingStartedPage` at `/app/projects/:projectId/getting-started`; **Get data in** `NavLink` in `ProjectTabs`. T17 import still opened from board toolbar.

**Related:** T17, PM1.

---

### PM9

**Outcome:** **Gantt** and **Table** as first-class views once PM2 persistence exists; share column metadata with PM3.

**Implemented (table lite 2026-05-14):** Route `boards/:boardId/table` renders `TaskListPage` with forced HTML table (no virtualizer); project tabs + **+ View** modal entry. **Gantt:** still planned — timeline engine + T16b.

**Related:** PM2, PM3, T16b (board performance).

---

### PM10

**Outcome:** Decision record + optional spike for whiteboards / canvas; product may defer or partner/embed.

**Related:** PM1.

---

### PM11

**Outcome:** Deeper integrations (webhooks, inbound email, third-party connectors) and automation UX aligned with tenant plan and M4/M5 enforcement.

**Related:** P1, M1–M5, A-series.

---

### PM12

**Outcome:** Native or integrated **time tracking**: log time on tasks, timesheet review, optional approval chain, exports — aligned to University “Efficient time tracking” paths.

**Implementation plan:** (0) Product pick: first-party vs integration (Harvest/Toggl/Jira worklog). (1) Data model: `time_entries` (tenantId, userId, taskId, minutes, note, startedAt) + RLS by membership. (2) API: CRUD + list by task + period; manager approve if enabled in tenant settings. (3) Web: inline timer + manual entry on TaskDetail; summary row on board cards optional. (4) Billing: plan matrix row for caps.

**Related:** PM5, P1.

---

### PM13

**Outcome:** **Collaborative Docs / Wiki** (structured pages, permissions, @mentions, embed tasks, discoverable search) per University Docs + Wiki courses.

**Implementation plan:** (1) Doc entity (project-scoped or tenant-scoped) with revision history. (2) Realtime or lock-based edit MVP. (3) Link from project header / launcher; search index (future tie to PM21). (4) Convert selection → task (later).

**Related:** PM8, PM21.

---

### PM14

**Outcome:** **Forms builder** (drag fields, validation, branding), routing rules, response storage — beyond today’s **public intake** (`intakePublic` + `PublicIntakePage`) which is a thin fixed-field flow.

**Implementation plan:** (1) Inventory current intake settings on `Project`. (2) Form definition JSON + publish URL per form. (3) Admin builder UI; map answers to task custom fields / description. (4) Spam/abuse: rate limits (reuse P12 patterns), captcha.

**Related:** T17 (import is sibling “get data in” lane), PM8.

---

### PM15

**Outcome:** **Dashboards**: configurable widgets (tasks by status, burn slice, assignee load) scoped to selected projects/boards — University dashboards / reporting themes.

**Implementation plan:** (1) `dashboard` entity per user or shared link. (2) Widget types v1: task counts, recent activity, SLA at risk. (3) Query batching to avoid N+1; cache TTL. (4) Role checks on each widget’s project scope.

**Related:** PM9, T6, T7.

---

### PM16

**Outcome:** **Team Chat** (channels, DMs, threads, optional “location-based” context links) per University Chat paths — largest greenfield; consider **bridge** (Slack/Teams) before full native.

**Implementation plan:** (0) ADR: native vs bridge vs defer. (1) If native: message store, presence, notifications (P1), search. (2) Deep link to tasks/boards. (3) Mobile-friendly layout pass.

**Related:** PM6, P1, T9.

---

### PM17

**Outcome:** **Custom fields platform**: define field types per project/board, required rules, optional “field manager” admin UX — beyond **PM3** visibility (University custom fields + manager courses).

**Implementation plan:** (1) Extend existing `customFields` / `validateTaskMetadata` patterns in API. (2) UI for create/rename/archive fields. (3) Rollups/formulas later phase.

**Related:** PM3, T14.

---

### PM18

**Outcome:** **Sprints / agile**: sprint container, dates, commitment set, burndown-lite, integration with List/Board filters — University software-teams + sprint planning series.

**Implementation plan:** (1) Sprint metadata on board or parallel entity. (2) Filter tasks by sprintId; board template “Sprint board”. (3) Optional velocity chart when history exists.

**Related:** PM9, PM2.

---

### PM19

**Outcome:** **ClickApps-style modules**: tenant-level toggles enabling optional behaviors (time tracking, sprints, automations) without shipping dead UI — “Enable and optimize Space ClickApps” analogue.

**Implementation plan:** (1) `tenant.settings.modules` or feature flags table. (2) Server enforcement: reject API if module off. (3) Admin settings UI grouped by module.

**Related:** M1–M5, PM11.

---

### PM20

**Outcome:** **Home / Inbox / Planner** hub: cross-project “what’s on me”, snooze, weekly plan surface — University Home, Planner, “My Tasks” paths (MIRAI: augment **T11** My work + **M7** navigation).

**Implementation plan:** (1) IA pass: single `/home` or enhance existing landing. (2) Planner = calendar + drag blocks (optional). (3) Notification triage inbox (ties T9).

**Related:** M7, T11, T9.

---

### PM21

**Outcome:** **Workspace AI UX** (knowledge Q&A over tasks/docs, writing assist, “project manager” nudges) aligned to University Brain + Agents paths — **gated** on **A\*** pipeline and **M4/M5** eligibility.

**Implementation plan:** (1) No UI until A9+ contract stable. (2) Read-only suggestive features first. (3) Audit log every AI-assisted write. (4) Privacy: tenant opt-in, data retention.

**Related:** A1–A15, M4, M5, PM13.

---

### PM22

**Outcome:** **Goals / OKRs / portfolio** rollups and capacity-style planning — University capacity planning + goal-oriented reporting (lighter than full financial portfolio).

**Implementation plan:** (1) Goal entity linking to tasks/projects. (2) Progress % from child tasks. (3) Optional capacity view when PM12 exists.

**Related:** PM12, PM15, PM18.