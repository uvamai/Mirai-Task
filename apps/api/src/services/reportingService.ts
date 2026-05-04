import { Op } from 'sequelize';
import { ActivityLog, Task, User } from '../models';

export type CycleTimeRow = { taskId: string; key: string; days: number };

/**
 * Lead time proxy: first time status entered In Progress → first time Done (from activity), bounded by `since`.
 */
export async function computeCycleTimesForProject(options: {
  tenantId: string;
  projectId: string;
  boardId?: string;
  since: Date;
  limit?: number;
}): Promise<{ samples: CycleTimeRow[]; medianDays: number | null; averageDays: number | null }> {
  const { tenantId, projectId, boardId, since, limit = 200 } = options;
  const taskWhere: Record<string, unknown> = {
    tenantId,
    projectId,
    status: 'Done',
    updatedAt: { [Op.gte]: since },
  };
  if (boardId) Object.assign(taskWhere, { boardId });
  const doneTasks = await Task.findAll({
    where: taskWhere,
    attributes: ['id', 'key'],
    limit,
    order: [['updatedAt', 'DESC']],
  });
  const samples: CycleTimeRow[] = [];
  for (const t of doneTasks) {
    const logs = await ActivityLog.findAll({
      where: {
        tenantId,
        taskId: t.id,
        action: 'task.update',
        createdAt: { [Op.gte]: since },
      },
      order: [['createdAt', 'ASC']],
      attributes: ['createdAt', 'beforeJson', 'afterJson'],
    });
    let inProgAt: Date | null = null;
    let doneAt: Date | null = null;
    for (const log of logs) {
      const after = log.afterJson as { status?: string } | null;
      const st = after?.status;
      if (st === 'In Progress') inProgAt = log.createdAt;
      if (st === 'Done') doneAt = log.createdAt;
    }
    if (inProgAt && doneAt && doneAt.getTime() > inProgAt.getTime()) {
      const days = (doneAt.getTime() - inProgAt.getTime()) / 86400_000;
      samples.push({ taskId: t.id, key: t.key, days });
    }
  }
  const daysList = samples.map((s) => s.days).sort((a, b) => a - b);
  const medianDays =
    daysList.length === 0
      ? null
      : daysList.length % 2 === 1
        ? daysList[(daysList.length - 1) / 2]!
        : (daysList[daysList.length / 2 - 1]! + daysList[daysList.length / 2]!) / 2;
  const averageDays =
    daysList.length === 0 ? null : daysList.reduce((a, b) => a + b, 0) / daysList.length;
  return { samples, medianDays, averageDays };
}

export type UtilizationRow = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  openTasks: number;
  wipTasks: number;
  completedInWindow: number;
  estimateSumOpen: number;
};

/**
 * Per-user workload for a project (assignee_type = user). Calendar window for "completed" counts.
 */
export async function computeProjectUtilization(options: {
  tenantId: string;
  projectId: string;
  days?: number;
}): Promise<{ windowDays: number; members: UtilizationRow[] }> {
  const days = Math.min(Math.max(options.days ?? 14, 1), 366);
  const since = new Date(Date.now() - days * 86400_000);
  const tasks = await Task.findAll({
    where: { tenantId: options.tenantId, projectId: options.projectId },
    attributes: ['status', 'estimate', 'assigneeId', 'assigneeType', 'updatedAt'],
  });

  type Agg = { open: number; wip: number; done: number; est: number };
  const map = new Map<string, Agg>();

  for (const t of tasks) {
    if (t.assigneeType !== 'user' || !t.assigneeId) continue;
    const uid = t.assigneeId;
    if (!map.has(uid)) map.set(uid, { open: 0, wip: 0, done: 0, est: 0 });
    const a = map.get(uid)!;
    const est = t.estimate != null ? Number(t.estimate) : 0;
    if (t.status === 'Done') {
      if (new Date(t.updatedAt).getTime() >= since.getTime()) a.done += 1;
    } else {
      a.open += 1;
      a.est += est;
      if (t.status === 'In Progress') a.wip += 1;
    }
  }

  const userIds = [...map.keys()];
  const users = userIds.length
    ? await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'email', 'firstName', 'lastName'],
      })
    : [];
  const umap = new Map(users.map((u) => [u.id, u]));

  const members: UtilizationRow[] = userIds.map((userId) => {
    const a = map.get(userId)!;
    const u = umap.get(userId);
    return {
      userId,
      email: u?.email ?? null,
      firstName: u?.firstName ?? null,
      lastName: u?.lastName ?? null,
      openTasks: a.open,
      wipTasks: a.wip,
      completedInWindow: a.done,
      estimateSumOpen: Math.round(a.est * 100) / 100,
    };
  });
  members.sort((x, y) => y.openTasks + y.wipTasks - (x.openTasks + x.wipTasks));
  return { windowDays: days, members };
}

