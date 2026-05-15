# MIRAI Tasker Feature Matrix

Audience: packaging and go-to-market decisions for Free / Standard / Pro / Enterprise.

Positioning target: mid-market growth (strong team value in Standard, operational depth in Pro, governance and scale in Enterprise).

## Tier intent

- Free: trial and small-team starter value.
- Standard: team collaboration baseline for SMBs.
- Pro: operational scale, **schedule-based recurring tasks**, SLA, and process rigor (not the AI automation board).
- Enterprise: governance, compliance posture, large-scale controls, and **AI/automation board** on subscription.

## Feature matrix

| Feature area | Feature | Free | Standard | Pro | Enterprise | Notes |
|---|---|---|---|---|---|---|
| Core work management | Projects, boards, tasks | Yes | Yes | Yes | Yes | Current |
| Core work management | Kanban + list views | Yes | Yes | Yes | Yes | Current |
| Core work management | Week calendar view | No | Yes | Yes | Yes | Current |
| Core work management | Custom board columns (`kanbanStages`) | No | Yes | Yes | Yes | Current |
| Core work management | Column resize (`columnWidths`) | No | Yes | Yes | Yes | Current |
| Core work management | Advanced board personalization | No | Yes | Yes | Yes | Current; includes workflow-stage editing |
| Core work management | Excel/CSV import → new board with dynamic column mapping | Yes | Yes | Yes | Yes | Current (T17); plan-tiered row + rate caps below |
| Collaboration | Roles (Admin/Manager/Employee) | No | Yes | Yes | Yes | Current |
| Collaboration | Invite links with accept URL | No | Yes | Yes | Yes | Current |
| Collaboration | Revoke/regenerate invites | No | Yes | Yes | Yes | Current |
| Collaboration | Task comments | No | Yes | Yes | Yes | Current |
| Collaboration | @mention notifications | No | Yes | Yes | Yes | Current |
| Notifications | In-app bell + unread count | No | Yes | Yes | Yes | Current |
| Notifications | Notification preferences + quiet hours (user IANA timezone) | No | Yes | Yes | Yes | Current; `preferences.notifications.quietHoursTimezone` |
| Templates | Built-in board templates | Limited | Yes | Yes | Yes | Current; Free includes starter subset |
| Templates | Org custom templates (JSON) | No | No | Yes | Yes | Current |
| Templates | Save board as org template | No | No | Yes | Yes | Current |
| SLA and ops | SLA defaults by priority (org/project) | No | No | Yes | Yes | Current |
| SLA and ops | Reminder engine (due/overdue/tomorrow + SLA events) | No | No | Yes | Yes | Current |
| SLA and ops | Recurring tasks (per board) | No | No | Yes | Yes | Current |
| SLA and ops | My Work (cross-board queue + sorting) | No | No | Yes | Yes | Current |
| AI and automation | Dedicated automation board + agent mirror tasks | No | No | No | Yes | **Enterprise + active subscription**; roadmap A5–A8, M1–M5 |
| AI and automation | Assign-to-agent → automation board + review queue | No | No | No | Yes | Roadmap A6, A13; gated M4–M5 |
| AI and automation | Approve & Execute (sole execution gate) | No | No | No | Yes | Roadmap A9 |
| AI and automation | `automation_jobs` worker + runner integration | No | No | No | Yes | Roadmap A1–A4, A12 |
| Audit and reporting | Task activity timeline | No | No | Yes | Yes | Current |
| Integrations | Project webhooks (existing outbound task events) | No | No | Yes | Yes | Current |
| Integrations | Notification delivery via email/webhook channels | No | No | Planned | Planned | Roadmap P1 |
| Integrations | Transactional email for invitations (SMTP/provider) | No | No | Planned | Planned | Roadmap P13 |
| Performance and UX | Full Kanban virtualization with DnD | No | No | Planned | Planned | Roadmap T16b (see ROADMAP-TODO-SPECS) |
| Accessibility and quality | Full modal focus trap coverage | No | Planned | Planned | Planned | Roadmap P8 |
| Identity | SAML SP-initiated enterprise SSO | No | No | Optional | Yes | Roadmap P14 (scaffold: `/auth/sso/status`) |
| Governance and security | Compliance bundle and legal-hold workflows | No | No | Optional | Yes | Current enterprise/ITSM posture |
| Governance and security | Advanced abuse/rate controls | No | No | Planned | Planned+ | Roadmap P12, stronger at Enterprise |

## Limits and support SLA

| Plan | Users | Projects | Task volume | Templates | Excel import (rows / hour) | Support |
|---|---:|---:|---:|---|---|---|
| Free | Up to 3 | Up to 2 | Up to 200 total tasks | Starter built-ins only | 200 rows / 2 imports per hour | Community/self-serve |
| Standard | Up to 25 | Up to 20 | Up to 20,000 tasks | Full built-in catalog | 5,000 rows / 10 imports per hour | Email support, best-effort next business day |
| Pro | 100 included (expandable) | Up to 100 | Up to 200,000 tasks | Built-ins + org custom templates | 50,000 rows / 30 imports per hour | Priority support, 8x5 SLA target |
| Enterprise | Contractual | Contractual | Contractual | Full + governance controls | Unlimited (contractual) | Dedicated channel, custom SLA |

Imported boards count toward each plan's per-project board cap (Free=3, Standard=10, Pro=25, Enterprise=unlimited).

## Current vs planned summary

- Current focus by tier:
  - Free: basic tasking and board usage with strict limits.
  - Standard: collaboration layer (invites, comments, mentions, notifications, custom columns).
  - Pro: operations layer (recurring, reminders, SLA policy, My Work, org templates, webhooks).
  - Enterprise: governance/compliance depth, contractual scale, and AI/automation board (active subscription).
- Planned upgrades:
  - T16b / P2: full Kanban virtualization + DnD; deeper E2E reliability.
  - P1 / P13: richer notification delivery + invitation email.
  - P8 / P10 / P11 / P12: accessibility, mention display, timezone quiet hours, rate limits.
  - P14: enterprise SAML SSO beyond readiness probe.

## Packaging guidance

- Keep Standard attractive for team adoption and conversion.
- Use Pro as the operational unlock tier for automation and standardized process controls.
- Reserve Enterprise differentiation for governance, compliance, and contractual assurance.
