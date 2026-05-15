import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { Op } from 'sequelize';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import {
  ActivityLog,
  Board,
  ImportJob,
  Project,
  ProjectMember,
  RecurringTaskRule,
  sequelize,
  Task,
  Tenant,
  TenantMembership,
  User,
  Document,
  Form,
} from '../models';
import { logger } from '../logger';
import {
  assertCanEditSlaPolicy,
  assertProjectMemberAccess,
  assertProjectReportAccess,
  listAccessibleProjectIds,
  ProjectAccessError,
} from '../services/projectAccess';
import {
  assertCanCreateBoard,
  assertCanImportRowCount,
  assertImportRateLimit,
  assertTenantRateLimit,
  PlanLimitError,
  TenantRateLimitError,
} from '../services/planLimits';
import {
  EXCEL_IMPORT_TEMPLATE_KEY,
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
import { env } from '../config/env';
import {
  applyMappingToRows,
  buildStarterTemplate,
  computeHeadersSignature,
  DEFAULT_IMPORTED_STAGES,
  deriveStagesFromStatuses,
  parseWorkbook,
  readSheetRows,
  suggestMapping,
  type ColumnMapping,
  type OwnerCandidate,
} from '../services/excelImport';
import { parseCustomFieldDefs } from '../services/customFields';
import { emitBoardTasksUpdated } from '../realtime/socket';
import { fireProjectWebhooks } from '../services/outboundWebhook';
import { ASYNC_IMPORT_ROW_THRESHOLD } from '../services/excelImportService';
import { bulkMemberSchema, importCommitSchema } from '../validation/imports';
import { createTenantInvitation } from '../services/invitationService';
import type { MembershipRole } from '../models/TenantMembership';

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

// ---------------------------------------------------------------------------
// Excel import (per-file board with dynamic column mapping). All plans.
// Manager/Admin only. Plan-cap gated via assertCanCreateBoard + row-cap + rate.
// ---------------------------------------------------------------------------

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function importStoragePath(tenantId: string): string {
  return path.join(process.cwd(), env.storageDir, tenantId, 'excel-imports');
}

function importFilePath(tenantId: string, uploadId: string): string {
  return path.join(importStoragePath(tenantId), `${uploadId}.bin`);
}

function sanitizeBoardNameFromFile(name: string): string {
  return name
    .replace(/\.(xlsx|xls|csv|ods)$/i, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .slice(0, 120);
}

async function tenantUserCandidates(tenantId: string): Promise<OwnerCandidate[]> {
  const memberships = await TenantMembership.findAll({
    where: { tenantId },
    include: [{ model: User, attributes: ['id', 'email', 'firstName', 'lastName'] }],
  });
  return memberships
    .map((m) => (m as unknown as { User?: User }).User)
    .filter((u): u is User => Boolean(u))
    .map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
    }));
}

projectScopedRouter.get(
  '/projects/:projectId/imports/excel/template.xlsx',
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
    const defs = parseCustomFieldDefs(project.settings?.customFieldDefs);
    const buf = buildStarterTemplate({ customFieldDefs: defs, projectName: project.name });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeBoardNameFromFile(project.name) || 'mirai-import'}-template.xlsx"`
    );
    res.send(buf);
  }
);

