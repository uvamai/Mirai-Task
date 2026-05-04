import { Router } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import { Board, Project, ProjectMember, RecurringTaskRule, Task, Tenant, TenantMembership, User } from '../models';
import { logger } from '../logger';
import {
  assertCanEditSlaPolicy,
  assertProjectMemberAccess,
  assertProjectReportAccess,
  listAccessibleProjectIds,
  ProjectAccessError,
} from '../services/projectAccess';
import { assertCanCreateBoard, PlanLimitError } from '../services/planLimits';
import {
  getBoardTemplate,
  getBoardTemplatePublicByKey,
  listBoardTemplatesMerged,
  listBoardTemplatesPublic,
} from '../services/boardTemplatesCatalog';
import { resolveEstimateMode } from '../services/estimateMode';
import {
  computeCycleTimesForProject,
  computePortfolioUtilizationRollup,
  computeProjectCapacity,
  computeProjectUtilization,
} from '../services/reportingService';
import { isValidStatusForWorkflow, resolveWorkflowStageNames } from '../services/workflowService';
import type { ProjectMemberRole } from '../models/ProjectMember';
import { slaDaysByPrioritySchema } from '../validation/projects';
import { fastForwardNextRun } from '../services/recurringScheduler';

export const projectScopedRouter = Router();

projectScopedRouter.get('/board-templates', authenticateJwt, loadMembership, async (req, res) => {
  const tenant = await Tenant.findByPk(req.tenantId!);
  res.json({ templates: listBoardTemplatesMerged(tenant) });
});

projectScopedRouter.get('/public/board-templates', (_req, res) => {
  res.json({ templates: listBoardTemplatesPublic() });
});

projectScopedRouter.get('/public/board-templates/:templateKey', (req, res) => {
  const key = String(req.params.templateKey ?? '').slice(0, 64);
  const t = getBoardTemplatePublicByKey(key);
  if (!t) {
    res.status(404).json({ error: 'Unknown template' });
    return;
  }
  res.json(t);
});

projectScopedRouter.get(
  '/reports/portfolio/utilization',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    if (!req.tenantId || !req.userId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const scoped = await listAccessibleProjectIds(req.tenantId, req.userId, req.membership?.role);
    let projectIds: string[];
    if (scoped === null) {
      const rows = await Project.findAll({ where: { tenantId: req.tenantId }, attributes: ['id'] });
      projectIds = rows.map((r) => r.id);
    } else {
      projectIds = scoped;
    }
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 366);
    const out = await computePortfolioUtilizationRollup({ tenantId: req.tenantId, projectIds, days });
    res.json(out);
  }
);

const slaPolicyPatchSchema = Joi.object({
  slaStartPolicy: Joi.string().valid('on_in_progress', 'on_create', 'on_first_leave_backlog').optional(),
  slaDaysByPriority: slaDaysByPrioritySchema.optional(),
}).min(1);

projectScopedRouter.patch(
  '/projects/:projectId/sla-policy',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    const { error, value } = slaPolicyPatchSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
      await assertCanEditSlaPolicy(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const project = await Project.findOne({
      where: { id: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!project) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (value.slaStartPolicy !== undefined) {
      project.settings = { ...project.settings, slaStartPolicy: value.slaStartPolicy };
    }
    if (value.slaDaysByPriority !== undefined) {
      const cur = (project.settings.slaDaysByPriority as Record<string, number> | undefined) ?? {};
      project.settings = { ...project.settings, slaDaysByPriority: { ...cur, ...value.slaDaysByPriority } };
    }
    await project.save();
    res.json({ id: project.id, settings: project.settings });
  }
);

const memberBodySchema = Joi.object({
  userId: Joi.string().uuid().required(),
  role: Joi.string().valid('LEAD', 'CONTRIBUTOR', 'VIEWER').required(),
});

const boardCreateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  templateKey: Joi.string().min(1).max(64).required(),
});

const boardPatchSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  settings: Joi.object().unknown(true),
}).min(1);

