import { Router, type NextFunction, type Request, type Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { authenticateJwt, loadMembership, requireRole, requireTenantParamMatchesContext } from '../middleware/auth';
import { authenticateAgent } from '../middleware/agentAuth';
import { Agent, Board, Project, Task } from '../models';
import { assertAgentsFeatureEnabled, PlanLimitError } from '../services/planLimits';
import { createAgentSchema, agentLogSchema, agentMoveSchema } from '../validation/tasks';
import { logActivity } from '../services/auditService';
import {
  isAllowedWorkflowTransition,
  isValidStatusForWorkflow,
  resolveWorkflowStageNames,
} from '../services/workflowService';
import { emitBoardTasksUpdated } from '../realtime/socket';

export const agentsAdminRouter = Router();

async function agentsFeatureGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await assertAgentsFeatureEnabled(req.tenantId!);
    next();
  } catch (e) {
    if (e instanceof PlanLimitError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    next(e);
  }
}

agentsAdminRouter.post(
  '/tenants/:tenantId/agents',
  authenticateJwt,
  loadMembership,
  requireTenantParamMatchesContext('tenantId'),
  requireRole('ADMIN'),
  agentsFeatureGate,
  async (req, res) => {
    const { error, value } = createAgentSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    const rawKey = randomBytes(24).toString('hex');
    const apiKeyHash = createHash('sha256').update(rawKey).digest('hex');
    const agent = await Agent.create({
      tenantId: req.tenantId!,
      name: value.name,
      type: value.type,
      apiKeyHash,
      permissions: { claim: true, move: true, log: true },
    });
    await logActivity({
      tenantId: req.tenantId!,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'agent.create',
      entityType: 'agent',
      entityId: agent.id,
      req,
    });
    res.status(201).json({
      id: agent.id,
      name: agent.name,
      apiKey: rawKey,
      message: 'Store apiKey securely; it is not shown again.',
    });
  }
);

agentsAdminRouter.get(
  '/tenants/:tenantId/agents',
  authenticateJwt,
  loadMembership,
  requireTenantParamMatchesContext('tenantId'),
  requireRole('ADMIN', 'MANAGER'),
  agentsFeatureGate,
  async (req, res) => {
    const rows = await Agent.findAll({
      where: { tenantId: req.tenantId! },
      attributes: ['id', 'name', 'type', 'createdAt', 'permissions'],
    });
    res.json({ agents: rows });
  }
);

export const agentsApiRouter = Router({ mergeParams: true });

agentsApiRouter.use('/agents/:agentId', authenticateAgent);

agentsApiRouter.post('/agents/:agentId/claim', async (req, res) => {
  const agent = req.agent!;
  const { taskId } = req.body as { taskId?: string };
  if (!taskId) {
    res.status(400).json({ error: 'taskId required' });
    return;
  }
  const task = await Task.findOne({ where: { id: taskId, tenantId: agent.tenantId } });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  const perms = agent.permissions as { claim?: boolean };
  if (perms.claim === false) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  task.assigneeType = 'agent';
  task.assigneeId = agent.id;
  await task.save();
  await logActivity({
    tenantId: agent.tenantId,
    taskId: task.id,
    actorAgentId: agent.id,
    actorType: 'agent',
    action: 'task.claim',
    entityType: 'task',
    entityId: task.id,
    req,
  });
  emitBoardTasksUpdated(agent.tenantId, task.boardId, task.projectId);
  res.json({ id: task.id });
});

agentsApiRouter.post('/agents/:agentId/move', async (req, res) => {
  const agent = req.agent!;
  const { error, value } = agentMoveSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  const perms = agent.permissions as { move?: boolean };
  if (perms.move === false) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const task = await Task.findOne({ where: { id: value.taskId, tenantId: agent.tenantId } });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  const board = await Board.findByPk(task.boardId);
  const project = await Project.findByPk(task.projectId);
  if (!board || !project) {
    res.status(400).json({ error: 'Invalid task context' });
    return;
  }
  const wf = resolveWorkflowStageNames(board, project);
  if (!isValidStatusForWorkflow(value.status, wf)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  if (!isAllowedWorkflowTransition(task.status, value.status, wf)) {
    res.status(400).json({ error: 'Invalid transition' });
    return;
  }
  task.status = value.status;
  await task.save();
  await logActivity({
    tenantId: agent.tenantId,
    taskId: task.id,
    actorAgentId: agent.id,
    actorType: 'agent',
    action: 'task.move',
    entityType: 'task',
    entityId: task.id,
    after: { status: value.status },
    req,
  });
  emitBoardTasksUpdated(agent.tenantId, task.boardId, task.projectId);
  res.json({ id: task.id });
});

agentsApiRouter.post('/agents/:agentId/log', async (req, res) => {
  const agent = req.agent!;
  const { error, value } = agentLogSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  const perms = agent.permissions as { log?: boolean };
  if (perms.log === false) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const task = await Task.findOne({ where: { id: value.taskId, tenantId: agent.tenantId } });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  await logActivity({
    tenantId: agent.tenantId,
    taskId: task.id,
    actorAgentId: agent.id,
    actorType: 'agent',
    action: 'agent.log',
    entityType: 'task',
    entityId: task.id,
    after: { message: value.message },
    req,
  });
  res.status(201).json({ ok: true });
});

agentsApiRouter.get('/agents/:agentId/tasks', async (req, res) => {
  const agent = req.agent!;
  const rows = await Task.findAll({
    where: { tenantId: agent.tenantId, assigneeType: 'agent', assigneeId: agent.id },
    order: [['updatedAt', 'DESC']],
    limit: 100,
  });
  res.json({
    tasks: rows.map((t) => ({
      id: t.id,
      key: t.key,
      title: t.title,
      status: t.status,
      priority: t.priority,
      projectId: t.projectId,
    })),
  });
});
