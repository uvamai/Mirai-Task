import { Router } from 'express';
import Joi from 'joi';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import { Tenant } from '../models';
import { slaDaysByPrioritySchema } from '../validation/projects';

export const tenantSettingsRouter = Router();

const customBoardTemplateItemSchema = Joi.object({
  templateKey: Joi.string()
    .pattern(/^[a-z][a-z0-9_]*$/)
    .max(64)
    .required(),
  label: Joi.string().max(128).required(),
  description: Joi.string().max(500).allow('').optional(),
  businessType: Joi.string().max(64).optional(),
  defaultStages: Joi.array().items(Joi.string().min(1).max(64)).min(3).max(32).required(),
  defaultEstimateMode: Joi.string().valid('story_points', 'hours').allow(null).optional(),
  sampleTasks: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().max(512).required(),
        status: Joi.string().max(64).required(),
        priority: Joi.string().valid('P0', 'P1', 'P2', 'P3', 'P4').required(),
      })
    )
    .max(12)
    .optional(),
});

const orgPoliciesSchema = Joi.object({
  projectCreationPolicy: Joi.string().valid('ADMIN_AND_MANAGER', 'ADMIN_ONLY').optional(),
  whoCanInvite: Joi.string().valid('ADMIN', 'ADMIN_AND_MANAGER').optional(),
  inviteMaxRole: Joi.string().valid('MANAGER', 'EMPLOYEE').optional(),
  defaultBoardTemplateKey: Joi.string().allow(null, '').max(64).optional(),
  defaultSlaStartPolicy: Joi.string()
    .valid('on_in_progress', 'on_create', 'on_first_leave_backlog')
    .allow(null)
    .optional(),
  defaultSlaDaysByPriority: slaDaysByPrioritySchema.optional(),
}).optional();

const patchSchema = Joi.object({
  estimateMode: Joi.string().valid('story_points', 'hours').optional(),
  orgPolicies: orgPoliciesSchema,
  legalHold: Joi.boolean().optional(),
  customBoardTemplates: Joi.array().items(customBoardTemplateItemSchema).max(20).optional(),
}).min(1);

tenantSettingsRouter.get('/tenant/settings', authenticateJwt, loadMembership, requireRole('ADMIN'), async (req, res) => {
  const tenant = await Tenant.findByPk(req.tenantId!);
  if (!tenant) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ settings: tenant.settings ?? {} });
});

tenantSettingsRouter.patch(
  '/tenant/settings',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN'),
  async (req, res) => {
    const { error, value } = patchSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    const tenant = await Tenant.findByPk(req.tenantId!);
    if (!tenant) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (value.estimateMode !== undefined) {
      tenant.settings = { ...tenant.settings, estimateMode: value.estimateMode };
    }
    if (value.legalHold !== undefined) {
      tenant.settings = { ...tenant.settings, legalHold: value.legalHold };
    }
    if (value.customBoardTemplates !== undefined) {
      tenant.settings = { ...tenant.settings, customBoardTemplates: value.customBoardTemplates };
    }
    if (value.orgPolicies !== undefined) {
      const cur = (tenant.settings.orgPolicies as Record<string, unknown> | undefined) ?? {};
      const next = { ...cur };
      const op = value.orgPolicies as Record<string, unknown>;
      if (op.projectCreationPolicy !== undefined) next.projectCreationPolicy = op.projectCreationPolicy;
      if (op.whoCanInvite !== undefined) next.whoCanInvite = op.whoCanInvite;
      if (op.inviteMaxRole !== undefined) next.inviteMaxRole = op.inviteMaxRole;
      if (op.defaultBoardTemplateKey !== undefined) {
        const dk = op.defaultBoardTemplateKey;
        next.defaultBoardTemplateKey = typeof dk === 'string' && dk.trim() === '' ? null : dk;
      }
      if (op.defaultSlaStartPolicy !== undefined) next.defaultSlaStartPolicy = op.defaultSlaStartPolicy;
      if (op.defaultSlaDaysByPriority !== undefined) {
        const d = op.defaultSlaDaysByPriority as Record<string, number>;
        const prev = (next.defaultSlaDaysByPriority as Record<string, number> | undefined) ?? {};
        next.defaultSlaDaysByPriority = { ...prev, ...d };
      }
      tenant.settings = { ...tenant.settings, orgPolicies: next };
    }
    await tenant.save();
    res.json({ settings: tenant.settings });
  }
);