projectScopedRouter.post(
  '/projects/:projectId/imports/excel/preview',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  (req, res, next) => {
    importUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: 'Upload failed', detail: String(err.message ?? err) });
        return;
      }
      next();
    });
  },
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
    const file = req.file;
    if (!file || !file.buffer || file.buffer.length === 0) {
      res.status(400).json({ error: '`file` field required (multipart upload, ≤ 5 MB)' });
      return;
    }
    let snapshot;
    try {
      snapshot = parseWorkbook(file.buffer);
    } catch (e) {
      res.status(400).json({ error: 'Could not parse workbook', detail: (e as Error).message });
      return;
    }
    if (snapshot.sheets.length === 0) {
      res.status(400).json({ error: 'Workbook has no readable sheets' });
      return;
    }
    const defs = parseCustomFieldDefs(project.settings?.customFieldDefs);
    const uploadId = randomUUID();
    const dir = importStoragePath(req.tenantId!);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(importFilePath(req.tenantId!, uploadId), file.buffer);
    } catch (e) {
      logger.error('import buffer persist failed', { err: e, requestId: req.requestId });
      res.status(500).json({ error: 'Could not stage upload' });
      return;
    }

    /**
     * Mapping presets (P5): look up a tenant-stored mapping keyed by header signature.
     * The first sheet's signature is the comparison key — if it matches, the wizard
     * pre-fills with that mapping instead of the header-guess.
     */
    const tenantSettings = (await Tenant.findByPk(req.tenantId!))?.settings ?? {};
    const presets = Array.isArray((tenantSettings as { importPresets?: unknown }).importPresets)
      ? ((tenantSettings as { importPresets: unknown[] }).importPresets as Array<{
          headersSignature?: string;
          mapping?: unknown;
          savedAt?: string;
        }>)
      : [];
    const matchedPreset =
      presets.find((p) => p.headersSignature === snapshot.headersSignature && Array.isArray(p.mapping)) ??
      null;

    /**
     * Idempotent re-upload guard (P5): warn if the same SHA-256 was imported in the last 24h.
     */
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentBoards = await Board.findAll({
      where: {
        tenantId: req.tenantId!,
        templateKey: EXCEL_IMPORT_TEMPLATE_KEY,
        createdAt: { [Op.gte]: since },
      },
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    const existingImport = recentBoards
      .map((b) => ({
        boardId: b.id,
        boardName: b.name,
        projectId: b.projectId,
        fileHash: (b.settings?.importMeta as { fileHash?: string } | undefined)?.fileHash,
        importedAt: (b.settings?.importMeta as { importedAt?: string } | undefined)?.importedAt,
      }))
      .find((row) => row.fileHash && row.fileHash === snapshot.fileHash);

    res.status(201).json({
      uploadId,
      fileHash: snapshot.fileHash,
      headersSignature: snapshot.headersSignature,
      originalFilename: file.originalname,
      suggestedBoardName: sanitizeBoardNameFromFile(file.originalname) || project.name,
      matchedPreset: matchedPreset
        ? {
            mapping: matchedPreset.mapping,
            savedAt: matchedPreset.savedAt ?? null,
          }
        : null,
      existingImport: existingImport ?? null,
      sheets: snapshot.sheets.map((s) => ({
        name: s.name,
        headers: s.headers,
        rowCount: s.rowCount,
        sampleRows: s.sampleRows,
        distinct: s.distinct,
        suggestedMapping: suggestMapping(s.headers, defs),
      })),
      customFieldDefs: defs,
    });
  }
);