export type PortfolioMemberRollup = UtilizationRow & { projectsTouched: number };

/**
 * Cross-project utilization rollup for admins/managers (sums per user across projects).
 */
export async function computePortfolioUtilizationRollup(options: {
  tenantId: string;
  projectIds: string[];
  days?: number;
}): Promise<{ windowDays: number; members: PortfolioMemberRollup[] }> {
  const days = Math.min(Math.max(options.days ?? 14, 1), 366);
  const map = new Map<string, UtilizationRow & { projects: Set<string> }>();

  for (const projectId of options.projectIds) {
    const { members } = await computeProjectUtilization({ tenantId: options.tenantId, projectId, days });
    for (const m of members) {
      if (!map.has(m.userId)) {
        map.set(m.userId, {
          userId: m.userId,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
          openTasks: 0,
          wipTasks: 0,
          completedInWindow: 0,
          estimateSumOpen: 0,
          projects: new Set(),
        });
      }
      const agg = map.get(m.userId)!;
      agg.openTasks += m.openTasks;
      agg.wipTasks += m.wipTasks;
      agg.completedInWindow += m.completedInWindow;
      agg.estimateSumOpen += m.estimateSumOpen;
      agg.projects.add(projectId);
    }
  }

  const members: PortfolioMemberRollup[] = [...map.values()].map((v) => ({
    userId: v.userId,
    email: v.email,
    firstName: v.firstName,
    lastName: v.lastName,
    openTasks: v.openTasks,
    wipTasks: v.wipTasks,
    completedInWindow: v.completedInWindow,
    estimateSumOpen: Math.round(v.estimateSumOpen * 100) / 100,
    projectsTouched: v.projects.size,
  }));
  members.sort((x, y) => y.openTasks + y.wipTasks - (x.openTasks + x.wipTasks));
  return { windowDays: days, members };
}

export type CapacityRow = {
  userId: string;
  email: string | null;
  openCount: number;
  openEstimateSum: number;
  doneCount: number;
};

/** Lightweight capacity view: open estimate totals vs done counts by assignee. */
export async function computeProjectCapacity(options: {
  tenantId: string;
  projectId: string;
  boardId?: string;
}): Promise<{ byAssignee: CapacityRow[]; totals: { openCount: number; openEstimateSum: number; doneCount: number } }> {
  const where: Record<string, unknown> = { tenantId: options.tenantId, projectId: options.projectId };
  if (options.boardId) where.boardId = options.boardId;
  const tasks = await Task.findAll({
    where,
    attributes: ['status', 'estimate', 'assigneeId', 'assigneeType'],
  });
  type Agg = { open: number; est: number; done: number };
  const map = new Map<string, Agg>();
  let totalOpen = 0;
  let totalEst = 0;
  let totalDone = 0;

  for (const t of tasks) {
    if (t.status === 'Done') {
      totalDone += 1;
      continue;
    }
    totalOpen += 1;
    const est = t.estimate != null ? Number(t.estimate) : 0;
    totalEst += est;
    if (t.assigneeType !== 'user' || !t.assigneeId) continue;
    const uid = t.assigneeId;
    if (!map.has(uid)) map.set(uid, { open: 0, est: 0, done: 0 });
    const a = map.get(uid)!;
    a.open += 1;
    a.est += est;
  }

  const userIds = [...map.keys()];
  const users = userIds.length
    ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'email'] })
    : [];
  const umap = new Map(users.map((u) => [u.id, u]));

  const byAssignee: CapacityRow[] = userIds.map((userId) => {
    const a = map.get(userId)!;
    const u = umap.get(userId);
    return {
      userId,
      email: u?.email ?? null,
      openCount: a.open,
      openEstimateSum: Math.round(a.est * 100) / 100,
      doneCount: a.done,
    };
  });
  byAssignee.sort((x, y) => y.openEstimateSum - x.openEstimateSum);
  return {
    byAssignee,
    totals: {
      openCount: totalOpen,
      openEstimateSum: Math.round(totalEst * 100) / 100,
      doneCount: totalDone,
    },
  };
}
