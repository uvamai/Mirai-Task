import '../test/bootstrap.integration';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { buildApp } from '../app';
import { sequelize } from '../models';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Tenant isolation (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects X-Tenant-Id when user is not a member', async () => {
    const suffix = randomUUID().slice(0, 8);
    const r1 = await request(app)
      .post('/auth/register')
      .send({
        email: `a_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'A',
        lastName: 'One',
        organizationName: `Org A ${suffix}`,
      });
    expect(r1.status).toBe(201);
    const r2 = await request(app)
      .post('/auth/register')
      .send({
        email: `b_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'B',
        lastName: 'Two',
        organizationName: `Org B ${suffix}`,
      });
    expect(r2.status).toBe(201);
    const token1 = r1.body.accessToken as string;
    const tenantB = r2.body.tenant.id as string;

    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Tenant-Id', tenantB);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/membership/i);
  });
});
