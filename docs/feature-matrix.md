# MIRAI Tasker Feature Matrix

Audience: packaging and go-to-market decisions for Free / Standard / Pro / Enterprise.

Positioning target: mid-market growth (strong team value in Standard, operational depth in Pro, governance and scale in Enterprise).

## Tier intent

- Free: trial and small-team starter value.
- Standard: team collaboration baseline for SMBs.
- Pro: operational scale, automation, and process rigor.
- Enterprise: governance, compliance posture, and large-scale controls.

## Feature matrix

| Feature area | Feature | Free | Standard | Pro | Enterprise | Notes |
|---|---|---|---|---|---|---|
| Core work management | Projects, boards, tasks | Yes | Yes | Yes | Yes | Current |
| Core work management | Kanban + list views | Yes | Yes | Yes | Yes | Current |
| Core work management | Week calendar view | No | Yes | Yes | Yes | Current |
| Core work management | Custom board columns (`kanbanStages`) | No | Yes | Yes | Yes | Current |
| Core work management | Column resize (`columnWidths`) | No | Yes | Yes | Yes | Current |
| Core work management | Advanced board personalization | No | Yes | Yes | Yes | Current; includes workflow-stage editing |
| Collaboration | Roles (Admin/Manager/Employee) | No | Yes | Yes | Yes | Current |
| Collaboration | Invite links with accept URL | No | Yes | Yes | Yes | Current |
| Collaboration | Revoke/regenerate invites | No | Yes | Yes | Yes | Current |
| Collaboration | Task comments | No | Yes | Yes | Yes | Current |
| Collaboration | @mention notifications | No | Yes | Yes | Yes | Current |
| Notifications | In-app bell + unread count | No | Yes | Yes | Yes | Current |
| Notifications | Notification preferences + quiet hours (UTC) | No | Yes | Yes | Yes | Current |
| Templates | Built-in board templates | Limited | Yes | Yes | Yes | Current; Free includes starter subset |
| Templates | Org custom templates (JSON) | No | No | Yes | Yes | Current |
| Templates | Save board as org template | No | No | Yes | Yes | Current |
| SLA and ops | SLA defaults by priority (org/project) | No | No | Yes | Yes | Current |
| SLA and ops | Reminder engine (due/overdue/tomorrow + SLA events) | No | No | Yes | Yes | Current |
| SLA and ops | Recurring tasks (per board) | No | No | Yes | Yes | Current |
| SLA and ops | My Work (cross-board queue + sorting) | No | No | Yes | Yes | Current |
| Audit and reporting | Task activity timeline | No | No | Yes | Yes | Current |
| Integrations | Project webhooks (existing outbound task events) | No | No | Yes | Yes | Current |
| Integrations | Notification delivery via email/webhook channels | No | No | Planned | Planned | Roadmap P1 |
| Performance and UX | Full Kanban virtualization with DnD | No | No | Planned | Planned | Roadmap P1 (currently partial) |
| Accessibility and quality | Full modal focus trap coverage | No | Planned | Planned | Planned | Roadmap P2 quality baseline |
| Governance and security | Compliance bundle and legal-hold workflows | No | No | Optional | Yes | Current enterprise/ITSM posture |
| Governance and security | Advanced abuse/rate controls | No | No | Planned | Planned+ | Roadmap P3, stronger at Enterprise |

## Limits and support SLA

| Plan | Users | Projects | Task volume | Templates | Support |
|---|---:|---:|---:|---|---|
| Free | Up to 3 | Up to 2 | Up to 200 total tasks | Starter built-ins only | Community/self-serve |
| Standard | Up to 25 | Up to 20 | Up to 20,000 tasks | Full built-in catalog | Email support, best-effort next business day |
| Pro | 100 included (expandable) | Up to 100 | Up to 200,000 tasks | Built-ins + org custom templates | Priority support, 8x5 SLA target |
| Enterprise | Contractual | Contractual | Contractual | Full + governance controls | Dedicated channel, custom SLA |

## Current vs planned summary

- Current focus by tier:
  - Free: basic tasking and board usage with strict limits.
  - Standard: collaboration layer (invites, comments, mentions, notifications, custom columns).
  - Pro: operations layer (recurring, reminders, SLA policy, My Work, org templates, webhooks).
  - Enterprise: governance/compliance depth and contractual scale.
- Planned upgrades:
  - P1: full Kanban virtualization + DnD, richer notification delivery channels.
  - P2: deeper E2E reliability and broader accessibility hardening.
  - P3: improved mention resolution, timezone-aware quiet hours, stronger abuse/rate controls.

## Packaging guidance

- Keep Standard attractive for team adoption and conversion.
- Use Pro as the operational unlock tier for automation and standardized process controls.
- Reserve Enterprise differentiation for governance, compliance, and contractual assurance.
