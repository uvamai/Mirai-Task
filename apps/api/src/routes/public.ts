import { Router } from 'express';
import { SubscriptionPlan } from '../models';

export const publicRouter = Router();

publicRouter.get('/public/plans', async (_req, res) => {
  const rows = await SubscriptionPlan.findAll({ order: [['monthlyPriceCents', 'ASC']] });
  res.json({
    plans: rows.map((p) => ({
      code: p.code,
      displayName: p.displayName,
      maxProjects: p.maxProjects,
      maxSeats: p.maxSeats,
      maxBoardsPerProject: p.maxBoardsPerProject,
      monthlyPriceCents: p.monthlyPriceCents,
      features: p.featureFlags,
    })),
  });
});
