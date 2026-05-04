# MIRAI Tasker — TODO log

Last updated: 2026-05-03

## Completed — backlog T1–T16 (and related)

| ID | Item | Notes |
|----|------|--------|
| T1 | Sharable invite links (per role) | `POST /invitations` returns `acceptUrl`; Team page copy link |
| T2 | Revoke / regenerate invite | `DELETE /invitations/:id`, `POST /invitations/:id/rotate` |
| T3 | Business & finance board template | `business_finance` in `boardTemplates.json` |
| T4 | Recurring tasks | `recurring_task_rules`, worker tick, board UI |
| T5 | Configurable board columns | “Edit columns” on board → `kanbanStages` |
| T6 | Org SLA defaults (days by priority) | Organization settings P0–P4 + existing project/ITSM SLA UIs |
| T7 | Reminder engine | Worker: due overdue/today/tomorrow; SLA events → notifications |
| T8 | Notification preferences | Profile: due, mentions, quiet hours (UTC) |
| T9 | Notification bell + API | `GET/PATCH/POST` notifications; AppShell bell |
| T10 | Column width resize | Board edge drag → `columnWidths` in board settings |
| T11 | My work (cross-board) | `GET /tasks/my-work`, sort by due/project/priority |
| T12 | @mention → notification | Comment handles → `UserNotification` |
| T13 | E2E (baseline) | `smoke.spec.ts`, `login-page.spec.ts`, `app-flows.spec.ts` (auth when `E2E_*` set) |
| T14 | Tenant custom templates | JSON in org settings + **Save as org template** on board (admin) |
| T15 | Accessibility (targeted) | Skip link, main landmark, column modal focus/Escape, nav `aria-label` |
| T16 | Virtualization (partial) | Task list view virtualized when &gt;48 rows; board uses scrollable columns (DnD-safe) |

## Remaining / suggested follow-ups

| Priority | Item | Why |
|----------|------|-----|
| P1 | **Kanban + DnD + true card virtualization** | T16 full: needs dnd-kit + virtual list integration or hybrid UX |
| P1 | **Email / webhook delivery** for notifications | Prefs only cover in-app today |
| P2 | **E2E**: invite flow, create project from template, board drag (seeded data + stable selectors) | T13 depth |
| P2 | **Focus trap** on all modals (create task, detail panel, notifications on mobile) | Broader than column editor |
| P2 | **Recurring tasks “across boards”** | Rules are per-board; multi-board rules need product design + schema |
| P3 | **Mention resolution** beyond email local-part (display name, handles) | Reduce ambiguity |
| P3 | **Quiet hours timezone** | Currently UTC in API; optional user TZ in preferences |
| P3 | **Rate limits / abuse** on template save & notification fanout | Ops hardening |

## Ops reminders

- Run DB migrations after pull: `npm run migrate -w @mirai/api` (or rely on API Docker `CMD` migrations).
- Optional Playwright auth: `E2E_EMAIL`, `E2E_PASSWORD` with API reachable from preview/proxy.
