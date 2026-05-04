/** Fixed PRD column order (enterprise extension may override per-project via `project.settings.kanbanStages`). */
export const DEFAULT_KANBAN_STATUSES = [
  'Backlog',
  'Ready for Planning',
  'In Planning',
  'Ready for Development',
  'In Progress',
  'In Review',
  'Testing',
  'Done',
  'Escalation',
] as const;

export type KanbanStatus = (typeof DEFAULT_KANBAN_STATUSES)[number];

export const EXTRA_TASK_STATUSES = ['Blocked', 'Waiting'] as const;

export const ALL_TASK_STATUSES = [...DEFAULT_KANBAN_STATUSES, ...EXTRA_TASK_STATUSES] as const;

export function isKanbanStatus(s: string): s is KanbanStatus {
  return (DEFAULT_KANBAN_STATUSES as readonly string[]).includes(s);
}

export function isValidTaskStatus(s: string): boolean {
  return (ALL_TASK_STATUSES as readonly string[]).includes(s);
}

export const SLA_PAUSE_STATUSES = ['Blocked', 'Waiting'] as const;
