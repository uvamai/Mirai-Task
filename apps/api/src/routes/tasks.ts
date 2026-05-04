import { Router } from 'express';
import { Op } from 'sequelize';
import {
  ActivityLog,
  Board,
  Project,
  Reassignment,
  Task,
  TaskComment,
  Tenant,
  TenantMembership,
  User,
} from '../models';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import {
  assignTaskSchema,
  createTaskSchema,
  patchTaskSchema,
  reassignTaskSchema,
  slaReasonSchema,
  taskCommentBodySchema,
  taskCsatSchema,
} from '../validation/tasks';
import { logActivity } from '../services/auditService';
import { nextTaskKey } from '../services/taskKeys';
import {
  isSlaPausedStatus,
  mergeSlaState,
  taskToSnapshot,
} from '../services/slaService';
import {
  computeSlaDeadlineFromPolicy,
  resolveSlaPolicy,
  shouldStartSlaOnCreate,
  shouldStartSlaOnEnterInProgress,
  shouldStartSlaOnLeaveFirstStage,
} from '../services/slaPolicy';
import type { TaskPriority } from '../types/task';
import {
  isAllowedWorkflowTransition,
  isValidStatusForWorkflow,
  resolveWorkflowStageNames,
} from '../services/workflowService';
import { dependencyAdditionCreatesCycle } from '../services/dependencyGraph';
import { parseCustomFieldDefs, validateTaskMetadata } from '../services/customFields';
import { runAutomationsAfterTaskUpdate } from '../services/automationEngine';
import { fireProjectWebhooks } from '../services/outboundWebhook';
import { emitBoardTasksUpdated } from '../realtime/socket';
import { assertProjectMemberAccess, listAccessibleProjectIds, ProjectAccessError } from '../services/projectAccess';
import { estimateUnitLabel, resolveEstimateMode, validateEstimateValue } from '../services/estimateMode';
import { assertValidParentTask } from '../services/taskParentage';
import { extractMentionsFromBody } from '../services/commentMentions';
import { createUserNotification } from '../services/notificationService';
import { resolveMentionHandlesToUserIds } from '../services/mentionUsers';
import { mentionsEnabled } from '../services/notificationPrefs';

export const tasksRouter = Router();

function canSetP0(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'MANAGER';
}

async function loadBoardContext(boardId: string, tenantId: string) {
  const board = await Board.findOne({ where: { id: boardId, tenantId } });
  if (!board) return null;
  const project = await Project.findOne({ where: { id: board.projectId, tenantId } });
  if (!project) return null;
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) return null;
  return { board, project, tenant };
}

tasksRouter.get('/tasks/my-work', authenticateJwt, loadMembership, async (req, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  const scoped = await listAccessibleProjectIds(req.tenantId, req.userId, req.membership?.role);
  if (scoped !== null && scoped.length === 0) {
    res.json({ tasks: [] });
    return;
  }
  const rows = await Task.findAll({
    where: {
      tenantId: req.tenantId,
      assigneeType: 'user',
      assigneeId: req.userId,
      status: { [Op.ne]: 'Done' },
      ...(scoped !== null ? { projectId: { [Op.in]: scoped } } : {}),
    },
    include: [{ model: Project, attributes: ['id', 'name'] }],
    order: [
      ['dueDate', 'ASC'],
      ['priority', 'ASC'],
    ],
    limit: 200,
  });
  res.json({
    tasks: rows.map((t) => {
      const p = (t as unknown as { Project?: Project }).Project;
      return {
        id: t.id,
        key: t.key,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        projectId: t.projectId,
        boardId: t.boardId,
        projectName: p?.name ?? '',
      };
    }),
  });
});