projectScopedRouter.post(
  '/projects/:projectId/imports/excel/commit',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = importCommitSchema.validate(req.body, { abortEarly: false });
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
    const filePath = importFilePath(req.tenantId!, value.uploadId);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Upload not found or expired', code: 'IMPORT_UPLOAD_MISSING' });
      return;
    }
    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(filePath);
    } catch (e) {
      logger.error('import buffer read failed', { err: e, requestId: req.requestId });
      res.status(500).json({ error: 'Could not load staged upload' });
      return;
    }
    const parsed = readSheetRows(buffer, value.sheetName);
    if (!parsed) {
      res.status(400).json({ error: `Sheet "${value.sheetName}" not found in upload` });
      return;
    }
    const mapping = value.mapping as ColumnMapping;
    if (mapping.length !== parsed.headers.length) {
      res
        .status(400)
        .json({ error: `Mapping length (${mapping.length}) must match header count (${parsed.headers.length})` });
      return;
    }
    if (!mapping.includes('title')) {
      res.status(400).json({ error: 'Mapping must include exactly one column mapped to "title"' });
      return;
    }
    try {
      await assertCanCreateBoard(req.tenantId!, project.id);
      await assertCanImportRowCount(req.tenantId!, parsed.rows.length);
      await assertImportRateLimit(req.tenantId!);
    } catch (e) {
      if (e instanceof PlanLimitError) {
        res.status(e.code === 'LIMIT_IMPORT_RATE' ? 429 : 403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }

    /**
     * Async path: for sheets larger than the threshold we enqueue an `import_jobs` row and let the
     * worker drain it. Same FOR-UPDATE-SKIP-LOCKED leasing pattern that A1–A4 will reuse.
     */
    if (parsed.rows.length > ASYNC_IMPORT_ROW_THRESHOLD) {
      const job = await ImportJob.create({
        tenantId: req.tenantId!,
        projectId: project.id,
        userId: req.userId!,
        kind: 'excel',
        state: 'queued',
        uploadId: value.uploadId,
        payload: {
          uploadId: value.uploadId,
          sheetName: value.sheetName,
          boardName: value.boardName,
          mapping,
          defaults: value.defaults,
          dateLocale: value.dateLocale,
          deriveStagesFromStatus: value.deriveStagesFromStatus,
          savePreset: value.savePreset,
          membershipRole: req.membership?.role ?? 'MANAGER',
        },
      });
      res.status(202).json({
        jobId: job.id,
        state: job.state,
        rowCount: parsed.rows.length,
        pollUrl: `/projects/${project.id}/imports/excel/jobs/${job.id}`,
      });
      return;
    }

    const tenantRow = await Tenant.findByPk(req.tenantId!);
    const customFieldDefs = parseCustomFieldDefs(project.settings?.customFieldDefs);
    const candidates = await tenantUserCandidates(req.tenantId!);
    let mappingResult;
    try {
      mappingResult = applyMappingToRows(parsed.rows, parsed.headers, mapping, {
        tenantUsers: candidates,
        customFieldDefs,
        defaultPriority: value.defaults.priority,
        defaultStatus: value.defaults.status,
        dateLocale: value.dateLocale,
      });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }

    /** Derive Kanban stages. Always include the explicit defaultStatus + any tasks' statuses. */
    const statuses = mappingResult.tasks.map((t) => t.status).filter(Boolean);
    let kanbanStages: string[];
    if (value.deriveStagesFromStatus && statuses.length > 0) {
      kanbanStages = deriveStagesFromStatuses(statuses);
    } else {
      kanbanStages = [...DEFAULT_IMPORTED_STAGES];
    }
    if (!kanbanStages.find((s) => s.toLowerCase() === value.defaults.status.toLowerCase())) {
      kanbanStages.unshift(value.defaults.status);
      kanbanStages = kanbanStages.slice(0, 32);
    }

    /** Snap each task status to the closest known stage (case-insensitive) so workflow validates downstream. */
    const stageSet = new Map(kanbanStages.map((s) => [s.toLowerCase(), s]));
    for (const t of mappingResult.tasks) {
      const hit = stageSet.get(t.status.toLowerCase());
      t.status = hit ?? kanbanStages[0]!;
    }

    const headersSignature = computeHeadersSignature(parsed.headers);
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const importMeta = {
      sourceFile: 'excel_import',
      sheetName: value.sheetName,
      rowCount: parsed.rows.length,
      taskCount: mappingResult.tasks.length,
      skippedCount: mappingResult.skipped.length,
      mapping,
      headers: parsed.headers,
      headersSignature,
      fileHash,
      dateLocale: value.dateLocale,
      deriveStagesFromStatus: value.deriveStagesFromStatus,
      importedAt: new Date().toISOString(),
      importedByUserId: req.userId,
      undoExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      unresolvedOwners: mappingResult.unresolvedOwners.slice(0, 200),
    };

    const result = await sequelize.transaction(async (transaction) => {
      const maxPos =
        (await Board.max('position', {
          where: { projectId: project.id, tenantId: req.tenantId! },
          transaction,
        })) ?? 0;
      const board = await Board.create(
        {
          tenantId: req.tenantId!,
          projectId: project.id,
          name: value.boardName.trim().slice(0, 255),
          templateKey: EXCEL_IMPORT_TEMPLATE_KEY,
          settings: { kanbanStages, importMeta },
          position: Number(maxPos) + 1,
        },
        { transaction }
      );
      /**
       * Compute the starting task-key offset once per import. `Task.count` inside the same
       * transaction sees in-flight inserts, but issuing it per-row would be O(N²) for large
       * sheets. We pick a single base + monotonically increment in-process.
       */
      const baseTaskCount = await Task.count({ where: { tenantId: req.tenantId! }, transaction });
      let createdCount = 0;
      for (const t of mappingResult.tasks) {
        const key = `MIRAI-${baseTaskCount + createdCount + 1}`;
        const meta = {
          ...t.metadata,
          importedFrom: {
            uploadId: value.uploadId,
            sheet: value.sheetName,
            row: t.rowNumber,
            fileHash: headersSignature,
          },
        };
        await Task.create(
          {
            tenantId: req.tenantId!,
            projectId: project.id,
            boardId: board.id,
            key,
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            assigneeType: t.assigneeType,
            assigneeId: t.assigneeId,
            createdBy: req.userId,
            slaDeadline: null,
            slaState: {},
            tags: t.tags,
            estimate: t.estimate,
            position: Date.now() + createdCount,
            resolution: null,
            dueDate: t.dueDate,
            metadata: meta,
            dependencies: [],
          },
          { transaction }
        );
        createdCount += 1;
      }

      /**
       * Auto-add tenant members referenced as assignees to the project, but only when an Admin imports.
       * Managers still go through the explicit bulk-add CTA so they can review who joins each project.
       */
      const autoAddedMemberIds: string[] = [];
      if (req.membership?.role === 'ADMIN') {
        const referencedUserIds = new Set<string>(
          mappingResult.tasks.map((t) => t.assigneeId).filter((id): id is string => Boolean(id))
        );
        for (const userId of referencedUserIds) {
          const [row, created] = await ProjectMember.findOrCreate({
            where: { projectId: project.id, userId },
            defaults: {
              tenantId: req.tenantId!,
              projectId: project.id,
              userId,
              role: 'CONTRIBUTOR',
            },
            transaction,
          });
          if (created) autoAddedMemberIds.push(row.userId);
        }
      }

      await ActivityLog.create(
        {
          tenantId: req.tenantId!,
          actorUserId: req.userId,
          actorType: 'user',
          action: 'board.import.excel',
          entityType: 'board',
          entityId: board.id,
          afterJson: {
            boardId: board.id,
            taskCount: createdCount,
            sheet: value.sheetName,
            rowCount: parsed.rows.length,
            skippedCount: mappingResult.skipped.length,
            autoAddedMemberIds,
          },
          requestId: req.requestId ?? undefined,
        },
        { transaction }
      );
      /**
       * Persist a mapping preset on this tenant (P5). Same header signature → replaced; otherwise
       * appended; capped at 50 entries FIFO.
       */
      if (value.savePreset !== false) {
        const tenantRowTx = await Tenant.findByPk(req.tenantId!, { transaction });
        if (tenantRowTx) {
          const existing = Array.isArray(
            (tenantRowTx.settings as { importPresets?: unknown })?.importPresets
          )
            ? ((tenantRowTx.settings as { importPresets: unknown[] }).importPresets as Array<{
                headersSignature: string;
                mapping: unknown;
                savedAt: string;
                savedByUserId?: string | null;
              }>)
            : [];
          const filtered = existing.filter((p) => p.headersSignature !== headersSignature);
          const next = [
            ...filtered,
            {
              headersSignature,
              mapping,
              savedAt: new Date().toISOString(),
              savedByUserId: req.userId ?? null,
            },
          ].slice(-50);
          tenantRowTx.settings = { ...tenantRowTx.settings, importPresets: next };
          await tenantRowTx.save({ transaction });
        }
      }

      return { board, createdCount, autoAddedMemberIds };
    });

    /** Best-effort cleanup of the staged upload. */
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }

    emitBoardTasksUpdated(req.tenantId!, result.board.id, project.id);

    /** Best-effort outbound webhook (T17 P5). Non-blocking. */
    void fireProjectWebhooks({
      settings: project.settings ?? {},
      event: 'board.imported',
      payload: {
        schemaVersion: 1,
        tenantId: req.tenantId,
        projectId: project.id,
        boardId: result.board.id,
        boardName: result.board.name,
        taskCount: result.createdCount,
        rowCount: parsed.rows.length,
        skippedCount: mappingResult.skipped.length,
        kanbanStages,
        importedByUserId: req.userId,
        sheet: value.sheetName,
      },
      projectId: project.id,
      tenantId: req.tenantId,
    }).catch((err: unknown) => logger.warn('board.imported webhook failed', { err }));

    void tenantRow;
    res.status(201).json({
      boardId: result.board.id,
      name: result.board.name,
      kanbanStages,
      taskCount: result.createdCount,
      skipped: mappingResult.skipped,
      unresolvedOwners: importMeta.unresolvedOwners,
      undoExpiresAt: importMeta.undoExpiresAt,
      autoAddedMemberIds: result.autoAddedMemberIds,
    });
  }
);

