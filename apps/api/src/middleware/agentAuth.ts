import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { Agent } from '../models';
import { assertAgentsFeatureEnabled, PlanLimitError } from '../services/planLimits';

export async function authenticateAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers['x-agent-key'] as string | undefined;
  if (!key) {
    res.status(401).json({ error: 'Missing X-Agent-Key' });
    return;
  }
  const tokenHash = createHash('sha256').update(key).digest('hex');
  const agent = await Agent.findOne({ where: { apiKeyHash: tokenHash } });
  if (!agent) {
    res.status(401).json({ error: 'Invalid agent key' });
    return;
  }
  const agentId = req.params.agentId;
  if (agentId && agentId !== agent.id) {
    res.status(403).json({ error: 'Agent mismatch' });
    return;
  }
  req.agent = agent;
  req.tenantId = agent.tenantId;

  try {
    await assertAgentsFeatureEnabled(agent.tenantId);
  } catch (e) {
    if (e instanceof PlanLimitError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }

  next();
}
