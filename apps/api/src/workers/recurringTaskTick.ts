import { Op } from 'sequelize';
import { RecurringTaskRule } from '../models';
import { advanceNextRun } from '../services/recurringScheduler';
import { createSystemBoardTask } from '../services/systemTaskCreate';
import { logger } from '../logger';
import type { TaskPriority } from '../types/task';

export async function runRecurringTaskTick(): Promise<number> {
  const now = new Date();
  const rules = await RecurringTaskRule.findAll({
    where: { active: true, nextRunAt: { [Op.lte]: now } },
    limit: 100,
  });
  let n = 0;
  for (const r of rules) {
    try {
      await createSystemBoardTask({
        tenantId: r.tenantId,
        projectId: r.projectId,
        boardId: r.boardId,
        title: r.title,
        status: r.status,
        priority: r.priority as TaskPriority,
        createdByUserId: r.createdByUserId,
        assigneeUserId: r.assigneeUserId,
      });
      r.lastGeneratedAt = now;
      let next = advanceNextRun(r.nextRunAt, r.frequency, r.intervalCount);
      if (r.endDate) {
        const end = new Date(`${r.endDate}T23:59:59.999Z`);
        if (next.getTime() > end.getTime()) {
          r.active = false;
        }
      }
      r.nextRunAt = next;
      await r.save();
      n += 1;
    } catch (e) {
      logger.error('recurring rule tick failed', { ruleId: r.id, err: e });
    }
  }
  if (n > 0) logger.info('recurring task tick', { created: n });
  return n;
}