projectScopedRouter.delete(
  '/projects/:projectId/imports/excel/:uploadId',
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
    if (!/^[a-fA-F0-9-]{8,64}$/.test(req.params.uploadId)) {
      res.status(400).json({ error: 'Invalid uploadId' });
      return;
    }
    const fp = importFilePath(req.tenantId!, req.params.uploadId);
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      logger.warn('import buffer cleanup failed', { err: e });
    }
    res.status(204).send();
  }
);

/**
 * Async-import status poll (P5). The wizard calls this after receiving 202 from /commit.
 */
projectScopedRouter.get(
  '/projects/:projectId/imports/excel/jobs/:jobId',
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
    const job = await ImportJob.findOne({
      where: { id: req.params.jobId, tenantId: req.tenantId!, projectId: req.params.projectId },
    });
    if (!job) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({
      jobId: job.id,
      state: job.state,
      boardId: job.boardId,
      attempts: job.attempts,
      lastError: job.lastError,
      result: job.result,
    });
  }
);

/**
 * Undo an Excel import within the 5-minute window written into `board.settings.importMeta.undoExpiresAt`.
 * Deletes the board AND its tasks (the standard board-delete re-parents tasks; an undo must be destructive).
 */
projectScopedRouter.post(
  '/projects/:projectId/boards/:boardId/undo-import',
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
    if (board.templateKey !== EXCEL_IMPORT_TEMPLATE_KEY) {
      res.status(400).json({ error: 'Board was not created by import; cannot undo' });
      return;
    }
    const meta = (board.settings?.importMeta ?? {}) as { undoExpiresAt?: string };
    if (!meta.undoExpiresAt || new Date(meta.undoExpiresAt).getTime() < Date.now()) {
      res.status(410).json({ error: 'Undo window has expired', code: 'IMPORT_UNDO_EXPIRED' });
      return;
    }
    const others = await Board.count({
      where: { tenantId: req.tenantId!, projectId: req.params.projectId, id: { [Op.ne]: board.id } },
    });
    if (others === 0) {
      res
        .status(400)
        .json({ error: 'Cannot undo: this is the only board on the project. Create another board first.' });
      return;
    }
    await sequelize.transaction(async (transaction) => {
      await Task.destroy({
        where: { tenantId: req.tenantId!, boardId: board.id },
        transaction,
      });
      await Board.destroy({
        where: { id: board.id, tenantId: req.tenantId! },
        transaction,
      });
      await ActivityLog.create(
        {
          tenantId: req.tenantId!,
          actorUserId: req.userId,
          actorType: 'user',
          action: 'board.import.undo',
          entityType: 'board',
          entityId: board.id,
          beforeJson: { boardId: board.id, name: board.name },
          requestId: req.requestId ?? undefined,
        },
        { transaction }
      );
    });
    res.status(204).send();
  }
);