tasksRouter.get('/boards/:boardId/tasks', authenticateJwt, loadMembership, async (req, res) => {
  const ctx = await loadBoardContext(req.params.boardId, req.tenantId!);
  if (!ctx) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }
  try {
    await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, ctx.project.id);
  } catch (e) {
    if (e instanceof ProjectAccessError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
  const mode = resolveEstimateMode(ctx.board, ctx.project, ctx.tenant);
  const workflowStages = resolveWorkflowStageNames(ctx.board, ctx.project);
  const rows = await Task.findAll({
    where: { tenantId: req.tenantId!, boardId: ctx.board.id },
    order: [
      ['status', 'ASC'],
      ['position', 'ASC'],
    ],
  });
  res.json({
    tasks: rows.map((t) => ({
      id: t.id,
      key: t.key,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assigneeType: t.assigneeType,
      assigneeId: t.assigneeId,
      slaDeadline: t.slaDeadline,
      slaState: t.slaState,
      tags: t.tags,
      estimate: t.estimate != null ? Number(t.estimate) : null,
      position: t.position,
      projectId: t.projectId,
      boardId: t.boardId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolution: t.resolution,
      dueDate: t.dueDate,
      metadata: t.metadata,
      dependencies: t.dependencies,
      parentTaskId: t.parentTaskId,
    })),
    estimateMode: mode,
    estimateUnitLabel: estimateUnitLabel(mode),
    workflowStages,
    customFieldDefs: parseCustomFieldDefs(ctx.project.settings?.customFieldDefs),
  });
});

tasksRouter.post(
  '/boards/:boardId/tasks',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = createTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const ctx = await loadBoardContext(req.params.boardId, req.tenantId);
    if (!ctx) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId, req.userId, req.membership?.role, ctx.project.id);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    if (value.priority === 'P0' && !canSetP0(req.membership?.role)) {
      res.status(403).json({ error: 'Only Admin or Manager can create P0 tasks' });
      return;
    }
    const wfStages = resolveWorkflowStageNames(ctx.board, ctx.project);
    if (!isValidStatusForWorkflow(value.status, wfStages)) {
      res.status(400).json({ error: 'Invalid status for this board workflow' });
      return;
    }
    const metaErrCreate = validateTaskMetadata(ctx.project.settings, value.metadata ?? {});
    if (metaErrCreate) {
      res.status(400).json({ error: metaErrCreate });
      return;
    }
    const mode = resolveEstimateMode(ctx.board, ctx.project, ctx.tenant);
    const estErr = validateEstimateValue(mode, value.estimate ?? null);
    if (estErr) {
      res.status(400).json({ error: estErr });
      return;
    }
    try {
      await assertValidParentTask({
        parentTaskId: value.parentTaskId ?? null,
        tenantId: req.tenantId,
        projectId: ctx.project.id,
      });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid parent task' });
      return;
    }
    const key = await nextTaskKey(req.tenantId);
    let slaDeadline: Date | null = null;
    let slaState: Record<string, unknown> = {};
    const slaPol = resolveSlaPolicy(ctx.project.settings);
    const startedCreate = new Date();
    const projSettings = ctx.project.settings as Record<string, unknown> | undefined;
    if (shouldStartSlaOnCreate(slaPol)) {
      slaDeadline = computeSlaDeadlineFromPolicy(startedCreate, value.priority as TaskPriority, slaPol, projSettings);
      slaState = { startedAt: startedCreate.toISOString() };
    } else if (shouldStartSlaOnEnterInProgress(slaPol, value.status)) {
      slaDeadline = computeSlaDeadlineFromPolicy(startedCreate, value.priority as TaskPriority, slaPol, projSettings);
      slaState = { startedAt: startedCreate.toISOString() };
    }
    const task = await Task.create({
      tenantId: req.tenantId,
      projectId: ctx.project.id,
      boardId: ctx.board.id,
      key,
      title: value.title,
      description: value.description ?? null,
      priority: value.priority as TaskPriority,
      status: value.status,
      createdBy: req.userId,
      slaDeadline,
      slaState,
      tags: value.tags ?? [],
      estimate: value.estimate ?? null,
      position: Date.now(),
      resolution: null,
      dueDate: value.dueDate ?? null,
      metadata: value.metadata ?? {},
      parentTaskId: value.parentTaskId ?? null,
    });
    await logActivity({
      tenantId: req.tenantId,
      taskId: task.id,
      actorUserId: req.userId,
      actorType: 'user',
      action: 'task.create',
      entityType: 'task',
      entityId: task.id,
      after: taskToSnapshot(task),
      req,
    });
    emitBoardTasksUpdated(req.tenantId, task.boardId, task.projectId);
    res.status(201).json({ id: task.id, key: task.key });
  }
);

