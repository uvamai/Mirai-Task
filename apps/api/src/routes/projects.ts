import { Router } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { createProjectSchema, slaDaysByPrioritySchema } from '../validation/projects';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import { Board, Project, Task, Tenant, sequelize } from '../models';
import { assertCanCreateProject, PlanLimitError, syncProjectCount } from '../services/planLimits';
import { DEFAULT_KANBAN_STATUSES } from '../constants/kanban';
import { logger } from '../logger';
import { listAccessibleProjectIds, assertProjectMemberAccess, ProjectAccessError } from '../services/projectAccess';
import { syncAdminManagerProjectLeads } from '../services/projectMemberSync';
import { getBoardTemplate } from '../services/boardTemplatesCatalog';
import { nextTaskKey } from '../services/taskKeys';
import { assertManagerMayCreateProject, resolveOrgPolicies } from '../services/orgPolicies';
import type { TaskPriority } from '../types/task';

function slugifyPublicIntakeKey(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, 64) || 'request';
}

function normalizeSlaHolidayCalendar(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const t = x.trim().slice(0, 32);
    if (iso.test(t)) {
      out.push(t);
      continue;
    }
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const s = `${y}-${m}-${day}`;
      if (iso.test(s)) out.push(s);
    }
  }
  return [...new Set(out)].slice(0, 500);
}

export const projectsRouter = Router();

projectsRouter.get(
  '/projects',
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const scoped = await listAccessibleProjectIds(req.tenantId, req.userId!, req.membership?.role);
    const where =
      scoped === null
        ? { tenantId: req.tenantId }
        : scoped.length === 0
          ? { tenantId: req.tenantId, id: { [Op.in]: [] as string[] } }
          : { tenantId: req.tenantId, id: { [Op.in]: scoped } };
    const rows = await Project.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Board,
          attributes: ['id', 'name', 'position', 'createdAt'],
          separate: true,
          order: [
            ['position', 'ASC'],
            ['createdAt', 'ASC'],
          ],
        },
      ],
    });
    res.json({
      projects: rows.map((p) => ({
        id: p.id,
        name: p.name,
        settings: p.settings,
        createdAt: p.createdAt,
        boards: ((p as unknown as { Boards?: Board[] }).Boards ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          position: b.position,
        })),
      })),
    });
  }
);

projectsRouter.get(
  '/projects/:projectId/kanban-stages',
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
    const boardId = req.query.boardId as string | undefined;
    let custom: unknown = project.settings?.kanbanStages;
    if (boardId) {
      const board = await Board.findOne({
        where: { id: boardId, projectId: project.id, tenantId: req.tenantId! },
      });
      if (!board) {
        res.status(404).json({ error: 'Board not found' });
        return;
      }
      const bs = board.settings?.kanbanStages;
      custom = bs !== undefined ? bs : project.settings?.kanbanStages;
    }
    res.json({
      defaultStages: [...DEFAULT_KANBAN_STATUSES],
      customStages: Array.isArray(custom) ? custom : null,
    });
  }
);

const webhookItemSchema = Joi.object({
  id: Joi.string().max(64).required(),
  url: Joi.string().uri().required(),
  secret: Joi.string().min(8).max(256).required(),
  events: Joi.array()
    .items(Joi.string().valid('task.assigned', 'task.updated', 'sla.warning', 'sla.soft_breach'))
    .min(1)
    .required(),
});

const customFieldItemSchema = Joi.object({
  key: Joi.string().max(64).pattern(/^[a-z][a-z0-9_]*$/).required(),
  label: Joi.string().max(128).required(),
  type: Joi.string().valid('text', 'number', 'select').required(),
  options: Joi.when('type', {
    is: 'select',
    then: Joi.array().items(Joi.string().max(200)).min(1).max(50).required(),
    otherwise: Joi.forbidden(),
  }),
});

const publicIntakeItemSchema = Joi.object({
  /** Accept human typing; server slugifies to [a-z0-9_-] before save. */
  key: Joi.string().trim().min(1).max(64).required(),
  label: Joi.string().trim().max(128).required(),
  defaultPriority: Joi.string().valid('P0', 'P1', 'P2', 'P3', 'P4').default('P3'),
});

