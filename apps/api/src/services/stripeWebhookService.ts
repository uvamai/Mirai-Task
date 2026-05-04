import type Stripe from 'stripe';
import { SubscriptionPlan, TenantSubscription } from '../models';
import { logger } from '../logger';

function mapStripeSubscriptionStatus(status: string): string {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    case 'paused':
      return 'paused';
    default:
      return 'active';
  }
}

export async function applyStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      if (!tenantId || typeof session.subscription !== 'string' || typeof session.customer !== 'string') {
        logger.warn('checkout.session.completed missing tenant or stripe ids', { sessionId: session.id });
        return;
      }
      const row = await TenantSubscription.findOne({ where: { tenantId } });
      if (!row) {
        logger.warn('no tenant subscription for checkout', { tenantId });
        return;
      }
      row.stripeCustomerId = session.customer;
      row.stripeSubscriptionId = session.subscription;
      row.status = 'active';
      const planCode = session.metadata?.planCode;
      if (planCode) {
        const plan = await SubscriptionPlan.findOne({ where: { code: planCode } });
        if (plan) row.planId = plan.id;
      }
      await row.save();
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      const row = await TenantSubscription.findOne({ where: { tenantId } });
      if (!row) break;
      row.stripeSubscriptionId = sub.id;
      if (typeof sub.customer === 'string') row.stripeCustomerId = sub.customer;
      row.status = mapStripeSubscriptionStatus(sub.status);
      row.currentPeriodStart = sub.current_period_start
        ? new Date(sub.current_period_start * 1000)
        : null;
      row.currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
      row.cancelAtPeriodEnd = sub.cancel_at_period_end;
      await row.save();
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      const row = await TenantSubscription.findOne({ where: { tenantId } });
      if (!row) break;
      row.status = 'canceled';
      await row.save();
      break;
    }
    default:
      logger.info('stripe event type not handled', { type: event.type, id: event.id });
  }
}