tasksRouter.get('/tasks/:taskId', authenticateJwt, loadMembership, async (req, res) => {
  const task = await Task.findOne({
    where: { id: req.params.taskId, tenantId: req.tenantId! },
  });
  if (!task) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
  } catch (e) {
    if (e instanceof ProjectAccessError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
  const board = await Board.findByPk(task.boardId);
  const project = await Project.findByPk(task.projectId);
  const tenant = await Tenant.findByPk(req.tenantId!);
  const mode =
    board && project && tenant ? resolveEstimateMode(board, project, tenant) : 'story_points';
  const logs = await ActivityLog.findAll({
    where: { tenantId: req.tenantId, taskId: task.id },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  const [parentRow, subtasks] = await Promise.all([
    task.parentTaskId
      ? Task.findOne({
          where: { id: task.parentTaskId, tenantId: req.tenantId! },
          attributes: ['id', 'key', 'title'],
        })
      : Promise.resolve(null),
    Task.findAll({
      where: { tenantId: req.tenantId!, projectId: task.projectId, parentTaskId: task.id },
      attributes: ['id', 'key', 'title', 'status'],
      order: [['position', 'ASC']],
    }),
  ]);
  const parent = parentRow
    ? { id: parentRow.id, key: parentRow.key, title: parentRow.title }
    : null;
  res.json({
    task: {
      id: task.id,
      key: task.key,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assigneeType: task.assigneeType,
      assigneeId: task.assigneeId,
      slaDeadline: task.slaDeadline,
      slaState: task.slaState,
      dependencies: task.dependencies,
      tags: task.tags,
      estimate: task.estimate != null ? Number(task.estimate) : null,
      position: task.position,
      projectId: task.projectId,
      boardId: task.boardId,
      parentTaskId: task.parentTaskId,
      parent,
      subtasks: subtasks.map((s) => ({ id: s.id, key: s.key, title: s.title, status: s.status })),
      estimateMode: mode,
      estimateUnitLabel: estimateUnitLabel(mode),
      resolution: task.resolution,
      dueDate: task.dueDate,
      metadata: task.metadata,
      workflowStages: board && project ? resolveWorkflowStageNames(board, project) : [],
      customFieldDefs: project ? parseCustomFieldDefs(project.settings?.customFieldDefs) : [],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    },
    activity: logs.map((l) => ({
      id: l.id,
      action: l.action,
      actorType: l.actorType,
      before: l.beforeJson,
      after: l.afterJson,
      createdAt: l.createdAt,
    })),
  });
});

tasksRouter.patch(
  '/tasks/:taskId',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER', 'EMPLOYEE'),
  async (req, res) => {
    const { error, value } = patchTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    const task = await Task.findOne({
      where: { id: req.params.taskId, tenantId: req.tenantId! },
    });
    if (!task) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    if (req.membership?.role === 'EMPLOYEE' && task.assigneeId !== req.userId) {
      res.status(403).json({ error: 'Can only edit assigned tasks' });
      return;
    }
    if (value.priority === 'P0' && !canSetP0(req.membership?.role)) {
      res.status(403).json({ error: 'Only Admin or Manager can set P0' });
      return;
    }
    const board = await Board.findByPk(task.boardId);
    const project = await Project.findByPk(task.projectId);
    const tenant = await Tenant.findByPk(req.tenantId!);
    if (!board || !project) {
      res.status(500).json({ error: 'Board/project missing' });
      return;
    }
    const wfStages = resolveWorkflowStageNames(board, project);
    if (value.status && !isValidStatusForWorkflow(value.status, wfStages)) {
      res.status(400).json({ error: 'Invalid status for this board workflow' });
      return;
    }
    if (value.status && !isAllowedWorkflowTransition(task.status, value.status, wfStages)) {
      res.status(400).json({ error: 'Invalid status transition' });
      return;
    }
    const mode = tenant ? resolveEstimateMode(board, project, tenant) : 'story_points';
    if (value.estimate !== undefined) {
      const estErr = validateEstimateValue(mode, value.estimate ?? null);
      if (estErr) {
        res.status(400).json({ error: estErr });
        return;
      }
    }
    if (value.metadata !== undefined) {
      const mErr = validateTaskMetadata(project.settings, value.metadata);
      if (mErr) {
        res.status(400).json({ error: mErr });
        return;
      }
    }
    if (value.dependencies !== undefined) {
      const peers = await Task.findAll({
        where: { boardId: task.boardId, tenantId: req.tenantId! },
        attributes: ['id', 'dependencies'],
      });
      const depMap = new Map(peers.map((p) => [p.id, [...p.dependencies]]));
      if (dependencyAdditionCreatesCycle(task.id, value.dependencies, depMap)) {
        res.status(400).json({ error: 'Dependency cycle detected' });
        return;
      }
    }
    if (value.parentTaskId !== undefined) {
      try {
        await assertValidParentTask({
          taskId: task.id,
          parentTaskId: value.parentTaskId,
          tenantId: req.tenantId!,
          projectId: task.projectId,
        });
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid parent task' });
        return;
      }
      task.parentTaskId = value.parentTaskId;
    }
    const before = taskToSnapshot(task);
    const prevStatus = task.status;
    const prevPriority = task.priority;
    const slaPol = resolveSlaPolicy(project.settings);
    const projSettings = project.settings as Record<string, unknown> | undefined;
    if (value.title !== undefined) task.title = value.title;
    if (value.description !== undefined) task.description = value.description;
    if (value.priority !== undefined) {
      if (value.priority === 'P0' && !canSetP0(req.membership?.role)) {
        res.status(403).json({ error: 'Only Admin or Manager can set P0' });
        return;
      }
      task.priority = value.priority as TaskPriority;
    }
    if (value.status !== undefined) {
      task.status = value.status;
      if (value.status === 'Blocked' && value.blockedReason !== undefined) {
        task.slaState = mergeSlaState(task.slaState, { blockedReason: value.blockedReason || null });
      }
      if (!task.slaDeadline) {
        const started = new Date();
        if (
          shouldStartSlaOnEnterInProgress(slaPol, task.status) ||
          shouldStartSlaOnLeaveFirstStage(slaPol, prevStatus, task.status, wfStages)
        ) {
          task.slaDeadline = computeSlaDeadlineFromPolicy(started, task.priority, slaPol, projSettings);
          task.slaState = mergeSlaState(task.slaState, { startedAt: started.toISOString(), paused: false });
        }
      }
      if (isSlaPausedStatus(task.status)) {
        task.slaState = mergeSlaState(task.slaState, { paused: true, pausedAt: new Date().toISOString() });
      } else if (task.slaState && (task.slaState as { paused?: boolean }).paused) {
        task.slaState = mergeSlaState(task.slaState, { paused: false });
      }
    }
    if (value.resolution !== undefined) task.resolution = value.resolution || null;
    if (value.dueDate !== undefined) task.dueDate = value.dueDate;
    if (value.metadata !== undefined) task.metadata = { ...task.metadata, ...value.metadata };
    if (value.dependencies !== undefined) task.dependencies = value.dependencies;
    if (value.position !== undefined) task.position = value.position;
    if (value.tags !== undefined) task.tags = value.tags;
    if (value.estimate !== undefined) task.estimate = value.estimate;
    if (value.priority !== undefined && value.priority !== prevPriority && task.slaDeadline) {
      const st = task.slaState as Record<string, unknown>;
      const started = st.startedAt ? new Date(String(st.startedAt)) : new Date();
      task.slaDeadline = computeSlaDeadlineFromPolicy(started, task.priority, slaPol, projSettings);
    }
    await task.save();
    const after = taskToSnapshot(task);
    await logActivity({
      tenantId: req.tenantId!,
      taskId: task.id,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'task.update',
      entityType: 'task',
      entityId: task.id,
      before,
      after,
      req,
    });
    await runAutomationsAfterTaskUpdate({ project, task, before, after });
    await fireProjectWebhooks({
      settings: project.settings,
      event: 'task.updated',
      payload: { taskId: task.id, key: task.key, before, after },
      projectId: project.id,
      tenantId: req.tenantId!,
    });
    emitBoardTasksUpdated(req.tenantId!, task.boardId, task.projectId);
    res.json({ id: task.id });
  }
);

tasksRouter.post(
  '/tasks/:taskId/assign',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = assignTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    const task = await Task.findOne({
      where: { id: req.params.taskId, tenantId: req.tenantId! },
    });
    if (!task) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const before = taskToSnapshot(task);
    task.assigneeType = value.assigneeType;
    task.assigneeId = value.assigneeId;
    await task.save();
    await logActivity({
      tenantId: req.tenantId!,
      taskId: task.id,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'task.assign',
      entityType: 'task',
      entityId: task.id,
      before,
      after: taskToSnapshot(task),
      req,
    });
    const projAssign = await Project.findByPk(task.projectId);
    if (projAssign) {
      await fireProjectWebhooks({
        settings: projAssign.settings,
        event: 'task.assigned',
        payload: { taskId: task.id, key: task.key, assigneeType: task.assigneeType, assigneeId: task.assigneeId },
        projectId: projAssign.id,
        tenantId: req.tenantId!,
      });
    }
    emitBoardTasksUpdated(req.tenantId!, task.boardId, task.projectId);
    res.json({ id: task.id });
  }
);

tasksRouter.post(
  '/tasks/:taskId/reassign',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = reassignTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    const task = await Task.findOne({
      where: { id: req.params.taskId, tenantId: req.tenantId! },
    });
    if (!task) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    await Reassignment.create({
      tenantId: req.tenantId!,
      taskId: task.id,
      fromAssigneeType: task.assigneeType,
      fromAssigneeId: task.assigneeId,
      toAssigneeType: value.toType,
      toAssigneeId: value.toId,
      reason: value.reason,
      actorUserId: req.userId!,
      isAutomatic: false,
    });
    task.assigneeType = value.toType;
    task.assigneeId = value.toId;
    await task.save();
    await logActivity({
      tenantId: req.tenantId!,
      taskId: task.id,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'task.reassign',
      entityType: 'task',
      entityId: task.id,
      after: { toType: value.toType, toId: value.toId, reason: value.reason },
      req,
    });
    emitBoardTasksUpdated(req.tenantId!, task.boardId, task.projectId);
    res.json({ id: task.id });
  }
);

tasksRouter.post(
  '/tasks/:taskId/sla/pause',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    const { error, value } = slaReasonSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    const task = await Task.findOne({
      where: { id: req.params.taskId, tenantId: req.tenantId! },
    });
    if (!task) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    task.slaState = mergeSlaState(task.slaState, {
      paused: true,
      pauseReason: value.reason,
      pausedAt: new Date().toISOString(),
    });
    await task.save();
    await logActivity({
      tenantId: req.tenantId!,
      taskId: task.id,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'task.sla.pause',
      entityType: 'task',
      entityId: task.id,
      req,
    });
    res.json({ id: task.id });
  }
);

