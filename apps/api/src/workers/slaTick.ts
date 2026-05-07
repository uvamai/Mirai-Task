import { Op } from 'sequelize';
import { Project, Task, TenantMembership } from '../models';
import { evaluateSlaTick, applySlaEvent } from '../services/slaService';
import { logActivity } from '../services/auditService';
import { emitBoardTasksUpdated } from '../realtime/socket';
import { fireProjectWebhooks } from '../services/outboundWebhook';
import { logger } from '../logger';
import { createUserNotification } from '../services/notificationService';
import { quietHoursBlock } from '../services/notificationPrefs';

export async function runSlaTick(): Promise<number> {
  const now = new Date();
  const tasks = await Task.findAll({
    where: {
      status: { [Op.in]: ['In Progress', 'In Review', 'Testing'] },
      slaDeadline: { [Op.ne]: null },
    },
    include: [{ model: Project, attributes: ['id', 'settings'] }],
    limit: 500,
  });

  const prefCache = new Map<string, Record<string, unknown>>();
  async function prefsFor(tenantId: string, userId: string): Promise<Record<string, unknown>> {
    const k = `${tenantId}:${userId}`;
    let p = prefCache.get(k);
    if (!p) {
      const m = await TenantMembership.findOne({ where: { tenantId, userId } });
      p = (m?.preferences as Record<string, unknown>) ?? {};
      prefCache.set(k, p);
    }
    return p;
  }

  let n = 0;
  for (const task of tasks) {
    const event = evaluateSlaTick(task, now);
    if (!event) continue;
    try {
      await applySlaEvent(task, event.event);
      await logActivity({
        tenantId: task.tenantId,
        taskId: task.id,
        actorType: 'system',
        action: `sla.${event.event}`,
        entityType: 'task',
        entityId: task.id,
        after: { event: event.event },
      });
      const proj = (task as unknown as { Project?: { settings: Record<string, unknown> } }).Project;
      if (proj && (event.event === 'warning' || event.event === 'soft_breach')) {
        await fireProjectWebhooks({
          settings: proj.settings,
          event: event.event === 'warning' ? 'sla.warning' : 'sla.soft_breach',
          payload: { taskId: task.id, key: task.key, slaEvent: event.event },
          projectId: task.projectId,
          tenantId: task.tenantId,
        });
      }
      emitBoardTasksUpdated(task.tenantId, task.boardId, task.projectId);
      if (
        task.assigneeType === 'user' &&
        task.assigneeId &&
        (event.event === 'warning' || event.event === 'soft_breach')
      ) {
        const assigneePrefs = await prefsFor(task.tenantId, task.assigneeId);
        if (!quietHoursBlock(assigneePrefs, now)) {
          const day = Math.floor(now.getTime() / 86400000);
          await createUserNotification({
            tenantId: task.tenantId,
            userId: task.assigneeId,
            type: 'sla',
            title: `SLA ${event.event}: ${task.key}`,
            body: task.title,
            dedupeKey: `sla:${event.event}:${task.id}:${day}`,
            metadata: { taskId: task.id, boardId: task.boardId, projectId: task.projectId, event: event.event },
          });
        }
      }
      n += 1;
    } catch (e) {
      logger.error('sla tick failed', { taskId: task.id, err: e });
    }
  }
  return n;
}
