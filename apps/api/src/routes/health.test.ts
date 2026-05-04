import express from 'express';
import request from 'supertest';
import { healthRouter } from './health';
import { sequelize } from '../models';

jest.mock('../models', () => ({
  sequelize: {
    authenticate: jest.fn(),
  },
}));

const mocked = sequelize as unknown as { authenticate: jest.Mock };

describe('GET /health', () => {
  function miniApp() {
    const app = express();
    app.use(healthRouter);
    return app;
  }

  it('returns ok when database is up', async () => {
    mocked.authenticate.mockResolvedValue(undefined);
    const res = await request(miniApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns 503 when database is down', async () => {
    mocked.authenticate.mockRejectedValue(new Error('down'));
    const res = await request(miniApp()).get('/health');
    expect(res.status).toBe(503);
  });
});
