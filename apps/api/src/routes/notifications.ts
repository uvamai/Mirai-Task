import { Router } from 'express';
import { Op } from 'sequelize';
import { authenticateJwt, loadMembership } from '../middleware/auth';
import { UserNotification } from '../models';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', authenticateJwt, loadMembership, async (req, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
  const rows = await UserNotification.findAll({
    where: { tenantId: req.tenantId, userId: req.userId },
    order: [['createdAt', 'DESC']],
    limit,
  });
  res.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      readAt: r.readAt,
      metadata: r.metadata,
      createdAt: r.createdAt,
    })),
  });
});

notificationsRouter.get('/notifications/unread-count', authenticateJwt, loadMembership, async (req, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  const n = await UserNotification.count({
    where: { tenantId: req.tenantId, userId: req.userId, readAt: { [Op.is]: null } },
  });
  res.json({ count: n });
});

notificationsRouter.patch('/notifications/:id/read', authenticateJwt, loadMembership, async (req, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  const row = await UserNotification.findOne({
    where: { id: req.params.id, tenantId: req.tenantId, userId: req.userId },
  });
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  row.readAt = new Date();
  await row.save();
  res.json({ ok: true });
});

notificationsRouter.post('/notifications/read-all', authenticateJwt, loadMembership, async (req, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  await UserNotification.update(
    { readAt: new Date() },
    { where: { tenantId: req.tenantId, userId: req.userId, readAt: { [Op.is]: null } } }
  );
  res.json({ ok: true });
});
