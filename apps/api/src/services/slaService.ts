import type { Transaction } from 'sequelize';
import type { Task } from '../models/Task';
import { ALL_TASK_STATUSES } from '../constants/kanban';
import type { TaskPriority } from '../types/task';
import {
  computeSlaDeadlineFromPolicy,
  resolveSlaPolicy,
  slaDurationMsForPolicy,
} from './slaPolicy';

export type { TaskPriority } from '../types/task';

const MS_DAY = 86400_000;

/** Default tenant-wide SLA curve (calendar days); per-project overrides in `resolveSlaPolicy`. */
export function slaDurationMs(priority: TaskPriority, _timezone?: string): number {
  return slaDurationMsForPolicy(priority, resolveSlaPolicy({}));
}

/** @deprecated Prefer slaPolicy helpers with project settings; kept for callers that only gate on column name. */
export function shouldStartSlaClock(status: string): boolean {
  return status === 'In Progress';
}

export function isSlaPausedStatus(status: string): boolean {
  return status === 'Blocked' || status === 'Waiting';
}

export function computeSlaDeadline(startedAt: Date, priority: TaskPriority): Date {
  return computeSlaDeadlineFromPolicy(startedAt, priority, resolveSlaPolicy({}));
}

export function mergeSlaState(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...existing, ...patch };
}

export function allowedStatusTransition(
  from: string,
  to: string,
  stages: readonly string[] = ALL_TASK_STATUSES as unknown as readonly string[]
): boolean {
  if (from === to) return true;
  if (to === 'Blocked' || to === 'Waiting' || from === 'Blocked' || from === 'Waiting') return true;
  const core = stages.filter((s) => s !== 'Blocked' && s !== 'Waiting');
  const fi = core.indexOf(from);
  const ti = core.indexOf(to);
  if (fi === -1 || ti === -1) return true;
  return Math.abs(ti - fi) <= 1 || to === 'Escalation';
}

export function taskToSnapshot(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    status: task.status,
    priority: task.priority,
    assigneeType: task.assigneeType,
    assigneeId: task.assigneeId,
    slaDeadline: task.slaDeadline,
    slaState: task.slaState,
    resolution: task.resolution ?? null,
    dueDate: task.dueDate ?? null,
    dependencies: task.dependencies,
  };
}

export type SlaTickResult = { taskId: string; event: 'warning' | 'soft_breach' | 'escalation' };

const GRACE_MS = MS_DAY;

export function evaluateSlaTick(task: Task, now: Date): SlaTickResult | null {
  if (!task.slaDeadline) return null;
  const state = (task.slaState || {}) as Record<string, unknown>;
  if (state.paused === true) return null;
  const deadline = new Date(task.slaDeadline).getTime();
  const startMs = task.createdAt.getTime();
  const total = Math.max(deadline - startMs, 1);
  const remaining = deadline - now.getTime();
  const ratio = remaining / total;
  if (ratio <= 0.2 && ratio > 0 && !state.warningSent) {
    return { taskId: task.id, event: 'warning' };
  }
  if (now.getTime() > deadline + GRACE_MS && !state.hardBreach) {
    return { taskId: task.id, event: 'escalation' };
  }
  if (now.getTime() > deadline && !state.softBreach) {
    return { taskId: task.id, event: 'soft_breach' };
  }
  return null;
}

export async function applySlaEvent(
  task: Task,
  event: SlaTickResult['event'],
  t?: Transaction
): Promise<void> {
  const state = { ...(task.slaState as Record<string, unknown>) };
  if (event === 'warning') {
    state.warningSent = true;
  } else if (event === 'soft_breach') {
    state.softBreach = true;
  } else if (event === 'escalation') {
    state.hardBreach = true;
    await task.update({ status: 'Escalation', slaState: state }, { transaction: t });
    return;
  }
  await task.update({ slaState: state as Record<string, unknown> }, { transaction: t });
}
