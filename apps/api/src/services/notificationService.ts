import { UniqueConstraintError } from 'sequelize';
import { UserNotification } from '../models';
import { logger } from '../logger';

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