const patchProjectSettingsSchema = Joi.object({
  kanbanStages: Joi.array().items(Joi.string().min(1).max(64)).min(3).max(32).optional(),
  estimateMode: Joi.string().valid('story_points', 'hours').optional(),
  webhooks: Joi.array().items(webhookItemSchema).max(10).optional(),
  automations: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().max(64).required(),
        when: Joi.object({
          field: Joi.string().valid('status', 'priority').required(),
          op: Joi.string().valid('eq').required(),
          value: Joi.string().max(64).required(),
        }).required(),
        then: Joi.alternatives().try(
          Joi.object({
            action: Joi.string().valid('webhook').required(),
            event: Joi.string().valid('task.assigned', 'task.updated', 'sla.warning', 'sla.soft_breach').required(),
          }),
          Joi.object({
            action: Joi.string().valid('set_priority').required(),
            value: Joi.string().valid('P0', 'P1', 'P2', 'P3', 'P4').required(),
          })
        ),
      })
    )
    .max(20)
    .optional(),
  customFieldDefs: Joi.object({
    fields: Joi.array().items(customFieldItemSchema).max(20),
  }).optional(),
  slaStartPolicy: Joi.string().valid('on_in_progress', 'on_create', 'on_first_leave_backlog').optional(),
  slaDaysByPriority: slaDaysByPrioritySchema.optional(),
  slaUseBusinessDays: Joi.boolean().optional(),
  slaHolidayCalendar: Joi.array().items(Joi.string().trim().max(32)).max(500).optional(),
  olaHandoffs: Joi.array().items(Joi.object().unknown(true)).max(50).optional(),
  publicIntake: Joi.object({
    enabled: Joi.boolean(),
    requestTypes: Joi.array().items(publicIntakeItemSchema).max(30),
  }).optional(),
});

projectsRouter.patch(
  '/projects/:projectId',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = patchProjectSettingsSchema.validate(req.body, { abortEarly: false });
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
    if (
      req.membership?.role === 'MANAGER' &&
      (value.webhooks !== undefined ||
        value.automations !== undefined ||
        value.customFieldDefs !== undefined ||
        value.olaHandoffs !== undefined)
    ) {
      res.status(403).json({ error: 'Only Admin can configure webhooks, automations, custom fields, or OLA handoffs' });
      return;
    }
    if (req.membership?.role === 'MANAGER' && value.estimateMode !== undefined) {
      res.status(403).json({ error: 'Only Admin can change estimate mode at project level' });
      return;
    }
    if (value.publicIntake !== undefined) {
      if (req.membership?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Only Admin can configure public intake' });
        return;
      }
      const pi = value.publicIntake as {
        enabled?: boolean;
        requestTypes?: { key: string; label: string; defaultPriority?: string }[];
      };
      if (pi.enabled === true && (!pi.requestTypes || pi.requestTypes.length < 1)) {
        res.status(400).json({ error: 'publicIntake.requestTypes is required when publicIntake.enabled is true' });
        return;
      }
      const prios = new Set(['P0', 'P1', 'P2', 'P3', 'P4']);
      const sanitized = {
        ...pi,
        requestTypes: (pi.requestTypes ?? []).map((r) => ({
          key: slugifyPublicIntakeKey(r.key),
          label: String(r.label ?? '')
            .trim()
            .slice(0, 128),
          defaultPriority: prios.has(String(r.defaultPriority)) ? r.defaultPriority : 'P3',
        })),
      };
      project.settings = { ...project.settings, publicIntake: sanitized };
    }
    if (value.kanbanStages) {
      project.settings = { ...project.settings, kanbanStages: value.kanbanStages };
    }
    if (value.estimateMode !== undefined && req.membership?.role === 'ADMIN') {
      project.settings = { ...project.settings, estimateMode: value.estimateMode };
    }
    if (value.webhooks !== undefined && req.membership?.role === 'ADMIN') {
      project.settings = { ...project.settings, webhooks: value.webhooks };
    }
    if (value.automations !== undefined && req.membership?.role === 'ADMIN') {
      project.settings = { ...project.settings, automations: value.automations };
    }
    if (value.customFieldDefs !== undefined && req.membership?.role === 'ADMIN') {
      project.settings = { ...project.settings, customFieldDefs: value.customFieldDefs };
    }
    if (value.slaStartPolicy !== undefined) {
      project.settings = { ...project.settings, slaStartPolicy: value.slaStartPolicy };
    }
    if (value.slaDaysByPriority !== undefined) {
      const cur = (project.settings.slaDaysByPriority as Record<string, number> | undefined) ?? {};
      project.settings = {
        ...project.settings,
        slaDaysByPriority: { ...cur, ...value.slaDaysByPriority },
      };
    }
    if (value.slaUseBusinessDays !== undefined) {
      project.settings = { ...project.settings, slaUseBusinessDays: value.slaUseBusinessDays };
    }
    if (value.slaHolidayCalendar !== undefined) {
      project.settings = {
        ...project.settings,
        slaHolidayCalendar: normalizeSlaHolidayCalendar(value.slaHolidayCalendar),
      };
    }
    if (value.olaHandoffs !== undefined && req.membership?.role === 'ADMIN') {
      project.settings = { ...project.settings, olaHandoffs: value.olaHandoffs };
    }
    await project.save();
    res.json({ id: project.id, settings: project.settings });
  }
);