/**
 * Bulk add project members; for unknown emails, create tenant invitations.
 * Used by the post-import "Add referenced people" CTA.
 */
projectScopedRouter.post(
  '/projects/:projectId/members/bulk',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = bulkMemberSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    /**
     * P12 — Bulk member add can implicitly fire many invitations; cap per tenant.
     */
    try {
      assertTenantRateLimit({
        tenantId: req.tenantId!,
        key: 'members_bulk',
        cap: 20,
        window: 'hour',
        label: 'Bulk project member add',
      });
    } catch (e) {
      if (e instanceof TenantRateLimitError) {
        res.setHeader('Retry-After', String(e.retryAfterSeconds));
        res.status(429).json({ error: e.message, code: e.code, retryAfterSeconds: e.retryAfterSeconds });
        return;
      }
      throw e;
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
    type Entry =
      | { userId: string; role: ProjectMemberRole }
      | { email: string; role: ProjectMemberRole; invitationRole: MembershipRole };
    const entries = value.entries as Entry[];
    const added: { userId: string; role: ProjectMemberRole }[] = [];
    const invited: { email: string; acceptUrl?: string }[] = [];
    const errors: { input: Entry; reason: string }[] = [];

    for (const entry of entries) {
      try {
        if ('userId' in entry) {
          const tm = await TenantMembership.findOne({
            where: { tenantId: req.tenantId!, userId: entry.userId },
          });
          if (!tm) {
            errors.push({ input: entry, reason: 'User is not a member of this tenant' });
            continue;
          }
          const [row, created] = await ProjectMember.findOrCreate({
            where: { projectId: project.id, userId: entry.userId },
            defaults: {
              tenantId: req.tenantId!,
              projectId: project.id,
              userId: entry.userId,
              role: entry.role,
            },
          });
          if (!created) {
            row.role = entry.role;
            await row.save();
          }
          added.push({ userId: row.userId, role: row.role });
        } else {
          const existingUser = await User.findOne({ where: { email: entry.email.toLowerCase() } });
          if (existingUser) {
            const tm = await TenantMembership.findOne({
              where: { tenantId: req.tenantId!, userId: existingUser.id },
            });
            if (tm) {
              const [row, created] = await ProjectMember.findOrCreate({
                where: { projectId: project.id, userId: existingUser.id },
                defaults: {
                  tenantId: req.tenantId!,
                  projectId: project.id,
                  userId: existingUser.id,
                  role: entry.role,
                },
              });
              if (!created) {
                row.role = entry.role;
                await row.save();
              }
              added.push({ userId: row.userId, role: row.role });
              continue;
            }
          }
          const { rawToken } = await createTenantInvitation({
            tenantId: req.tenantId!,
            email: entry.email,
            membershipRole: entry.invitationRole,
            invitedByUserId: req.userId!,
            inviterMembershipRole: req.membership!.role,
          });
          const base = env.publicWebUrl.replace(/\/$/, '');
          invited.push({
            email: entry.email,
            acceptUrl: `${base}/accept-invite?token=${encodeURIComponent(rawToken)}`,
          });
        }
      } catch (e) {
        errors.push({ input: entry, reason: (e as Error).message });
      }
    }
    res.status(207).json({ added, invited, errors });
  }
);
// Documents CRUD
projectScopedRouter.get('/projects/:projectId/documents', authenticateJwt, loadMembership, async (req, res) => {
  const documents = await Document.findAll({
    where: { tenantId: req.tenantId!, projectId: req.params.projectId },
    order: [['createdAt', 'DESC']],
  });
  res.json({ documents });
});

