import type { Request, Response, NextFunction } from 'express';
import { validate as uuidValidate } from 'uuid';
import { env } from '../config/env';
import { verifyAccessToken } from '../services/authService';
import { Tenant, TenantMembership, TenantSubscription, User } from '../models';
import type { MembershipRole } from '../models/TenantMembership';

export async function authenticateJwt(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    const { userId, tenantId } = verifyAccessToken(token);
    req.userId = userId;
    req.accessToken = token;
    let resolvedTenantId = tenantId;

    const headerTenant = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenant) {
      if (!env.allowXTenantId) {
        res.status(403).json({ error: 'Tenant header not allowed' });
        return;
      }
      if (!uuidValidate(headerTenant)) {
        res.status(400).json({ error: 'Invalid X-Tenant-Id' });
        return;
      }
      resolvedTenantId = headerTenant;
    }

    req.tenantId = resolvedTenantId;
    const user = await User.findByPk(userId);
    if (!user || !user.isLoginActive) {
      res.status(401).json({ error: 'Account is deactivated' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function loadMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId || !req.tenantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const membership = await TenantMembership.findOne({
    where: { userId: req.userId, tenantId: req.tenantId },
  });
  if (!membership) {
    res.status(403).json({ error: 'No membership for tenant' });
    return;
  }
  req.membership = membership;

  const mutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
  if (mutating) {
    const sub = await TenantSubscription.findOne({
      where: { tenantId: req.tenantId },
      order: [['createdAt', 'DESC']],
    });
    const writable = sub && ['active', 'trialing'].includes(sub.status);
    if (!writable) {
      res.status(403).json({
        error: 'Subscription is read-only for this tenant',
        code: 'SUBSCRIPTION_READ_ONLY',
      });
      return;
    }
  }

  next();
}

export async function requireGlobalAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const adminTenant = await Tenant.findOne({ where: { slug: env.globalAdminTenantSlug } });
  if (!adminTenant) {
    res.status(403).json({ error: 'Global admin tenant not configured', code: 'GLOBAL_ADMIN_TENANT_MISSING' });
    return;
  }
  const m = await TenantMembership.findOne({
    where: { userId: req.userId, tenantId: adminTenant.id, role: 'ADMIN' },
  });
  if (!m) {
    res.status(403).json({ error: 'Global admin access required', code: 'GLOBAL_ADMIN_REQUIRED' });
    return;
  }
  req.globalAdminTenantId = adminTenant.id;
  next();
}

export function requireRole(...roles: MembershipRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.membership?.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'Insufficient role' });
      return;
    }
    next();
  };
}

export function requireTenantParamMatchesContext(param = 'tenantId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const fromParam = req.params[param];
    if (!fromParam || fromParam !== req.tenantId) {
      res.status(403).json({ error: 'Tenant mismatch' });
      return;
    }
    next();
  };
}
