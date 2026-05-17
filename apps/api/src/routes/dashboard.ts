import { Router } from 'express';
import { Op } from 'sequelize';
import { authenticateJwt, loadMembership } from '../middleware/auth';
import { Task, Project, Board } from '../models';
import { listAccessibleProjectIds } from '../services/projectAccess';

export const dashboardRouter = Router();

/**
 * GET /dashboard/summary
 * Returns org-wide KPIs and per-project health for the home dashboard.
 */
dashboardRouter.get('/dashboard/summary', authenticateJwt, loadMembership, async (req, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }

  const scoped = await listAccessibleProjectIds(req.tenantId, req.userId, req.membership?.role);
  if (scoped !== null && scoped.length === 0) {
    res.json({ kpi: { total: 0, overdue: 0, inProgress: 0, doneThisWeek: 0, myOpenTasks: 0 }, projects: [] });
    return;
  }

  const projectFilter = scoped !== null ? { [Op.in]: scoped } : undefined;
  const tenantWhere = { tenantId: req.tenantId, ...(projectFilter ? { projectId: projectFilter } : {}) };

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [allTasks, projects] = await Promise.all([
    Task.findAll({
      where: tenantWhere,
      attributes: ['id', 'status', 'priority', 'slaDeadline', 'projectId', 'assigneeId', 'assigneeType', 'dueDate', 'estimate', 'updatedAt'],
    }),
    Project.findAll({
      where: {
        tenantId: req.tenantId,
        ...(scoped !== null ? { id: { [Op.in]: scoped } } : {}),
      },
      include: [{ model: Board, attributes: ['id', 'name', 'position'] }],
      order: [['createdAt', 'DESC']],
    }),
  ]);

  const total = allTasks.length;
  const now_ts = now.getTime();
  const overdue = allTasks.filter(t => {
    if (t.status === 'Done') return false;
    if (t.slaDeadline && new Date(t.slaDeadline).getTime() < now_ts) return true;
    if (t.dueDate && new Date(String(t.dueDate)).getTime() < now_ts) return true;
    return false;
  }).length;

  const inProgress = allTasks.filter(t => t.status === 'In Progress').length;
  const doneThisWeek = allTasks.filter(t =>
    t.status === 'Done' && new Date(t.updatedAt).getTime() > weekAgo.getTime()
  ).length;
  const myOpenTasks = allTasks.filter(t =>
    t.assigneeType === 'user' && t.assigneeId === req.userId && t.status !== 'Done'
  ).length;

  // Per-project health
  const projectStats = projects.map(p => {
    const tasks = allTasks.filter(t => t.projectId === p.id);
    const done = tasks.filter(t => t.status === 'Done').length;
    const projOverdue = tasks.filter(t => {
      if (t.status === 'Done') return false;
      if (t.slaDeadline && new Date(t.slaDeadline).getTime() < now_ts) return true;
      if (t.dueDate && new Date(String(t.dueDate)).getTime() < now_ts) return true;
      return false;
    }).length;
    const boards = ((p as unknown as { Boards?: Board[] }).Boards ?? []).map(b => ({ id: b.id, name: b.name }));

    // Health score: 100 - (overdue% * 70) - (open P0/P1 * 5 each)
    const p0p1 = tasks.filter(t => t.status !== 'Done' && (t.priority === 'P0' || t.priority === 'P1')).length;
    const health = tasks.length === 0 ? 100 :
      Math.max(0, Math.round(100 - (projOverdue / tasks.length) * 70 - p0p1 * 5));

    return {
      id: p.id,
      name: p.name,
      total: tasks.length,
      done,
      overdue: projOverdue,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      health,
      boards,
      estimateSum: tasks.reduce((s, t) => s + (t.estimate ? Number(t.estimate) : 0), 0),
    };
  });

  res.json({
    kpi: { total, overdue, inProgress, doneThisWeek, myOpenTasks },
    projects: projectStats,
  });
});
