import '../test/bootstrap.integration';
import request from 'supertest';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import { buildApp } from '../app';
import { sequelize } from '../models';
import { _resetImportRateLimit } from '../services/planLimits';

const run = process.env.DATABASE_URL ? describe : describe.skip;

function buildSampleWorkbook(): Buffer {
  const aoa = [
    ['Task', 'Category', 'Owner', 'Status', 'Priority', 'Due Date'],
    ['Define product requirements', 'Analysis', '', 'To Do', 'High', '2026-06-01'],
    ['Review existing repositories', 'Analysis', '', 'In Progress', 'High', '2026-06-10'],
    ['Setup VPS', 'Infrastructure', '', 'To Do', 'Medium', '6/30/2026'],
    ['', 'Empty', '', 'To Do', 'Low', null],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

run('Excel import (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  beforeEach(() => {
    _resetImportRateLimit();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('imports a workbook → creates a board + tasks; rejects bad mapping; supports undo', async () => {
    const suffix = randomUUID().slice(0, 8);
    const reg = await request(app)
      .post('/auth/register')
      .send({
        email: `imp_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'Imp',
        lastName: 'Orter',
        organizationName: `Import ${suffix}`,
      });
    expect(reg.status).toBe(201);
    const token = reg.body.accessToken as string;
    const tenantId = reg.body.tenant.id as string;

    const proj = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Import Project' });
    expect(proj.status).toBe(201);
    const projectId = proj.body.id as string;

    const wb = buildSampleWorkbook();
    const preview = await request(app)
      .post(`/projects/${projectId}/imports/excel/preview`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .attach('file', wb, 'sample.xlsx');
    expect(preview.status).toBe(201);
    expect(preview.body.sheets).toHaveLength(1);
    const sheet = preview.body.sheets[0];
    expect(sheet.headers).toEqual([
      'Task',
      'Category',
      'Owner',
      'Status',
      'Priority',
      'Due Date',
    ]);
    expect(sheet.rowCount).toBe(4);
    expect(sheet.suggestedMapping[0]).toBe('title');
    expect(sheet.suggestedMapping[3]).toBe('status');
    expect(sheet.suggestedMapping[4]).toBe('priority');
    expect(sheet.suggestedMapping[5]).toBe('dueDate');

    const badCommit = await request(app)
      .post(`/projects/${projectId}/imports/excel/commit`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        uploadId: preview.body.uploadId,
        sheetName: 'Sheet1',
        boardName: 'Sample import',
        mapping: ['skip', 'skip', 'skip', 'skip', 'skip', 'skip'],
        defaults: { priority: 'P3', status: 'Backlog' },
      });
    expect(badCommit.status).toBe(400);

    const commit = await request(app)
      .post(`/projects/${projectId}/imports/excel/commit`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        uploadId: preview.body.uploadId,
        sheetName: 'Sheet1',
        boardName: 'Sample import',
        mapping: sheet.suggestedMapping,
        defaults: { priority: 'P3', status: 'Backlog' },
        deriveStagesFromStatus: true,
      });
    expect(commit.status).toBe(201);
    expect(commit.body.taskCount).toBe(3); // 4 rows - 1 empty title
    expect(commit.body.skipped).toEqual([{ row: 5, reason: 'missing title' }]);
    expect(Array.isArray(commit.body.kanbanStages)).toBe(true);
    expect(commit.body.kanbanStages.length).toBeGreaterThanOrEqual(3);
    const boardId = commit.body.boardId as string;

    const tasksResp = await request(app)
      .get(`/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(tasksResp.status).toBe(200);
    expect(tasksResp.body.tasks).toHaveLength(3);
    expect(tasksResp.body.tasks[0].priority).toBeDefined();

    /** Undo within the 5-minute window: should remove the board AND its tasks (a "Main" board remains). */
    const undo = await request(app)
      .post(`/projects/${projectId}/boards/${boardId}/undo-import`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(undo.status).toBe(204);

    const after = await request(app)
      .get(`/projects/${projectId}/boards`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId);
    expect(after.status).toBe(200);
    expect(after.body.boards.find((b: { id: string }) => b.id === boardId)).toBeUndefined();
  });

  it('rejects an import when the row cap is exceeded', async () => {
    const suffix = randomUUID().slice(0, 8);
    const reg = await request(app)
      .post('/auth/register')
      .send({
        email: `cap_${suffix}@example.com`,
        password: 'CorrectHorseBattery99!',
        firstName: 'Cap',
        lastName: 'Test',
        organizationName: `Cap ${suffix}`,
      });
    expect(reg.status).toBe(201);
    const token = reg.body.accessToken as string;
    const tenantId = reg.body.tenant.id as string;

    const proj = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Cap Project' });
    expect(proj.status).toBe(201);
    const projectId = proj.body.id as string;

    /** Starter plan caps imports at 200 rows; build a 201-row sheet. */
    const aoa: unknown[][] = [['Task', 'Status']];
    for (let i = 0; i < 201; i += 1) aoa.push([`Task ${i + 1}`, 'Backlog']);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const preview = await request(app)
      .post(`/projects/${projectId}/imports/excel/preview`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .attach('file', buf, 'big.xlsx');
    expect(preview.status).toBe(201);

    const sheet = preview.body.sheets[0];
    const commit = await request(app)
      .post(`/projects/${projectId}/imports/excel/commit`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        uploadId: preview.body.uploadId,
        sheetName: 'Sheet1',
        boardName: 'Too many rows',
        mapping: sheet.suggestedMapping,
      });
    expect(commit.status).toBe(403);
    expect(commit.body.code).toBe('LIMIT_IMPORT_ROWS');
  });
});
