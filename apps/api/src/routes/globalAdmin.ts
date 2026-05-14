import { Router } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { authenticateJwt, requireGlobalAdmin } from '../middleware/auth';
import { logActivity } from '../services/auditService';
import { ActivityLog, RefreshToken, SubscriptionPlan, Tenant, TenantMembership, TenantSubscription, TenantUsage, User } from '../models';

export const globalAdminRouter = Router();

globalAdminRouter.use(authenticateJwt, requireGlobalAdmin);

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

function resolvePagination(query: unknown) {
  const { error, value } = paginationSchema.validate(query, { abortEarly: false, stripUnknown: true });
  if (error) return { error: error.details };
  const offset = (value.page - 1) * value.pageSize;
  return { value, offset };
}

globalAdminRouter.get('/global-admin/dashboard', async (_req, res) => {
  const [tenantCount, userCount, activeLoginCount, activeSubCount] = await Promise.all([
    Tenant.count(),
    User.count(),
    User.count({ where: { isLoginActive: true } }),
    TenantSubscription.count({ where: { status: { [Op.in]: ['active', 'trialing'] } } }),
  ]);
  res.json({
    totals: {
      tenants: tenantCount,
      users: userCount,
      usersLoginActive: activeLoginCount,
      subscriptionsActiveOrTrialing: activeSubCount,
    },
  });
});