projectScopedRouter.get(
  '/projects/:projectId/members',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const project = await Project.findOne({
      where: { id: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!project) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const rows = await ProjectMember.findAll({
      where: { projectId: project.id, tenantId: req.tenantId! },
      include: [{ model: User, attributes: ['id', 'email', 'firstName', 'lastName'] }],
      order: [['createdAt', 'ASC']],
    });
    res.json({
      members: rows.map((m) => ({
        userId: m.userId,
        role: m.role,
        email: (m as unknown as { User?: User }).User?.email,
        firstName: (m as unknown as { User?: User }).User?.firstName,
        lastName: (m as unknown as { User?: User }).User?.lastName,
      })),
    });
  }
);

projectScopedRouter.post(
  '/projects/:projectId/members',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = memberBodySchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const project = await Project.findOne({
      where: { id: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!project) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const tm = await TenantMembership.findOne({
      where: { tenantId: req.tenantId!, userId: value.userId },
    });
    if (!tm) {
      res.status(400).json({ error: 'User is not a member of this tenant' });
      return;
    }
    try {
      const [row, created] = await ProjectMember.findOrCreate({
        where: { projectId: project.id, userId: value.userId },
        defaults: {
          tenantId: req.tenantId!,
          projectId: project.id,
          userId: value.userId,
          role: value.role as ProjectMemberRole,
        },
      });
      if (!created) {
        row.role = value.role as ProjectMemberRole;
        await row.save();
      }
      res.status(created ? 201 : 200).json({ userId: row.userId, role: row.role });
    } catch (e) {
      logger.error('add project member failed', { err: e, requestId: req.requestId });
      res.status(500).json({ error: 'Could not add member' });
    }
  }
);

projectScopedRouter.delete(
  '/projects/:projectId/members/:userId',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const project = await Project.findOne({
      where: { id: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!project) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const n = await ProjectMember.destroy({
      where: { projectId: project.id, userId: req.params.userId, tenantId: req.tenantId! },
    });
    if (!n) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    res.status(204).send();
  }
);

projectScopedRouter.get(
  '/projects/:projectId/boards',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const rows = await Board.findAll({
      where: { tenantId: req.tenantId!, projectId: req.params.projectId },
      order: [
        ['position', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
    res.json({
      boards: rows.map((b) => ({
        id: b.id,
        name: b.name,
        templateKey: b.templateKey,
        position: b.position,
        createdAt: b.createdAt,
      })),
    });
  }
);

projectScopedRouter.post(
  '/projects/:projectId/boards',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = boardCreateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const project = await Project.findOne({
      where: { id: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!project) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const tenantRow = await Tenant.findByPk(req.tenantId!);
    const tmpl = getBoardTemplate(value.templateKey, tenantRow);
    if (!tmpl) {
      res.status(400).json({ error: 'Unknown templateKey' });
      return;
    }
    try {
      await assertCanCreateBoard(req.tenantId!, project.id);
    } catch (e) {
      if (e instanceof PlanLimitError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const settings: Record<string, unknown> = {
      kanbanStages: tmpl.defaultStages,
    };
    if (tmpl.defaultEstimateMode) settings.estimateMode = tmpl.defaultEstimateMode;
    const maxPos =
      (await Board.max('position', { where: { projectId: project.id, tenantId: req.tenantId! } })) ?? 0;
    const board = await Board.create({
      tenantId: req.tenantId!,
      projectId: project.id,
      name: value.name,
      templateKey: value.templateKey,
      settings,
      position: Number(maxPos) + 1,
    });
    res.status(201).json({
      id: board.id,
      name: board.name,
      templateKey: board.templateKey,
      settings: board.settings,
      createdAt: board.createdAt,
    });
  }
);

projectScopedRouter.get(
  '/projects/:projectId/boards/:boardId',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const board = await Board.findOne({
      where: {
        id: req.params.boardId,
        projectId: req.params.projectId,
        tenantId: req.tenantId!,
      },
    });
    if (!board) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const project = await Project.findByPk(req.params.projectId);
    const tenant = await Tenant.findByPk(req.tenantId!);
    const mode = resolveEstimateMode(board, project!, tenant!);
    res.json({
      id: board.id,
      name: board.name,
      templateKey: board.templateKey,
      settings: board.settings,
      estimateMode: mode,
      estimateUnitLabel: mode === 'hours' ? 'Hours' : 'Story points',
    });
  }
);

projectScopedRouter.patch(
  '/projects/:projectId/boards/:boardId',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = boardPatchSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const board = await Board.findOne({
      where: {
        id: req.params.boardId,
        projectId: req.params.projectId,
        tenantId: req.tenantId!,
      },
    });
    if (!board) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (value.name !== undefined) board.name = value.name;
    if (value.settings !== undefined) {
      const incoming = value.settings as Record<string, unknown>;
      if (incoming.kanbanStages !== undefined) {
        const { error: ksErr } = Joi.array()
          .items(Joi.string().min(1).max(64))
          .min(3)
          .max(32)
          .validate(incoming.kanbanStages);
        if (ksErr) {
          res.status(400).json({ error: 'Validation failed', details: ksErr.details });
          return;
        }
      }
      if (incoming.columnWidths !== undefined) {
        if (typeof incoming.columnWidths !== 'object' || incoming.columnWidths === null || Array.isArray(incoming.columnWidths)) {
          res.status(400).json({ error: 'columnWidths must be an object of column → width' });
          return;
        }
        for (const [, w] of Object.entries(incoming.columnWidths as Record<string, unknown>)) {
          const n = Number(w);
          if (!Number.isFinite(n) || n < 160 || n > 960) {
            res.status(400).json({ error: 'Each column width must be between 160 and 960' });
            return;
          }
        }
      }
      board.settings = { ...board.settings, ...incoming };
    }
    await board.save();
    res.json({ id: board.id, name: board.name, settings: board.settings });
  }
);

projectScopedRouter.delete(
  '/projects/:projectId/boards/:boardId',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const { boardId, projectId } = req.params;
    const others = await Board.findAll({
      where: { tenantId: req.tenantId!, projectId, id: { [Op.ne]: boardId } },
      order: [
        ['position', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
    if (!others.length) {
      res.status(400).json({ error: 'Cannot delete the last board on a project' });
      return;
    }
    const target = others[0]!;
    await Task.update({ boardId: target.id }, { where: { boardId, tenantId: req.tenantId! } });
    await Board.destroy({ where: { id: boardId, tenantId: req.tenantId!, projectId } });
    res.status(204).send();
  }
);

projectScopedRouter.get(
  '/projects/:projectId/reports/sla',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const boardId = req.query.boardId as string | undefined;
    const where: Record<string, unknown> = {
      tenantId: req.tenantId!,
      projectId: req.params.projectId,
    };
    if (boardId) Object.assign(where, { boardId });
    const tasks = await Task.findAll({ where });
    const now = Date.now();
    const terminal = new Set(['Done']);
    let overdue = 0;
    const byPriority: Record<string, number> = {};
    for (const t of tasks) {
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      if (t.slaDeadline && !terminal.has(t.status) && new Date(t.slaDeadline).getTime() < now) overdue += 1;
    }
    res.json({ overdue, byPriority, total: tasks.length });
  }
);

projectScopedRouter.get(
  '/projects/:projectId/reports/throughput',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const boardId = req.query.boardId as string | undefined;
    const since = new Date(Date.now() - 14 * 86400_000);
    const where: Record<string, unknown> = {
      tenantId: req.tenantId!,
      projectId: req.params.projectId,
      status: 'Done',
      updatedAt: { [Op.gte]: since },
    };
    if (boardId) Object.assign(where, { boardId });
    const rows = await Task.findAll({
      where,
      attributes: ['id', 'updatedAt'],
      order: [['updatedAt', 'ASC']],
    });
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const seriesMap = new Map<string, number>();
    for (const t of rows) {
      const k = dayKey(t.updatedAt);
      seriesMap.set(k, (seriesMap.get(k) ?? 0) + 1);
    }
    const series = [...seriesMap.entries()].map(([day, count]) => ({ day, count }));
    res.json({
      completedTasks14d: rows.length,
      series,
    });
  }
);

projectScopedRouter.get(
  '/projects/:projectId/reports/cycle-time',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const boardId = req.query.boardId as string | undefined;
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 366);
    const since = new Date(Date.now() - days * 86400_000);
    const out = await computeCycleTimesForProject({
      tenantId: req.tenantId!,
      projectId: req.params.projectId,
      boardId,
      since,
      limit: 300,
    });
    res.json(out);
  }
);

projectScopedRouter.get(
  '/projects/:projectId/reports/utilization',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
      await assertProjectReportAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 366);
    const out = await computeProjectUtilization({
      tenantId: req.tenantId!,
      projectId: req.params.projectId,
      days,
    });
    res.json(out);
  }
);

projectScopedRouter.get(
  '/projects/:projectId/reports/capacity',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
      await assertProjectReportAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const boardId = req.query.boardId as string | undefined;
    const out = await computeProjectCapacity({
      tenantId: req.tenantId!,
      projectId: req.params.projectId,
      boardId,
    });
    res.json(out);
  }
);

projectScopedRouter.get(
  '/projects/:projectId/webhook-deliveries',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN'),
  async (req, res) => {
    const project = await Project.findOne({
      where: { id: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!project) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const log = (project.settings?.webhookDeliveryLog as unknown[]) ?? [];
    res.json({ deliveries: log });
  }
);

projectScopedRouter.get(
  '/projects/:projectId/ola-handoffs',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const project = await Project.findOne({
      where: { id: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!project) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const raw = project.settings?.olaHandoffs;
    res.json({ olaHandoffs: Array.isArray(raw) ? raw : [] });
  }
);

function parseIsoBoundary(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** CAB-style view: tasks with `metadata.changeWindowStart` / `changeWindowEnd` overlapping the query window. */
projectScopedRouter.get(
  '/projects/:projectId/reports/change-calendar',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const from = parseIsoBoundary(req.query.from) ?? new Date();
    const to = parseIsoBoundary(req.query.to) ?? new Date(Date.now() + 90 * 86400_000);
    if (from > to) {
      res.status(400).json({ error: 'Invalid from/to' });
      return;
    }
    const boardId = req.query.boardId as string | undefined;
    const where: { tenantId: string; projectId: string; boardId?: string } = {
      tenantId: req.tenantId!,
      projectId: req.params.projectId,
    };
    if (boardId) where.boardId = boardId;
    const tasks = await Task.findAll({
      where,
      attributes: ['id', 'key', 'title', 'status', 'metadata', 'boardId', 'dueDate'],
    });
    const t0 = from.getTime();
    const t1 = to.getTime();
    const changes: {
      id: string;
      key: string;
      title: string;
      status: string;
      boardId: string;
      changeWindowStart: unknown;
      changeWindowEnd: unknown;
    }[] = [];
    for (const t of tasks) {
      const m = (t.metadata ?? {}) as Record<string, unknown>;
      const cs = parseIsoBoundary(m.changeWindowStart);
      const ce = parseIsoBoundary(m.changeWindowEnd);
      if (!cs || !ce) continue;
      const a0 = cs.getTime();
      const a1 = ce.getTime();
      if (a0 <= t1 && t0 <= a1) {
        changes.push({
          id: t.id,
          key: t.key,
          title: t.title,
          status: t.status,
          boardId: t.boardId,
          changeWindowStart: m.changeWindowStart,
          changeWindowEnd: m.changeWindowEnd,
        });
      }
    }
    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      changes,
    });
  }
);

const recurringRuleBodySchema = Joi.object({
  title: Joi.string().min(1).max(512).required(),
  status: Joi.string().min(1).max(64).required(),
  priority: Joi.string().valid('P0', 'P1', 'P2', 'P3', 'P4').required(),
  assigneeUserId: Joi.string().uuid().allow(null).optional(),
  frequency: Joi.string().valid('daily', 'weekly', 'monthly').required(),
  intervalCount: Joi.number().integer().min(1).max(12).default(1),
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(null)
    .optional(),
});

projectScopedRouter.get(
  '/projects/:projectId/boards/:boardId/recurring-rules',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const board = await Board.findOne({
      where: { id: req.params.boardId, projectId: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    const rows = await RecurringTaskRule.findAll({
      where: { tenantId: req.tenantId!, boardId: board.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({
      rules: rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        assigneeUserId: r.assigneeUserId,
        frequency: r.frequency,
        intervalCount: r.intervalCount,
        startDate: r.startDate,
        endDate: r.endDate,
        nextRunAt: r.nextRunAt,
        lastGeneratedAt: r.lastGeneratedAt,
        active: r.active,
        createdAt: r.createdAt,
      })),
    });
  }
);

projectScopedRouter.post(
  '/projects/:projectId/boards/:boardId/recurring-rules',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = recurringRuleBodySchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const project = await Project.findOne({
      where: { id: req.params.projectId, tenantId: req.tenantId! },
    });
    const board = await Board.findOne({
      where: { id: req.params.boardId, projectId: req.params.projectId, tenantId: req.tenantId! },
    });
    if (!project || !board) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const stages = resolveWorkflowStageNames(board, project);
    if (!isValidStatusForWorkflow(value.status, stages)) {
      res.status(400).json({ error: 'Invalid status for this board workflow' });
      return;
    }
    const nextRunAt = fastForwardNextRun(value.startDate, value.frequency, value.intervalCount);
    const rule = await RecurringTaskRule.create({
      tenantId: req.tenantId!,
      projectId: project.id,
      boardId: board.id,
      title: value.title,
      status: value.status,
      priority: value.priority,
      assigneeUserId: value.assigneeUserId ?? null,
      frequency: value.frequency,
      intervalCount: value.intervalCount,
      startDate: value.startDate,
      endDate: value.endDate ?? null,
      nextRunAt,
      active: true,
      createdByUserId: req.userId!,
    });
    res.status(201).json({ id: rule.id });
  }
);

projectScopedRouter.delete(
  '/projects/:projectId/boards/:boardId/recurring-rules/:ruleId',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      await assertProjectMemberAccess(req.tenantId!, req.userId!, req.membership?.role, req.params.projectId);
    } catch (e) {
      if (e instanceof ProjectAccessError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
    const n = await RecurringTaskRule.destroy({
      where: {
        id: req.params.ruleId,
        tenantId: req.tenantId!,
        projectId: req.params.projectId,
        boardId: req.params.boardId,
      },
    });
    if (!n) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(204).send();
  }
);
