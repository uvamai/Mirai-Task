import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env';
import { logger } from '../logger';
import { sequelize } from '../models';
import { applyStripeEvent } from '../services/stripeWebhookService';

export const stripeWebhooksRouter = Router();

function rawBody(req: Request): Buffer | null {
  const b = req.body as Buffer | string | undefined;
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') return Buffer.from(b, 'utf8');
  return null;
}

stripeWebhooksRouter.post('/', async (req: Request, res: Response) => {
  if (env.billingMode !== 'stripe') {
    res.status(404).json({ error: 'Stripe webhooks disabled' });
    return;
  }
  const secret = env.stripeWebhookSecret;
  if (!secret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Webhook misconfigured' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature' });
    return;
  }

  const buf = rawBody(req);
  if (!buf) {
    res.status(400).json({ error: 'Invalid body' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(buf, sig, secret);
  } catch (err: unknown) {
    logger.warn('stripe webhook signature verification failed', { err });
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const [insertRows] = (await sequelize.query(
    `INSERT INTO stripe_events (id, stripe_event_id, received_at)
     VALUES (gen_random_uuid(), $1, NOW())
     ON CONFLICT (stripe_event_id) DO NOTHING
     RETURNING id`,
    { bind: [event.id] }
  )) as [Array<{ id: string }>, unknown];

  const inserted = insertRows.length > 0;
  if (!inserted) {
    res.json({ received: true, duplicate: true });
    return;
  }

  try {
    await applyStripeEvent(event);
  } catch (err: unknown) {
    logger.error('stripe webhook handler error', { err, eventId: event.id });
    await sequelize.query(`DELETE FROM stripe_events WHERE stripe_event_id = $1`, { bind: [event.id] });
    res.status(500).json({ error: 'Processing failed' });
    return;
  }

  res.json({ received: true });
});
