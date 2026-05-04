import { Router } from 'express';
import { Op } from 'sequelize';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import { ActivityLog, Task, TaskComment, Tenant } from '../models';
export const adminRouter = Router();

const maxExportSpanDays = Number(process.env.AUDIT_EXPORT_MAX_DAYS ?? 366);

adminRouter.get('/admin/activity', authenticateJwt, loadMembership, requireRole('ADMIN'), async (req, res) => {
  if (!req.tenantId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const where: {
    tenantId: string;
    createdAt?: { [Op.gte]?: Date; [Op.lte]?: Date };
  } = { tenantId: req.tenantId };
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt[Op.gte] = new Date(req.query.from as string);
    if (req.query.to) where.createdAt[Op.lte] = new Date(req.query.to as string);
  }
  const rows = await ActivityLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
  });
  res.json({
    logs: rows.map((l) => ({
      id: l.id,
      action: l.action,
      actorType: l.actorType,
      actorUserId: l.actorUserId,
      actorAgentId: l.actorAgentId,
      taskId: l.taskId,
      entityType: l.entityType,
      entityId: l.entityId,
      before: l.beforeJson,
      after: l.afterJson,
      requestId: l.requestId,
      createdAt: l.createdAt,
    })),
  });
});

adminRouter.get(
  '/admin/sla/overview',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    if (!req.tenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const tasks = await Task.findAll({
      where: { tenantId: req.tenantId },
      attributes: ['id', 'status', 'priority', 'slaDeadline', 'slaState', 'key'],
    });
    const now = Date.now();
    let overdue = 0;
    const byStatus: Record<string, number> = {};
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      if (
        t.slaDeadline &&
        t.status !== 'Done' &&
        new Date(t.slaDeadline).getTime() < now
      ) {
        overdue += 1;
      }
    }
    res.json({ total: tasks.length, overdue, byStatus });
  }
);

/** NDJSON audit export for compliance (tenant-scoped). */
adminRouter.get('/admin/audit/export', authenticateJwt, loadMembership, requireRole('ADMIN'), async (req, res) => {
  if (!req.tenantId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400_000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    res.status(400).json({ error: 'Invalid from/to' });
    return;
  }
  const spanDays = (to.getTime() - from.getTime()) / 86400_000;
  if (spanDays > maxExportSpanDays) {
    res.status(400).json({ error: `Export range exceeds ${maxExportSpanDays} days` });
    return;
  }
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="activity-audit.ndjson"');
  res.setHeader('X-Retention-Policy', `activity_logs retained per tenant policy; export max ${maxExportSpanDays}d`);
  const batch = 500;
  let offset = 0;
  let more = true;
  while (more) {
    const rows = await ActivityLog.findAll({
      where: {
        tenantId: req.tenantId,
        createdAt: { [Op.between]: [from, to] },
      },
      order: [['createdAt', 'ASC']],
      limit: batch,
      offset,
    });
    for (const l of rows) {
      res.write(
        `${JSON.stringify({
          id: l.id,
          action: l.action,
          actorType: l.actorType,
          actorUserId: l.actorUserId,
          actorAgentId: l.actorAgentId,
          taskId: l.taskId,
          entityType: l.entityType,
          entityId: l.entityId,
          before: l.beforeJson,
          after: l.afterJson,
          createdAt: l.createdAt,
        })}\n`
      );
    }
    more = rows.length === batch;
    offset += batch;
    if (offset > 100_000) break;
  }
  res.end();
});

/** Extended NDJSON bundle when `tenant.settings.legalHold` is true (tasks + comments + activity). */
adminRouter.get(
  '/admin/compliance/bundle.ndjson',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN'),
  async (req, res) => {
    if (!req.tenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const tenant = await Tenant.findByPk(req.tenantId);
    if (!tenant?.settings?.legalHold) {
      res.status(403).json({
        error: 'Enable legal hold on the tenant (PATCH /tenant/settings with legalHold: true) to export this bundle',
        code: 'LEGAL_HOLD_REQUIRED',
      });
      return;
    }
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400_000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      res.status(400).json({ error: 'Invalid from/to' });
      return;
    }
    const spanDays = (to.getTime() - from.getTime()) / 86400_000;
    if (spanDays > maxExportSpanDays) {
      res.status(400).json({ error: `Export range exceeds ${maxExportSpanDays} days` });
      return;
    }
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="compliance-bundle.ndjson"');
    res.write(
      `${JSON.stringify({
        kind: 'bundle_header',
        tenantId: req.tenantId,
        from: from.toISOString(),
        to: to.toISOString(),
        legalHold: true,
      })}\n`
    );

    const batch = 500;
    const cap = 100_000;

    async function drainActivities(): Promise<void> {
      let offset = 0;
      for (;;) {
        const rows = await ActivityLog.findAll({
          where: { tenantId: req.tenantId, createdAt: { [Op.between]: [from, to] } },
          order: [['createdAt', 'ASC']],
          limit: batch,
          offset,
        });
        for (const l of rows) {
          res.write(
            `${JSON.stringify({
              kind: 'activity',
              id: l.id,
              action: l.action,
              actorType: l.actorType,
              actorUserId: l.actorUserId,
              taskId: l.taskId,
              entityType: l.entityType,
              entityId: l.entityId,
              before: l.beforeJson,
              after: l.afterJson,
              createdAt: l.createdAt,
            })}\n`
          );
        }
        if (rows.length < batch) break;
        offset += batch;
        if (offset >= cap) break;
      }
    }

    async function drainTasks(): Promise<void> {
      let offset = 0;
      for (;;) {
        const rows = await Task.findAll({
          where: { tenantId: req.tenantId, updatedAt: { [Op.between]: [from, to] } },
          order: [['updatedAt', 'ASC']],
          limit: batch,
          offset,
        });
        for (const t of rows) {
          res.write(
            `${JSON.stringify({
              kind: 'task',
              id: t.id,
              key: t.key,
              projectId: t.projectId,
              boardId: t.boardId,
              title: t.title,
              status: t.status,
              priority: t.priority,
              metadata: t.metadata,
              resolution: t.resolution,
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
            })}\n`
          );
        }
        if (rows.length < batch) break;
        offset += batch;
        if (offset >= cap) break;
      }
    }

    async function drainComments(): Promise<void> {
      let offset = 0;
      for (;;) {
        const rows = await TaskComment.findAll({
          where: { tenantId: req.tenantId, createdAt: { [Op.between]: [from, to] } },
          order: [['createdAt', 'ASC']],
          limit: batch,
          offset,
        });
        for (const c of rows) {
          res.write(
            `${JSON.stringify({
              kind: 'task_comment',
              id: c.id,
              taskId: c.taskId,
              authorUserId: c.authorUserId,
              body: c.body,
              createdAt: c.createdAt,
            })}\n`
          );
        }
        if (rows.length < batch) break;
        offset += batch;
        if (offset >= cap) break;
      }
    }

    await drainActivities();
    await drainTasks();
    await drainComments();
    res.end();
  }
);
