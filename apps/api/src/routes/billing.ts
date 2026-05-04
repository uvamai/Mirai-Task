import { Router } from 'express';
import Joi from 'joi';
import {
  authenticateJwt,
  loadMembership,
  requireRole,
  requireTenantParamMatchesContext,
} from '../middleware/auth';
import { SubscriptionPlan, Tenant, TenantSubscription, TenantUsage } from '../models';
import { getActivePlanForTenant } from '../services/planLimits';
import { getStripe } from '../services/stripeClient';
import { env } from '../config/env';
import { logger } from '../logger';

const checkoutBodySchema = Joi.object({
  planCode: Joi.string().valid('starter', 'pro', 'enterprise').required(),
});

export const billingRouter = Router();

billingRouter.get(
  '/tenants/:tenantId/billing',
  authenticateJwt,
  loadMembership,
  requireTenantParamMatchesContext('tenantId'),
  requireRole('ADMIN'),
  async (req, res) => {
    if (!req.tenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const tenant = await Tenant.findByPk(req.tenantId);
    const active = await getActivePlanForTenant(req.tenantId);
    const usage = await TenantUsage.findByPk(req.tenantId);
    const subscription = await TenantSubscription.findOne({
      where: { tenantId: req.tenantId },
      order: [['createdAt', 'DESC']],
    });
    let plan: SubscriptionPlan | null = null;
    if (subscription) {
      plan = await SubscriptionPlan.findByPk(subscription.planId);
    }
    res.json({
      billingMode: env.billingMode,
      tenant: tenant ? { id: tenant.id, name: tenant.name, status: tenant.status } : null,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      plan: active
        ? {
            code: active.plan.code,
            displayName: active.plan.displayName,
            maxProjects: active.plan.maxProjects,
            maxSeats: active.plan.maxSeats,
          }
        : plan
          ? {
              code: plan.code,
              displayName: plan.displayName,
              maxProjects: plan.maxProjects,
              maxSeats: plan.maxSeats,
            }
          : null,
      usage: usage
        ? { projectCount: usage.projectCount, seatCount: usage.seatCount }
        : { projectCount: 0, seatCount: 0 },
    });
  }
);

billingRouter.post(
  '/tenants/:tenantId/billing/checkout-session',
  authenticateJwt,
  loadMembership,
  requireTenantParamMatchesContext('tenantId'),
  requireRole('ADMIN'),
  async (req, res) => {
    if (env.billingMode !== 'stripe') {
      res.status(400).json({
        error: 'Checkout is only available when BILLING_MODE=stripe',
        billingMode: env.billingMode,
      });
      return;
    }
    const { error, value } = checkoutBodySchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    if (!req.tenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    try {
      const plan = await SubscriptionPlan.findOne({ where: { code: value.planCode } });
      if (!plan?.stripePriceId) {
        res.status(400).json({ error: 'Plan has no Stripe price configured' });
        return;
      }
      const session = await getStripe().checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${env.publicWebUrl}/app/billing?checkout=success`,
        cancel_url: `${env.publicWebUrl}/pricing`,
        client_reference_id: req.tenantId,
        metadata: { tenantId: req.tenantId, planCode: plan.code },
        subscription_data: {
          metadata: { tenantId: req.tenantId },
        },
      });
      res.json({ url: session.url });
    } catch (e) {
      logger.error('checkout session failed', { err: e, tenantId: req.tenantId });
      res.status(500).json({ error: 'Could not create checkout session' });
    }
  }
);

billingRouter.post(
  '/tenants/:tenantId/billing/portal-session',
  authenticateJwt,
  loadMembership,
  requireTenantParamMatchesContext('tenantId'),
  requireRole('ADMIN'),
  async (req, res) => {
    if (env.billingMode !== 'stripe') {
      res.status(400).json({ error: 'Portal is only available when BILLING_MODE=stripe' });
      return;
    }
    if (!req.tenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const sub = await TenantSubscription.findOne({
      where: { tenantId: req.tenantId },
      order: [['createdAt', 'DESC']],
    });
    if (!sub?.stripeCustomerId) {
      res.status(400).json({ error: 'No Stripe customer on file; complete checkout first' });
      return;
    }
    try {
      const session = await getStripe().billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${env.publicWebUrl}/app/billing`,
      });
      res.json({ url: session.url });
    } catch (e) {
      logger.error('billing portal session failed', { err: e, tenantId: req.tenantId });
      res.status(500).json({ error: 'Could not create portal session' });
    }
  }
);