projectsRouter.post(
  '/projects',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = createProjectSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const tenantId = req.tenantId;
    const userId = req.userId;
    try {
      await assertCanCreateProject(tenantId);
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        res.status(500).json({ error: 'Tenant missing' });
        return;
      }
      const org = resolveOrgPolicies(tenant.settings);
      try {
        assertManagerMayCreateProject(req.membership?.role, org);
      } catch (e) {
        const code = (e as Error & { code?: string }).code;
        if (code === 'ORG_POLICY_PROJECT_CREATE') {
          res.status(403).json({ error: (e as Error).message, code });
          return;
        }
        throw e;
      }
      const rawTemplate = typeof value.templateKey === 'string' ? value.templateKey.trim() : '';
      const orgDefault =
        typeof org.defaultBoardTemplateKey === 'string' ? org.defaultBoardTemplateKey.trim() : '';
      const requestedKey = rawTemplate || orgDefault || 'default';
      const usedKey = getBoardTemplate(requestedKey, tenant) ? requestedKey : 'default';
      const tmpl = getBoardTemplate(usedKey, tenant) ?? getBoardTemplate('default', tenant);
      const stages = tmpl?.defaultStages ?? [...DEFAULT_KANBAN_STATUSES];

      const initialProjectSettings: Record<string, unknown> = {};
      if (org.defaultSlaStartPolicy) initialProjectSettings.slaStartPolicy = org.defaultSlaStartPolicy;
      if (org.defaultSlaDaysByPriority && Object.keys(org.defaultSlaDaysByPriority).length > 0) {
        initialProjectSettings.slaDaysByPriority = { ...org.defaultSlaDaysByPriority };
      }

      const { project, board } = await sequelize.transaction(async (transaction) => {
        const p = await Project.create(
          {
            tenantId,
            name: value.name,
            settings: initialProjectSettings,
          },
          { transaction }
        );
        const b = await Board.create(
          {
            tenantId,
            projectId: p.id,
            name: `${p.name} — Main`,
            templateKey: usedKey,
            settings: {
              kanbanStages: stages,
              ...(tmpl?.defaultEstimateMode ? { estimateMode: tmpl.defaultEstimateMode } : {}),
            },
            position: 0,
          },
          { transaction }
        );
        if (value.seedSampleTasks && tmpl?.sampleTasks?.length) {
          for (const st of tmpl.sampleTasks.slice(0, 8)) {
            const taskKey = await nextTaskKey(tenantId);
            await Task.create(
              {
                tenantId,
                projectId: p.id,
                boardId: b.id,
                key: taskKey,
                title: st.title,
                description: null,
                priority: st.priority as TaskPriority,
                status: st.status,
                createdBy: userId,
                slaDeadline: null,
                slaState: {},
                tags: [],
                estimate: null,
                position: Date.now() + Math.random(),
                resolution: null,
                dueDate: null,
                metadata: {},
                dependencies: [],
              },
              { transaction }
            );
          }
        }
        return { project: p, board: b };
      });

      await syncAdminManagerProjectLeads(tenantId, project.id);
      await syncProjectCount(tenantId);
      res.status(201).json({
        id: project.id,
        name: project.name,
        settings: project.settings,
        createdAt: project.createdAt,
        defaultBoardId: board.id,
      });
    } catch (e) {
      if (e instanceof PlanLimitError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      logger.error('create project failed', { err: e, requestId: req.requestId });
      res.status(500).json({ error: 'Could not create project' });
    }
  }
);
