import { UniqueConstraintError } from 'sequelize';
import { UserNotification } from '../models';
import { logger } from '../logger';
import { tryTenantRateLimit, tryUserRateLimit } from './planLimits';

/**
 * P12 — Caps to protect a single recipient (or tenant) from runaway notification
 * fanout (e.g., a mass `@all` mention or a misconfigured automation rule). Soft
 * limits — we drop and log rather than throw, so the calling write succeeds.
 */
const NOTIFICATIONS_PER_USER_PER_HOUR = 500;
const NOTIFICATIONS_PER_TENANT_PER_MINUTE = 2000;

export async function createUserNotification(input: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (input.dedupeKey) {
    const existing = await UserNotification.findOne({
      where: { tenantId: input.tenantId, dedupeKey: input.dedupeKey },
    });
    if (existing) return;
  }
  const tenantAllowed = tryTenantRateLimit({
    tenantId: input.tenantId,
    key: 'notifications_create',
    cap: NOTIFICATIONS_PER_TENANT_PER_MINUTE,
    window: 'minute',
  });
  if (!tenantAllowed) {
    logger.warn('notification dropped — tenant fanout cap', { tenantId: input.tenantId, type: input.type });
    return;
  }
  const userAllowed = tryUserRateLimit({
    userId: input.userId,
    key: 'notifications_create',
    cap: NOTIFICATIONS_PER_USER_PER_HOUR,
    window: 'hour',
  });
  if (!userAllowed) {
    logger.warn('notification dropped — recipient hourly cap', { userId: input.userId, type: input.type });
    return;
  }
  try {
    await UserNotification.create({
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      dedupeKey: input.dedupeKey ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    if (e instanceof UniqueConstraintError) return;
    logger.warn('createUserNotification failed', { err: e });
  }
}
