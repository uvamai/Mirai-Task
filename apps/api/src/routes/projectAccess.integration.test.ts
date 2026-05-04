import '../test/bootstrap.integration';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { buildApp } from '../app';
import { sequelize } from '../models';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Project member access (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('employee without project membership cannot list boards or tasks', async () => {
    const suffix = randomUUID().slice(0, 8);

    const admin = await request(app)
      .post('/auth/register')
      .send({
        email: `pa_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'Admin',
        lastName: 'User',
        organizationName: `Org PA ${suffix}`,
      });
    expect(admin.status).toBe(201);
    const tokenAdmin = admin.body.accessToken as string;
    const tenantId = admin.body.tenant.id as string;

    const proj = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Restricted' });
    expect(proj.status).toBe(201);
    const projectId = proj.body.id as string;

    const boards = await request(app)
      .get(`/projects/${projectId}/boards`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .set('X-Tenant-Id', tenantId);
    expect(boards.status).toBe(200);
    const boardId = boards.body.boards[0].id as string;

    const emp = await request(app)
      .post('/employees')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        email: `emp_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'Emp',
        lastName: 'Loyee',
        role: 'EMPLOYEE',
      });
    expect(emp.status).toBe(201);
    const empUserId = emp.body.userId as string;

    const login = await request(app).post('/auth/login').send({
      email: `emp_${suffix}@example.com`,
      password: 'CorrectHorseBattery99!',
      tenantId,
    });
    expect(login.status).toBe(200);
    const tokenEmp = login.body.accessToken as string;

    const listProj = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${tokenEmp}`)
      .set('X-Tenant-Id', tenantId);
    expect(listProj.status).toBe(200);
    expect(listProj.body.projects).toEqual([]);

    const b403 = await request(app)
      .get(`/projects/${projectId}/boards`)
      .set('Authorization', `Bearer ${tokenEmp}`)
      .set('X-Tenant-Id', tenantId);
    expect(b403.status).toBe(403);

    const t403 = await request(app)
      .get(`/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${tokenEmp}`)
      .set('X-Tenant-Id', tenantId);
    expect(t403.status).toBe(403);

    const addMem = await request(app)
      .post(`/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .set('X-Tenant-Id', tenantId)
      .send({ userId: empUserId, role: 'CONTRIBUTOR' });
    expect(addMem.status).toBe(201);

    const listAfter = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${tokenEmp}`)
      .set('X-Tenant-Id', tenantId);
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.projects.some((p: { id: string }) => p.id === projectId)).toBe(true);

    const tasksOk = await request(app)
      .get(`/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${tokenEmp}`)
      .set('X-Tenant-Id', tenantId);
    expect(tasksOk.status).toBe(200);
  });
});
