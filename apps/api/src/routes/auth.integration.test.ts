import '../test/bootstrap.integration';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { buildApp } from '../app';
import { sequelize, SubscriptionPlan, TenantSubscription } from '../models';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Registration assigns default signup plan (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates tenant subscription on starter plan by default', async () => {
    const suffix = randomUUID().slice(0, 8);
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: `starter_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'S',
        lastName: 'T',
        organizationName: `Org Starter ${suffix}`,
      });
    expect(res.status).toBe(201);
    const tenantId = res.body.tenant.id as string;

    const starter = await SubscriptionPlan.findOne({ where: { code: 'starter' } });
    expect(starter).not.toBeNull();

    const sub = await TenantSubscription.findOne({
      where: { tenantId },
      order: [['createdAt', 'DESC']],
    });
    expect(sub).not.toBeNull();
    expect(sub!.planId).toBe(starter!.id);
  });
});
