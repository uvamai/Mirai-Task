import { Op } from 'sequelize';
import { Task, TenantMembership } from '../models';
import { createUserNotification } from '../services/notificationService';
import { dueRemindersEnabled, quietHoursBlock } from '../services/notificationPrefs';
import { logger } from '../logger';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(isoYmd: string, days: number): string {
  const [y, m, d] = isoYmd.split('-').map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export async function runReminderTick(): Promise<number> {
  const now = new Date();
  const today = ymd(now);
  const tomorrow = addDays(today, 1);
  const tasks = await Task.findAll({
    where: {
      assigneeType: 'user',
      assigneeId: { [Op.ne]: null },
      dueDate: { [Op.ne]: null },
      status: { [Op.notIn]: ['Done'] },
      resolution: null,
    },
    attributes: ['id', 'tenantId', 'projectId', 'boardId', 'key', 'title', 'dueDate', 'assigneeId'],
    limit: 800,
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
  for (const t of tasks) {
    const due = typeof t.dueDate === 'string' ? t.dueDate.slice(0, 10) : ymd(new Date(t.dueDate as unknown as string));
    const uid = t.assigneeId as string;
    const prefs = await prefsFor(t.tenantId, uid);
    if (!dueRemindersEnabled(prefs)) continue;
    if (quietHoursBlock(prefs, now)) continue;

    let bucket: 'overdue' | 'today' | 'tomorrow' | null = null;
    if (due < today) bucket = 'overdue';
    else if (due === today) bucket = 'today';
    else if (due === tomorrow) bucket = 'tomorrow';
    if (!bucket) continue;

    const title =
      bucket === 'overdue'
        ? `Overdue: ${t.key} ${t.title}`
        : bucket === 'today'
          ? `Due today: ${t.key} ${t.title}`
          : `Due tomorrow: ${t.key} ${t.title}`;
    const dedupeKey = `due:${bucket}:${t.id}:${today}`;
    await createUserNotification({
      tenantId: t.tenantId,
      userId: uid,
      type: 'task_due',
      title,
      body: `Task ${t.key} (${due})`,
      dedupeKey,
      metadata: { taskId: t.id, projectId: t.projectId, boardId: t.boardId, bucket },
    });
    n += 1;
  }
  if (n > 0) logger.info('reminder tick notifications', { count: n });
  return n;
}
