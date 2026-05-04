import '../test/bootstrap.integration';
import request from 'supertest';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { buildApp } from '../app';
import { sequelize, TenantMembership, User } from '../models';
import { signAccessToken } from '../services/authService';

const run = process.env.DATABASE_URL ? describe : describe.skip;

function inviteTokenFromUrl(acceptUrl: string): string {
  const url = new URL(acceptUrl);
  return url.searchParams.get('token') ?? '';
}

async function createAdminTenant(app: ReturnType<typeof buildApp>, suffix: string) {
  const email = `admin_${suffix}@example.com`;
  const res = await request(app).post('/auth/register').send({
    email,
    password: 'CorrectHorseBattery99!',
    firstName: 'Admin',
    lastName: 'User',
    organizationName: `Org ${suffix}`,
  });
  expect(res.status).toBe(201);
  return {
    tenantId: res.body.tenant.id as string,
    accessToken: res.body.accessToken as string,
  };
}

run('Invitations acceptance hardening (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects accept when provided email does not match invite email', async () => {
    const suffix = randomUUID().slice(0, 8);
    const { tenantId, accessToken } = await createAdminTenant(app, suffix);

    const create = await request(app)
      .post('/invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Id', tenantId)
      .send({ email: `invitee_${suffix}@example.com`, membershipRole: 'EMPLOYEE' });
    expect(create.status).toBe(201);
    const token = inviteTokenFromUrl(create.body.acceptUrl as string);
    expect(token.length).toBeGreaterThan(20);

    const mismatch = await request(app).post('/public/invitations/accept').send({
      token,
      email: `wrong_${suffix}@example.com`,
      firstName: 'New',
      lastName: 'User',
      password: 'CorrectHorseBattery99!',
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.code).toBe('INVITE_EMAIL_MISMATCH');
  });

  it('requires sign-in for existing user, then allows authenticated accept', async () => {
    const suffix = randomUUID().slice(0, 8);
    const { tenantId, accessToken } = await createAdminTenant(app, suffix);
    const invitedEmail = `existing_${suffix}@example.com`;

    const create = await request(app)
      .post('/invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Id', tenantId)
      .send({ email: invitedEmail, membershipRole: 'EMPLOYEE' });
    expect(create.status).toBe(201);
    const token = inviteTokenFromUrl(create.body.acceptUrl as string);

    const existing = await User.create({
      email: invitedEmail,
      passwordHash: await bcrypt.hash('CorrectHorseBattery99!', 12),
      firstName: 'Existing',
      lastName: 'User',
    });

    const anonymous = await request(app).post('/public/invitations/accept').send({
      token,
      email: invitedEmail,
      firstName: 'Existing',
      lastName: 'User',
      password: '',
    });
    expect(anonymous.status).toBe(409);
    expect(anonymous.body.code).toBe('SIGN_IN_REQUIRED');

    const wrongUser = await User.create({
      email: `other_${suffix}@example.com`,
      passwordHash: await bcrypt.hash('CorrectHorseBattery99!', 12),
      firstName: 'Other',
      lastName: 'User',
    });
    const wrongToken = signAccessToken(wrongUser.id, tenantId);
    const wrongAccept = await request(app)
      .post('/invitations/accept-authenticated')
      .set('Authorization', `Bearer ${wrongToken}`)
      .send({ token });
    expect(wrongAccept.status).toBe(400);
    expect(wrongAccept.body.code).toBe('INVITE_EMAIL_MISMATCH');

    const authToken = signAccessToken(existing.id, tenantId);
    const accepted = await request(app)
      .post('/invitations/accept-authenticated')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ token });
    expect(accepted.status).toBe(200);
    expect(accepted.body.ok).toBe(true);

    const membership = await TenantMembership.findOne({
      where: { tenantId, userId: existing.id },
    });
    expect(membership).not.toBeNull();
  });
});