projectScopedRouter.post('/projects/:projectId/documents', authenticateJwt, loadMembership, async (req, res) => {
  const doc = await Document.create({
    tenantId: req.tenantId!,
    projectId: req.params.projectId,
    title: req.body.title || 'Untitled Document',
    content: req.body.content || {},
  });
  res.status(201).json(doc);
});

projectScopedRouter.patch('/projects/:projectId/documents/:documentId', authenticateJwt, loadMembership, async (req, res) => {
  const doc = await Document.findOne({
    where: { id: req.params.documentId, tenantId: req.tenantId!, projectId: req.params.projectId },
  });
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  
  if (req.body.title !== undefined) doc.title = req.body.title;
  if (req.body.content !== undefined) doc.content = req.body.content;
  await doc.save();
  res.json(doc);
});

projectScopedRouter.delete('/projects/:projectId/documents/:documentId', authenticateJwt, loadMembership, async (req, res) => {
  const n = await Document.destroy({
    where: { id: req.params.documentId, tenantId: req.tenantId!, projectId: req.params.projectId },
  });
  if (!n) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

// Forms CRUD
projectScopedRouter.get('/projects/:projectId/forms', authenticateJwt, loadMembership, async (req, res) => {
  const forms = await Form.findAll({
    where: { tenantId: req.tenantId!, projectId: req.params.projectId },
    order: [['createdAt', 'DESC']],
  });
  res.json({ forms });
});

projectScopedRouter.post('/projects/:projectId/forms', authenticateJwt, loadMembership, async (req, res) => {
  const form = await Form.create({
    tenantId: req.tenantId!,
    projectId: req.params.projectId,
    boardId: req.body.boardId,
    title: req.body.title || 'New Form',
    description: req.body.description || '',
    fields: req.body.fields || [],
    isActive: true,
  });
  res.status(201).json(form);
});

projectScopedRouter.patch('/projects/:projectId/forms/:formId', authenticateJwt, loadMembership, async (req, res) => {
  const form = await Form.findOne({
    where: { id: req.params.formId, tenantId: req.tenantId!, projectId: req.params.projectId },
  });
  if (!form) { res.status(404).json({ error: 'Not found' }); return; }
  
  if (req.body.title !== undefined) form.title = req.body.title;
  if (req.body.description !== undefined) form.description = req.body.description;
  if (req.body.boardId !== undefined) form.boardId = req.body.boardId;
  if (req.body.fields !== undefined) form.fields = req.body.fields;
  if (req.body.isActive !== undefined) form.isActive = req.body.isActive;
  await form.save();
  res.json(form);
});

projectScopedRouter.delete('/projects/:projectId/forms/:formId', authenticateJwt, loadMembership, async (req, res) => {
  const n = await Form.destroy({
    where: { id: req.params.formId, tenantId: req.tenantId!, projectId: req.params.projectId },
  });
  if (!n) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});
