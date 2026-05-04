import { DEFAULT_KANBAN_STATUSES } from '../constants/kanban';
import type { Board } from '../models/Board';
import type { Project } from '../models/Project';
import { allowedStatusTransition } from './slaService';

/** System columns that exist outside the board template but participate in transitions. */
export const WORKFLOW_SYSTEM_STATUSES = ['Blocked', 'Waiting'] as const;

const SLA_ESCALATION = 'Escalation';

/**
 * Resolved ordered stage names for a board (board overrides project overrides default PRD columns).
 */
export function resolveWorkflowStageNames(board: Board | null, project: Project | null): string[] {
  const fromBoard = board?.settings?.kanbanStages;
  if (Array.isArray(fromBoard) && fromBoard.length >= 2) {
    return fromBoard.map((s) => String(s));
  }
  const fromProject = project?.settings?.kanbanStages;
  if (Array.isArray(fromProject) && fromProject.length >= 2) {
    return fromProject.map((s) => String(s));
  }
  return [...DEFAULT_KANBAN_STATUSES];
}

/**
 * Stage list used for adjacency transitions: core workflow + Escalation (SLA) if missing.
 */
export function transitionStageList(resolvedCore: readonly string[]): string[] {
  const out = [...resolvedCore];
  if (!out.includes(SLA_ESCALATION)) out.push(SLA_ESCALATION);
  return out;
}

export function isValidStatusForWorkflow(status: string, resolvedCore: readonly string[]): boolean {
  const allowed = new Set<string>([...resolvedCore, ...WORKFLOW_SYSTEM_STATUSES, SLA_ESCALATION]);
  return allowed.has(status);
}

export function isAllowedWorkflowTransition(
  from: string,
  to: string,
  resolvedCore: readonly string[]
): boolean {
  return allowedStatusTransition(from, to, transitionStageList(resolvedCore));
}
