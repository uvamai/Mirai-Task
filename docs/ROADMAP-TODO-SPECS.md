# Roadmap item specifications

This file is merged into **task descriptions** on Roadmap boards by `scripts/seed-roadmap-tasks.mjs` (see `## Item specifications` below). Keep **###** headings aligned with the **ID** column in [ROADMAP-TODOS.md](ROADMAP-TODOS.md) (T*, P*, A*, **M*** on Product improvement).

**Status labels** on cards follow the table: **Done** → column **Done**; **Open** / **Not started** → **Backlog** by default.

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
