import { Router } from 'express';
import { sequelize } from '../models';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});