tasksRouter.post(
  '/tasks/:taskId/sla/resume',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    const task = await Task.findOne({
      where: { id: req.params.taskId, tenantId: req.tenantId! },
    });
    if (!task) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    task.slaState = mergeSlaState(task.slaState, { paused: false, pauseReason: null });
    await task.save();
    await logActivity({
      tenantId: req.tenantId!,
      taskId: task.id,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'task.sla.resume',
      entityType: 'task',
      entityId: task.id,
      req,
    });
    res.json({ id: task.id });
  }
);

tasksRouter.post('/tasks/:taskId/csat', authenticateJwt, loadMembership, async (req, res) => {
  const { error, value } = taskCsatSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  const task = await Task.findOne({
    where: { id: req.params.taskId, tenantId: req.tenantId! },
  });
  if (!task) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
  } catch (e) {
    if (e instanceof ProjectAccessError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
  if (task.status !== 'Done') {
    res.status(400).json({ error: 'CSAT can only be recorded when the task is Done' });
    return;
  }
  const existing = task.metadata?.csat as Record<string, unknown> | undefined;
  if (existing && typeof existing === 'object' && existing.recordedAt) {
    res.status(409).json({ error: 'CSAT already recorded for this task' });
    return;
  }
  const recordedAt = new Date().toISOString();
  task.metadata = {
    ...task.metadata,
    csat: {
      score: value.score,
      comment: value.comment?.trim() ? String(value.comment).trim() : null,
      recordedAt,
      recordedByUserId: req.userId!,
    },
  };
  await task.save();
  await logActivity({
    tenantId: req.tenantId!,
    taskId: task.id,
    actorUserId: req.userId!,
    actorType: 'user',
    action: 'task.csat',
    entityType: 'task',
    entityId: task.id,
    req,
  });
  emitBoardTasksUpdated(req.tenantId!, task.boardId, task.projectId);
  res.status(201).json({ ok: true });
});

tasksRouter.get('/tasks/:taskId/comments', authenticateJwt, loadMembership, async (req, res) => {
  const task = await Task.findOne({
    where: { id: req.params.taskId, tenantId: req.tenantId! },
  });
  if (!task) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
  } catch (e) {
    if (e instanceof ProjectAccessError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
  const rows = await TaskComment.findAll({
    where: { taskId: task.id, tenantId: req.tenantId! },
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'AuthorUser', attributes: ['id', 'email', 'firstName', 'lastName'] }],
  });
  res.json({
    comments: rows.map((c) => ({
      id: c.id,
      body: c.body,
      mentions: c.mentions ?? [],
      createdAt: c.createdAt,
      author: c.AuthorUser
        ? {
            id: c.AuthorUser.id,
            email: c.AuthorUser.email,
            firstName: c.AuthorUser.firstName,
            lastName: c.AuthorUser.lastName,
          }
        : null,
    })),
  });
});

