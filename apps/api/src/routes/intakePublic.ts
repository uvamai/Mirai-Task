import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { Board, Project, Task, Tenant } from '../models';
import { nextTaskKey } from '../services/taskKeys';
import { resolveWorkflowStageNames } from '../services/workflowService';
import { validateTaskMetadata } from '../services/customFields';
import { verifyCaptchaIfConfigured } from '../services/captchaVerify';
import { logActivity } from '../services/auditService';
import { taskToSnapshot } from '../services/slaService';
import {
  computeSlaDeadlineFromPolicy,
  resolveSlaPolicy,
  shouldStartSlaOnCreate,
  shouldStartSlaOnEnterInProgress,
} from '../services/slaPolicy';
import type { TaskPriority } from '../types/task';
import { emitBoardTasksUpdated } from '../realtime/socket';
import { logger } from '../logger';

export const intakePublicRouter = Router();

const intakeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PUBLIC_INTAKE_MAX_PER_IP_PER_HOUR ?? 40),
  standardHeaders: true,
  legacyHeaders: false,
});

type PublicIntakeCfg = {
  enabled?: boolean;
  requestTypes?: { key: string; label: string; defaultPriority?: TaskPriority }[];
  /** When set, new intake tasks are created on this board; otherwise the first board by position is used. */
  targetBoardId?: string | null;
};

function readPublicIntake(settings: Record<string, unknown> | undefined): PublicIntakeCfg {
  const raw = settings?.publicIntake;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as PublicIntakeCfg;
}

intakePublicRouter.get('/public/intake/:tenantSlug/:projectId/config', async (req, res) => {
  const tenantSlug = String(req.params.tenantSlug ?? '').slice(0, 128);
  const projectId = String(req.params.projectId ?? '');
  const tenant = await Tenant.findOne({ where: { slug: tenantSlug } });
  if (!tenant) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const project = await Project.findOne({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const pi = readPublicIntake(project.settings);
  if (!pi.enabled || !pi.requestTypes?.length) {
    res.status(404).json({ error: 'Public intake is not available for this project' });
    return;
  }
  let intakeBoardName: string | null = null;
  if (pi.targetBoardId) {
    const tb = await Board.findOne({
      where: { id: pi.targetBoardId, tenantId: tenant.id, projectId: project.id },
      attributes: ['name'],
    });
    intakeBoardName = tb?.name ?? null;
  }

  res.json({
    tenantName: tenant.name,
    projectName: project.name,
    requestTypes: pi.requestTypes.map((r) => ({
      key: r.key,
      label: r.label,
      defaultPriority: r.defaultPriority ?? 'P3',
    })),
    intakeBoardName,
    captchaRequired: Boolean(
      process.env.TURNSTILE_SECRET_KEY || process.env.HCAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY
    ),
  });
});

intakePublicRouter.post('/public/intake/:tenantSlug/:projectId', intakeLimiter, async (req, res) => {
  const bodySchema = Joi.object({
    title: Joi.string().min(1).max(512).required(),
    description: Joi.string().allow('', null).max(8000),
    requestTypeKey: Joi.string().min(1).max(64).required(),
    reporterEmail: Joi.string().email().max(320).required(),
    captchaToken: Joi.string().allow('', null).max(4000),
  });
  const { error, value } = bodySchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }

  const tenantSlug = String(req.params.tenantSlug ?? '').slice(0, 128);
  const projectId = String(req.params.projectId ?? '');
  const tenant = await Tenant.findOne({ where: { slug: tenantSlug } });
  if (!tenant) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const project = await Project.findOne({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const pi = readPublicIntake(project.settings);
  if (!pi.enabled || !pi.requestTypes?.length) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const rt = pi.requestTypes.find((x) => x.key === value.requestTypeKey);
  if (!rt) {
    res.status(400).json({ error: 'Unknown request type' });
    return;
  }

  const cap = await verifyCaptchaIfConfigured(value.captchaToken ?? undefined);
  if (!cap.ok) {
    res.status(400).json({ error: cap.reason });
    return;
  }

  let board: Board | null = null;
  if (pi.targetBoardId) {
    board = await Board.findOne({
      where: { id: pi.targetBoardId, tenantId: tenant.id, projectId: project.id },
    });
  }
  if (!board) {
    board = await Board.findOne({
      where: { tenantId: tenant.id, projectId: project.id },
      order: [
        ['position', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
  }
  if (!board) {
    res.status(500).json({ error: 'No board configured' });
    return;
  }

  const wf = resolveWorkflowStageNames(board, project);
  const firstStatus = wf[0] ?? 'Backlog';
  const priority = (rt.defaultPriority ?? 'P3') as TaskPriority;

  const metadata = {
    source: 'public_intake',
    requestTypeKey: value.requestTypeKey,
    reporterEmail: value.reporterEmail.trim().toLowerCase(),
  };
  const metaErr = validateTaskMetadata(project.settings, metadata);
  if (metaErr) {
    logger.error('intake metadata validation unexpected fail', { metaErr });
    res.status(500).json({ error: 'Could not create request' });
    return;
  }

  const key = await nextTaskKey(tenant.id);
  const slaPol = resolveSlaPolicy(project.settings);
  const projSettings = project.settings as Record<string, unknown> | undefined;
  const started = new Date();
  let slaDeadline: Date | null = null;
  let slaState: Record<string, unknown> = {};
  if (shouldStartSlaOnCreate(slaPol)) {
    slaDeadline = computeSlaDeadlineFromPolicy(started, priority, slaPol, projSettings);
    slaState = { startedAt: started.toISOString() };
  } else if (shouldStartSlaOnEnterInProgress(slaPol, firstStatus)) {
    slaDeadline = computeSlaDeadlineFromPolicy(started, priority, slaPol, projSettings);
    slaState = { startedAt: started.toISOString() };
  }

  const task = await Task.create({
    tenantId: tenant.id,
    projectId: project.id,
    boardId: board.id,
    key,
    title: value.title.trim(),
    description: value.description?.trim() ? String(value.description).trim() : null,
    priority,
    status: firstStatus,
    assigneeType: null,
    assigneeId: null,
    createdBy: null,
    slaDeadline,
    slaState,
    tags: [],
    estimate: null,
    position: Date.now(),
    resolution: null,
    dueDate: null,
    metadata,
    dependencies: [],
  });

  await logActivity({
    tenantId: tenant.id,
    taskId: task.id,
    actorType: 'system',
    action: 'task.create.public_intake',
    entityType: 'task',
    entityId: task.id,
    after: taskToSnapshot(task),
  });

  emitBoardTasksUpdated(tenant.id, board.id, project.id);
  res.status(201).json({ ok: true, taskKey: task.key });
});