globalAdminRouter.get('/global-admin/users', async (req, res) => {
  const pag = resolvePagination(req.query);
  if ('error' in pag) {
    res.status(400).json({ error: 'Validation failed', details: pag.error });
    return;
  }
  const { value, offset } = pag;
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const loginState = typeof req.query.isLoginActive === 'string' ? req.query.isLoginActive : '';
  const where: Record<string | symbol, unknown> = {};
  if (query) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${query}%` } },
      { firstName: { [Op.iLike]: `%${query}%` } },
      { lastName: { [Op.iLike]: `%${query}%` } },
    ];
  }
  if (loginState === 'true' || loginState === 'false') where.isLoginActive = loginState === 'true';

  const { rows, count } = await User.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: value.pageSize,
    offset,
  });
  const userIds = rows.map((u) => u.id);
  const memberships = userIds.length
    ? await TenantMembership.findAll({
        where: { userId: { [Op.in]: userIds } },
        include: [{ model: Tenant, attributes: ['id', 'name', 'slug'] }],
      })
    : [];
  const byUser = new Map<string, { tenantId: string; tenantName: string; tenantSlug: string; role: string }[]>();
  for (const m of memberships) {
    const row = byUser.get(m.userId) ?? [];
    row.push({
      tenantId: m.tenantId,
      tenantName: (m as unknown as { Tenant?: Tenant }).Tenant?.name ?? '',
      tenantSlug: (m as unknown as { Tenant?: Tenant }).Tenant?.slug ?? '',
      role: m.role,
    });
    byUser.set(m.userId, row);
  }
  const globalAdminIds = new Set(
    memberships.filter((m) => m.tenantId === req.globalAdminTenantId && m.role === 'ADMIN').map((m) => m.userId)
  );
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isLoginActive: u.isLoginActive,
      isGlobalAdmin: globalAdminIds.has(u.id),
      createdAt: u.createdAt,
      memberships: byUser.get(u.id) ?? [],
    })),
    page: value.page,
    pageSize: value.pageSize,
    total: count,
  });
});

const updateUserLoginSchema = Joi.object({
  isLoginActive: Joi.boolean().required(),
});

globalAdminRouter.patch('/global-admin/users/:userId/login-status', async (req, res) => {
  const { error, value } = updateUserLoginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  const user = await User.findByPk(req.params.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const before = { isLoginActive: user.isLoginActive };
  user.isLoginActive = value.isLoginActive;
  await user.save();
  if (!value.isLoginActive) {
    await RefreshToken.destroy({ where: { userId: user.id } });
  }
  await logActivity({
    tenantId: req.globalAdminTenantId!,
    actorUserId: req.userId!,
    actorType: 'user',
    action: 'global_admin.user.login_status',
    entityType: 'user',
    entityId: user.id,
    before,
    after: { isLoginActive: user.isLoginActive },
    req,
  });
  res.json({ ok: true, id: user.id, isLoginActive: user.isLoginActive });
});

globalAdminRouter.get('/global-admin/subscriptions', async (req, res) => {
  const pag = resolvePagination(req.query);
  if ('error' in pag) {
    res.status(400).json({ error: 'Validation failed', details: pag.error });
    return;
  }
  const { value, offset } = pag;
  const tenantQuery = typeof req.query.tenantQuery === 'string' ? req.query.tenantQuery.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const tenantWhere: Record<string, unknown> = tenantQuery
    ? {
        [Op.or]: [
          { name: { [Op.iLike]: `%${tenantQuery}%` } },
          { slug: { [Op.iLike]: `%${tenantQuery}%` } },
        ],
      }
    : {};
  const tenants = await Tenant.findAll({
    where: tenantWhere,
    attributes: ['id', 'name', 'slug'],
    order: [['createdAt', 'DESC']],
  });
  const tenantIds = tenants.map((t) => t.id);
  if (tenantIds.length === 0) {
    res.json({ subscriptions: [], page: value.page, pageSize: value.pageSize, total: 0 });
    return;
  }
  const subs = await TenantSubscription.findAll({
    where: { tenantId: { [Op.in]: tenantIds }, ...(status ? { status } : {}) },
    order: [['createdAt', 'DESC']],
  });
  const latestByTenant = new Map<string, TenantSubscription>();
  for (const s of subs) if (!latestByTenant.has(s.tenantId)) latestByTenant.set(s.tenantId, s);
  const selected = Array.from(latestByTenant.values());
  const planIds = selected.map((s) => s.planId);
  const plans = planIds.length
    ? await SubscriptionPlan.findAll({ where: { id: { [Op.in]: planIds } } })
    : [];
  const planById = new Map(plans.map((p) => [p.id, p]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const total = selected.length;
  const pageRows = selected.slice(offset, offset + value.pageSize);
  res.json({
    subscriptions: pageRows.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      tenantName: tenantById.get(s.tenantId)?.name ?? '',
      tenantSlug: tenantById.get(s.tenantId)?.slug ?? '',
      status: s.status,
      planCode: planById.get(s.planId)?.code ?? null,
      planDisplayName: planById.get(s.planId)?.displayName ?? null,
      currentPeriodEnd: s.currentPeriodEnd,
      trialEndsAt: s.trialEndsAt,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      updatedAt: s.updatedAt,
    })),
    page: value.page,
    pageSize: value.pageSize,
    total,
  });
});

const updateSubscriptionSchema = Joi.object({
  status: Joi.string().valid('active', 'trialing', 'past_due', 'canceled', 'paused').optional(),
  planCode: Joi.string().valid('starter', 'standard', 'pro', 'enterprise').optional(),
  extendDays: Joi.number().integer().min(1).max(3650).optional(),
}).or('status', 'planCode', 'extendDays');

globalAdminRouter.patch('/global-admin/subscriptions/:tenantId', async (req, res) => {
  const { error, value } = updateSubscriptionSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  const sub = await TenantSubscription.findOne({
    where: { tenantId: req.params.tenantId },
    order: [['createdAt', 'DESC']],
  });
  if (!sub) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }
  const before = {
    status: sub.status,
    planId: sub.planId,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
  };
  if (value.status) sub.status = value.status;
  if (value.planCode) {
    const plan = await SubscriptionPlan.findOne({ where: { code: value.planCode } });
    if (!plan) {
      res.status(400).json({ error: 'Plan not found' });
      return;
    }
    const usage = await TenantUsage.findByPk(sub.tenantId);
    const seatCount = usage?.seatCount ?? 0;
    const projectCount = usage?.projectCount ?? 0;
    if (seatCount > plan.maxSeats || projectCount > plan.maxProjects) {
      res.status(409).json({
        error: `Cannot switch to ${plan.displayName}: current usage exceeds plan limits`,
        code: 'PLAN_DOWNGRADE_BLOCKED',
        details: {
          seatCount,
          projectCount,
          targetMaxSeats: plan.maxSeats,
          targetMaxProjects: plan.maxProjects,
        },
      });
      return;
    }
    sub.planId = plan.id;
  }
  if (value.extendDays) {
    const base = sub.currentPeriodEnd ?? sub.trialEndsAt ?? new Date();
    const d = new Date(base);
    d.setDate(d.getDate() + value.extendDays);
    if (sub.status === 'trialing') sub.trialEndsAt = d;
    else sub.currentPeriodEnd = d;
  }
  await sub.save();
  await logActivity({
    tenantId: req.globalAdminTenantId!,
    actorUserId: req.userId!,
    actorType: 'user',
    action: 'global_admin.subscription.update',
    entityType: 'tenant_subscription',
    entityId: sub.id,
    before,
    after: {
      status: sub.status,
      planId: sub.planId,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
    },
    req,
  });
  res.json({ ok: true, id: sub.id });
});

const delegateSuperAdminSchema = Joi.object({
  email: Joi.string().email().max(320).required(),
});

globalAdminRouter.get('/global-admin/super-admins', async (_req, res) => {
  const rows = await TenantMembership.findAll({
    where: { tenantId: _req.globalAdminTenantId!, role: 'ADMIN' },
    include: [{ model: User, attributes: ['id', 'email', 'firstName', 'lastName', 'isLoginActive'] }],
    order: [['createdAt', 'ASC']],
  });
  res.json({
    superAdmins: rows
      .map((m) => (m as unknown as { User?: User; createdAt: Date }).User ? {
          userId: m.userId,
          email: (m as unknown as { User: User }).User.email,
          firstName: (m as unknown as { User: User }).User.firstName,
          lastName: (m as unknown as { User: User }).User.lastName,
          isLoginActive: (m as unknown as { User: User }).User.isLoginActive,
          grantedAt: (m as unknown as { createdAt: Date }).createdAt,
        } : null)
      .filter(Boolean),
  });
});

globalAdminRouter.post('/global-admin/super-admins/delegate', async (req, res) => {
  const { error, value } = delegateSuperAdminSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  const user = await User.findOne({ where: { email: value.email.toLowerCase() } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const [membership, created] = await TenantMembership.findOrCreate({
    where: { tenantId: req.globalAdminTenantId!, userId: user.id },
    defaults: { tenantId: req.globalAdminTenantId!, userId: user.id, role: 'ADMIN' },
  });
  if (!created && membership.role !== 'ADMIN') {
    membership.role = 'ADMIN';
    await membership.save();
  }
  await logActivity({
    tenantId: req.globalAdminTenantId!,
    actorUserId: req.userId!,
    actorType: 'user',
    action: 'global_admin.super_admin.delegate',
    entityType: 'user',
    entityId: user.id,
    after: { email: user.email, role: 'ADMIN' },
    req,
  });
  res.json({ ok: true, userId: user.id, email: user.email });
});

globalAdminRouter.delete('/global-admin/super-admins/:userId', async (req, res) => {
  if (req.params.userId === req.userId) {
    res.status(400).json({ error: 'Cannot revoke your own global admin role' });
    return;
  }
  const deleted = await TenantMembership.destroy({
    where: { tenantId: req.globalAdminTenantId!, userId: req.params.userId, role: 'ADMIN' },
  });
  if (!deleted) {
    res.status(404).json({ error: 'Global admin membership not found' });
    return;
  }
  await logActivity({
    tenantId: req.globalAdminTenantId!,
    actorUserId: req.userId!,
    actorType: 'user',
    action: 'global_admin.super_admin.revoke',
    entityType: 'user',
    entityId: req.params.userId,
    req,
  });
  res.status(204).send();
});

globalAdminRouter.get('/global-admin/audit/export', async (req, res) => {
  const actionPrefix = typeof req.query.actionPrefix === 'string' ? req.query.actionPrefix : 'global_admin.';
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400_000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    res.status(400).json({ error: 'Invalid from/to' });
    return;
  }
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="global-admin-audit.ndjson"');
  const rows = await ActivityLog.findAll({
    where: {
      tenantId: req.globalAdminTenantId!,
      createdAt: { [Op.between]: [from, to] },
      action: { [Op.like]: `${actionPrefix}%` },
    },
    order: [['createdAt', 'ASC']],
    limit: 100000,
  });
  for (const l of rows) {
    res.write(
      `${JSON.stringify({
        id: l.id,
        action: l.action,
        actorUserId: l.actorUserId,
        entityType: l.entityType,
        entityId: l.entityId,
        before: l.beforeJson,
        after: l.afterJson,
        createdAt: l.createdAt,
      })}\n`
    );
  }
  res.end();
});
