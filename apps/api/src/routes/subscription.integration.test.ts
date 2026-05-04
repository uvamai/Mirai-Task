import '../test/bootstrap.integration';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { buildApp } from '../app';
import { sequelize, TenantSubscription } from '../models';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Subscription read-only (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('blocks mutating requests when subscription is past_due', async () => {
    const suffix = randomUUID().slice(0, 8);
    const reg = await request(app)
      .post('/auth/register')
      .send({
        email: `ro_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'R',
        lastName: 'O',
        organizationName: `Readonly Co ${suffix}`,
      });
    expect(reg.status).toBe(201);
    const token = reg.body.accessToken as string;
    const tenantId = reg.body.tenant.id as string;

    await TenantSubscription.update({ status: 'past_due' }, { where: { tenantId } });

    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Blocked project' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SUBSCRIPTION_READ_ONLY');
  });
});
