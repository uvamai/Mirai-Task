import { Op } from 'sequelize';
import { ActivityLog } from '../models';
import { logger } from '../logger';

/** Deletes activity_logs rows older than the cutoff (all tenants). Returns rows removed. */
export async function purgeActivityLogsOlderThan(retentionDays: number): Promise<number> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;
  const cutoff = new Date(Date.now() - retentionDays * 86400_000);
  const n = await ActivityLog.destroy({
    where: { createdAt: { [Op.lt]: cutoff } },
  });
  logger.info('activity_logs retention purge', { retentionDays, cutoff: cutoff.toISOString(), removed: n });
  return n;
}
