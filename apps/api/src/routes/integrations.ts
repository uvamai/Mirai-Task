import { Router } from 'express';
import Joi from 'joi';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import { TenantIntegration } from '../models';
import { encryptConfig } from '../services/cryptoService';

export const integrationsRouter = Router();

const aiKeySchema = Joi.object({
  provider: Joi.string().valid('openai', 'anthropic').required(),
  apiKey: Joi.string().min(1).required(),
});

integrationsRouter.post('/integrations/ai-key', authenticateJwt, loadMembership, requireRole('ADMIN'), async (req, res) => {
  const { error, value } = aiKeySchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }

  const { provider, apiKey } = value;

  try {
    const encryptedConfig = encryptConfig({ apiKey });

    const [integration, created] = await TenantIntegration.findOrCreate({
      where: { tenantId: req.tenantId!, provider },
      defaults: {
        tenantId: req.tenantId!,
        provider,
        encryptedConfig,
        status: 'active',
      },
    });

    if (!created) {
      integration.encryptedConfig = encryptedConfig;
      integration.status = 'active';
      await integration.save();
    }

    res.json({ success: true, provider, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save integration key' });
  }
});

integrationsRouter.get('/integrations', authenticateJwt, loadMembership, requireRole('ADMIN'), async (req, res) => {
  const integrations = await TenantIntegration.findAll({
    where: { tenantId: req.tenantId! },
    attributes: ['id', 'provider', 'status', 'updatedAt'],
  });

  res.json({ integrations });
});