tasksRouter.post('/tasks/:taskId/comments', authenticateJwt, loadMembership, async (req, res) => {
  const { error, value } = taskCommentBodySchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  const task = await Task.findOne({
    where: { id: req.params.taskId, tenantId: req.tenantId! },
  });
  if (!task) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, task.projectId);
  } catch (e) {
    if (e instanceof ProjectAccessError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
  const c = await TaskComment.create({
    tenantId: req.tenantId!,
    taskId: task.id,
    authorUserId: req.userId!,
    body: value.body,
    mentions: extractMentionsFromBody(value.body),
  });
  const handles = c.mentions?.length ? c.mentions : extractMentionsFromBody(value.body);
  const map = await resolveMentionHandlesToUserIds(req.tenantId!, handles);
  for (const [handle, uid] of map) {
    if (uid === req.userId) continue;
    const tm = await TenantMembership.findOne({ where: { tenantId: req.tenantId!, userId: uid } });
    if (!mentionsEnabled(tm?.preferences as Record<string, unknown> | undefined)) continue;
    await createUserNotification({
      tenantId: req.tenantId!,
      userId: uid,
      type: 'mention',
      title: `Mentioned on ${task.key}`,
      body: value.body.length > 400 ? `${value.body.slice(0, 400)}…` : value.body,
      dedupeKey: `mention:${c.id}:${uid}`,
      metadata: { taskId: task.id, commentId: c.id, handle },
    });
  }
  res.status(201).json({ id: c.id });
});
