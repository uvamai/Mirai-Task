import type { TaskPriority } from '../types/task';
import { Board, Project, Task, Tenant } from '../models';
import { nextTaskKey } from './taskKeys';
import {
  computeSlaDeadlineFromPolicy,
  resolveSlaPolicy,
  shouldStartSlaOnCreate,
  shouldStartSlaOnEnterInProgress,
} from './slaPolicy';
import { resolveEstimateMode } from './estimateMode';
import { emitBoardTasksUpdated } from '../realtime/socket';

export async function createSystemBoardTask(input: {
  tenantId: string;
  projectId: string;
  boardId: string;
  title: string;
  status: string;
  priority: TaskPriority;
  createdByUserId: string | null;
  assigneeUserId?: string | null;
}): Promise<Task> {
  const board = await Board.findOne({ where: { id: input.boardId, tenantId: input.tenantId } });
  const project = await Project.findOne({ where: { id: input.projectId, tenantId: input.tenantId } });
  const tenant = await Tenant.findByPk(input.tenantId);
  if (!board || !project || !tenant) {
    throw new Error('Board/project/tenant missing');
  }
  const key = await nextTaskKey(input.tenantId);
  const slaPol = resolveSlaPolicy(project.settings);
  let slaDeadline: Date | null = null;
  let slaState: Record<string, unknown> = {};
  const startedCreate = new Date();
  const projSettings = project.settings as Record<string, unknown> | undefined;
  if (shouldStartSlaOnCreate(slaPol)) {
    slaDeadline = computeSlaDeadlineFromPolicy(startedCreate, input.priority, slaPol, projSettings);
    slaState = { startedAt: startedCreate.toISOString() };
  } else if (shouldStartSlaOnEnterInProgress(slaPol, input.status)) {
    slaDeadline = computeSlaDeadlineFromPolicy(startedCreate, input.priority, slaPol, projSettings);
    slaState = { startedAt: startedCreate.toISOString() };
  }
  const mode = resolveEstimateMode(board, project, tenant);
  const task = await Task.create({
    tenantId: input.tenantId,
    projectId: input.projectId,
    boardId: input.boardId,
    key,
    title: input.title,
    description: null,
    priority: input.priority,
    status: input.status,
    assigneeType: input.assigneeUserId ? 'user' : null,
    assigneeId: input.assigneeUserId ?? null,
    createdBy: input.createdByUserId,
    slaDeadline,
    slaState,
    tags: [],
    estimate: null,
    position: Date.now(),
    resolution: null,
    dueDate: null,
    metadata: { createdFromRecurring: true },
    parentTaskId: null,
  });
  void mode;
  emitBoardTasksUpdated(input.tenantId, input.boardId, input.projectId);
  return task;
}
