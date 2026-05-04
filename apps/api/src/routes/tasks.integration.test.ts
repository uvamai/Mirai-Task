import '../test/bootstrap.integration';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { buildApp } from '../app';
import { sequelize } from '../models';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Task tenant isolation (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('returns 404 when task belongs to another tenant', async () => {
    const suffix = randomUUID().slice(0, 8);

    const a = await request(app)
      .post('/auth/register')
      .send({
        email: `ta_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'A',
        lastName: 'One',
        organizationName: `Org TA ${suffix}`,
      });
    expect(a.status).toBe(201);
    const tokenA = a.body.accessToken as string;
    const tenantA = a.body.tenant.id as string;

    const b = await request(app)
      .post('/auth/register')
      .send({
        email: `tb_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'B',
        lastName: 'Two',
        organizationName: `Org TB ${suffix}`,
      });
    expect(b.status).toBe(201);
    const tokenB = b.body.accessToken as string;
    const tenantB = b.body.tenant.id as string;

    const proj = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', tenantA)
      .send({ name: 'Project A' });
    expect(proj.status).toBe(201);
    const projectId = proj.body.id as string;

    const boards = await request(app)
      .get(`/projects/${projectId}/boards`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', tenantA);
    expect(boards.status).toBe(200);
    const boardId = boards.body.boards[0].id as string;

    const task = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', tenantA)
      .send({
        title: 'Secret task',
        priority: 'P3',
        status: 'Backlog',
      });
    expect(task.status).toBe(201);
    const taskId = task.body.id as string;

    const leak = await request(app)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Tenant-Id', tenantB);

    expect(leak.status).toBe(404);
  });
});
