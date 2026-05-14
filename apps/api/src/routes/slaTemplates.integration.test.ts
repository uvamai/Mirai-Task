import '../test/bootstrap.integration';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { buildApp } from '../app';
import { sequelize } from '../models';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('SLA policy + board templates (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('GET /public/board-templates returns catalog entries', async () => {
    const res = await request(app).get('/public/board-templates');
    expect(res.status).toBe(200);
    const keys = (res.body.templates as { templateKey: string }[]).map((t) => t.templateKey);
    expect(keys).toContain('software_development');
    expect(keys.length).toBeGreaterThanOrEqual(14);
  });

  it('GET /public/board-templates/:key returns template detail', async () => {
    const res = await request(app).get('/public/board-templates/product_management');
    expect(res.status).toBe(200);
    expect(res.body.templateKey).toBe('product_management');
    expect(res.body.defaultStages[0]).toBe('Discovery');
  });

  it('GET /public/intake/:slug/:projectId/config returns 404 when intake disabled', async () => {
    const suffix = randomUUID().slice(0, 8);
    const reg = await request(app)
      .post('/auth/register')
      .send({
        email: `intake_cfg_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'I',
        lastName: 'C',
        organizationName: `Org Intake ${suffix}`,
      });
    expect(reg.status).toBe(201);
    const tenantSlug = reg.body.tenant.slug as string;
    const token = reg.body.accessToken as string;
    const tenantId = reg.body.tenant.id as string;

    const proj = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: `Intake Proj ${suffix}` });
    expect(proj.status).toBe(201);
    const projectId = proj.body.id as string;

    const cfg = await request(app).get(
      `/public/intake/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(projectId)}/config`
    );
    expect(cfg.status).toBe(404);
    expect(String(cfg.body.error ?? '')).toMatch(/not available|Not found/i);
  });

  it('project from templateKey seeds board stages; on_create SLA sets deadline on new task', async () => {
    const suffix = randomUUID().slice(0, 8);
    const reg = await request(app)
      .post('/auth/register')
      .send({
        email: `sla_tpl_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'S',
        lastName: 'L',
        organizationName: `Org SLA Tpl ${suffix}`,
      });
    expect(reg.status).toBe(201);
    const token = reg.body.accessToken as string;
    const tenantId = reg.body.tenant.id as string;

    const proj = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        name: `PM Template ${suffix}`,
        templateKey: 'product_management',
        seedSampleTasks: true,
      });
    expect(proj.status).toBe(201);
    const projectId = proj.body.id as string;
    const boardId = proj.body.defaultBoardId as string;

    const boardRes = await request(app)
      .get(`/projects/${projectId}/boards/${boardId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(boardRes.status).toBe(200);
    expect(boardRes.body.templateKey).toBe('product_management');
    expect(boardRes.body.settings?.kanbanStages?.[0]).toBe('Discovery');

    const tasksList = await request(app)
      .get(`/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(tasksList.status).toBe(200);
    expect((tasksList.body.tasks as unknown[]).length).toBeGreaterThanOrEqual(1);

    const slaPatch = await request(app)
      .patch(`/projects/${projectId}/sla-policy`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ slaStartPolicy: 'on_create', slaDaysByPriority: { P3: 2 } });
    expect(slaPatch.status).toBe(200);

    const create = await request(app)
      .post(`/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        title: 'SLA on create check',
        priority: 'P3',
        status: 'Discovery',
      });
    expect(create.status).toBe(201);
    const taskId = create.body.id as string;

    const detail = await request(app)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(detail.status).toBe(200);
    expect(detail.body.task.slaDeadline).toBeTruthy();
  });

  it('public intake files tasks on publicIntake.targetBoardId when set', async () => {
    const suffix = randomUUID().slice(0, 8);
    const reg = await request(app)
      .post('/auth/register')
      .send({
        email: `intake_board_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'I',
        lastName: 'B',
        organizationName: `Org Intake Board ${suffix}`,
      });
    expect(reg.status).toBe(201);
    const tenantSlug = reg.body.tenant.slug as string;
    const token = reg.body.accessToken as string;
    const tenantId = reg.body.tenant.id as string;

    const proj = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: `Intake Board Proj ${suffix}` });
    expect(proj.status).toBe(201);
    const projectId = proj.body.id as string;

    const boardsRes = await request(app)
      .get(`/projects/${projectId}/boards`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(boardsRes.status).toBe(200);
    const firstBoardId = (boardsRes.body.boards as { id: string }[])[0]?.id;
    expect(firstBoardId).toBeTruthy();

    const second = await request(app)
      .post(`/projects/${projectId}/boards`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Feedback board', templateKey: 'default' });
    expect(second.status).toBe(201);
    const targetBoardId = second.body.id as string;

    const patch = await request(app)
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        publicIntake: {
          enabled: true,
          targetBoardId,
          requestTypes: [{ key: 'feedback', label: 'Feedback', defaultPriority: 'P3' }],
        },
      });
    expect(patch.status).toBe(200);

    const cfg = await request(app).get(
      `/public/intake/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(projectId)}/config`
    );
    expect(cfg.status).toBe(200);
    expect(cfg.body.intakeBoardName).toBe('Feedback board');

    const intake = await request(app)
      .post(`/public/intake/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(projectId)}`)
      .send({
        title: 'From intake',
        description: 'body',
        requestTypeKey: 'feedback',
        reporterEmail: `reporter_${suffix}@example.com`,
      });
    expect(intake.status).toBe(201);

    const onTarget = await request(app)
      .get(`/boards/${targetBoardId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(onTarget.status).toBe(200);
    const titles = (onTarget.body.tasks as { title: string }[]).map((t) => t.title);
    expect(titles.some((t) => t.includes('From intake'))).toBe(true);

    const onFirst = await request(app)
      .get(`/boards/${firstBoardId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(onFirst.status).toBe(200);
    const firstTitles = (onFirst.body.tasks as { title: string }[]).map((t) => t.title);
    expect(firstTitles.some((t) => t.includes('From intake'))).toBe(false);
  });
});
