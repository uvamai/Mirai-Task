import type { TaskPriority } from '../types/task';

const MS_DAY = 86400_000;

/** Product default: calendar days per priority (configurable per project). */
export const DEFAULT_SLA_DAYS: Record<TaskPriority, number> = {
  P0: 1,
  P1: 2,
  P2: 3,
  P3: 5,
  P4: 7,
};

export type SlaStartPolicy = 'on_in_progress' | 'on_create' | 'on_first_leave_backlog';

export type ResolvedSlaPolicy = {
  daysByPriority: Record<TaskPriority, number>;
  slaStartPolicy: SlaStartPolicy;
};

function clampDays(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v < 1 || v > 90) return fallback;
  return Math.floor(v);
}

/** Reads `project.settings.slaDaysByPriority` and `slaStartPolicy`. */
export function resolveSlaPolicy(settings: Record<string, unknown> | null | undefined): ResolvedSlaPolicy {
  const raw = (settings?.slaDaysByPriority ?? {}) as Record<string, unknown>;
  const daysByPriority: Record<TaskPriority, number> = {
    P0: clampDays(raw.P0, DEFAULT_SLA_DAYS.P0),
    P1: clampDays(raw.P1, DEFAULT_SLA_DAYS.P1),
    P2: clampDays(raw.P2, DEFAULT_SLA_DAYS.P2),
    P3: clampDays(raw.P3, DEFAULT_SLA_DAYS.P3),
    P4: clampDays(raw.P4, DEFAULT_SLA_DAYS.P4),
  };
  const pol = settings?.slaStartPolicy;
  const slaStartPolicy: SlaStartPolicy =
    pol === 'on_create' || pol === 'on_first_leave_backlog' || pol === 'on_in_progress' ? pol : 'on_in_progress';
  return { daysByPriority, slaStartPolicy };
}

export function slaDurationMsForPolicy(priority: TaskPriority, policy: ResolvedSlaPolicy): number {
  const days = daysForPriority(priority, policy);
  return days * MS_DAY;
}

export function daysForPriority(priority: TaskPriority, policy: ResolvedSlaPolicy): number {
  return policy.daysByPriority[priority] ?? DEFAULT_SLA_DAYS[priority];
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWeekendLocal(d: Date): boolean {
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

/** When `slaUseBusinessDays` is true, each SLA "day" is one Mon–Fri (excluding `slaHolidayCalendar` YYYY-MM-DD). */
export function addSlaSpanFromStart(
  startedAt: Date,
  spanDays: number,
  projectSettings?: Record<string, unknown> | null
): Date {
  const ps = projectSettings ?? {};
  const useBiz = ps.slaUseBusinessDays === true;
  const holidaySet = new Set(
    (Array.isArray(ps.slaHolidayCalendar) ? ps.slaHolidayCalendar : [])
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.slice(0, 10))
  );
  if (!useBiz) {
    return new Date(startedAt.getTime() + spanDays * MS_DAY);
  }
  const d = new Date(startedAt.getTime());
  let remaining = Math.max(0, Math.floor(spanDays));
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (isWeekendLocal(d) || holidaySet.has(ymdLocal(d))) continue;
    remaining -= 1;
  }
  return d;
}

export function computeSlaDeadlineFromPolicy(
  startedAt: Date,
  priority: TaskPriority,
  policy: ResolvedSlaPolicy,
  projectSettings?: Record<string, unknown> | null
): Date {
  const span = daysForPriority(priority, policy);
  return addSlaSpanFromStart(startedAt, span, projectSettings);
}

/** First workflow column (used as "backlog" for on_first_leave_backlog). */
export function firstWorkflowStage(stages: readonly string[]): string | null {
  const core = stages.filter((s) => s !== 'Blocked' && s !== 'Waiting' && s !== 'Escalation');
  return core[0] ?? null;
}

export function shouldStartSlaOnCreate(policy: ResolvedSlaPolicy): boolean {
  return policy.slaStartPolicy === 'on_create';
}

export function shouldStartSlaOnEnterInProgress(policy: ResolvedSlaPolicy, newStatus: string): boolean {
  return policy.slaStartPolicy === 'on_in_progress' && newStatus === 'In Progress';
}

export function shouldStartSlaOnLeaveFirstStage(
  policy: ResolvedSlaPolicy,
  prevStatus: string,
  newStatus: string,
  stages: readonly string[]
): boolean {
  if (policy.slaStartPolicy !== 'on_first_leave_backlog') return false;
  const first = firstWorkflowStage(stages);
  if (!first) return false;
  if (prevStatus !== first) return false;
  if (newStatus === prevStatus) return false;
  if (newStatus === 'Blocked' || newStatus === 'Waiting') return false;
  return true;
}
