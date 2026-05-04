/**
 * Must set billing mode before `env` is loaded elsewhere in the app graph.
 */
process.env.BILLING_MODE = 'stripe';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_integration_secret_32_chars_min!!';

import '../test/bootstrap.integration';
import request from 'supertest';
import Stripe from 'stripe';
import { buildApp } from '../app';
import { sequelize, StripeEvent } from '../models';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Stripe webhooks (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  function signPayload(payload: Record<string, unknown>): { raw: string; header: string } {
    const raw = JSON.stringify(payload);
    const header = Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    return { raw, header };
  }

  it('returns 400 when stripe-signature is missing', async () => {
    const res = await request(app).post('/webhooks/stripe').send('{}');
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature is invalid', async () => {
    const raw = JSON.stringify({ id: 'evt_test_bad', type: 'ping', data: { object: {} } });
    const res = await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(400);
  });

  it('stores event once and treats duplicate stripe event id as noop', async () => {
    const id = `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const body = { id, object: 'event', type: 'ping', data: { object: {} } };
    const { raw, header } = signPayload(body);

    const res1 = await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', header)
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res1.status).toBe(200);
    expect(res1.body).toMatchObject({ received: true });

    const res2 = await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', header)
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res2.status).toBe(200);
    expect(res2.body).toMatchObject({ received: true, duplicate: true });

    await StripeEvent.destroy({ where: { stripeEventId: id } });
  });
});
