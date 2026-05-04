import '../test/bootstrap.integration';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { buildApp } from '../app';
import { sequelize, Tenant, TenantMembership, User, RefreshToken, SubscriptionPlan, TenantSubscription } from '../models';
import { env } from '../config/env';
import { signAccessToken } from '../services/authService';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Global admin portal routes (integration)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  async function createTenantWithAdminSlug() {
    const slug = env.globalAdminTenantSlug;
    let tenant = await Tenant.findOne({ where: { slug } });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Global Admin Tenant',
        slug,
        billingEmail: `admin-${randomUUID().slice(0, 6)}@example.com`,
        status: 'active',
        settings: {},
      });
    }
    return tenant;
  }

  async function createUserWithMembership(tenantId: string, role: 'ADMIN' | 'EMPLOYEE', emailPrefix: string) {
    const user = await User.create({
      email: `${emailPrefix}-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash: await bcrypt.hash('CorrectHorseBattery99!', 12),
      firstName: 'Test',
      lastName: 'User',
    });
    await TenantMembership.create({ tenantId, userId: user.id, role });
    return user;
  }

  it('allows global admin and rejects non-global-admin for dashboard', async () => {
    const adminTenant = await createTenantWithAdminSlug();
    const admin = await createUserWithMembership(adminTenant.id, 'ADMIN', 'ga');
    const nonAdmin = await createUserWithMembership(adminTenant.id, 'EMPLOYEE', 'na');

    const ok = await request(app)
      .get('/global-admin/dashboard')
      .set('Authorization', `Bearer ${signAccessToken(admin.id, adminTenant.id)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.totals).toBeDefined();

    const denied = await request(app)
      .get('/global-admin/dashboard')
      .set('Authorization', `Bearer ${signAccessToken(nonAdmin.id, adminTenant.id)}`);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('GLOBAL_ADMIN_REQUIRED');
  });

  it('deactivates user login immediately and revokes refresh tokens', async () => {
    const adminTenant = await createTenantWithAdminSlug();
    const admin = await createUserWithMembership(adminTenant.id, 'ADMIN', 'ga2');

    const loginTenant = await Tenant.create({
      name: `Login Tenant ${randomUUID().slice(0, 5)}`,
      slug: `login-tenant-${randomUUID().slice(0, 5)}`,
      billingEmail: `billing-${randomUUID().slice(0, 5)}@example.com`,
      status: 'active',
      settings: {},
    });
    const targetUser = await createUserWithMembership(loginTenant.id, 'EMPLOYEE', 'target');

    // Ensure a latest subscription row exists for tenant.
    const starter = await SubscriptionPlan.findOne({ where: { code: 'starter' } });
    if (starter) {
      await TenantSubscription.create({
        tenantId: loginTenant.id,
        planId: starter.id,
        status: 'active',
      });
    }

    const loginRes = await request(app).post('/auth/login').send({
      email: targetUser.email,
      password: 'CorrectHorseBattery99!',
      tenantId: loginTenant.id,
    });
    expect(loginRes.status).toBe(200);
    expect(await RefreshToken.count({ where: { userId: targetUser.id } })).toBeGreaterThan(0);

    const deactivate = await request(app)
      .patch(`/global-admin/users/${targetUser.id}/login-status`)
      .set('Authorization', `Bearer ${signAccessToken(admin.id, adminTenant.id)}`)
      .send({ isLoginActive: false });
    expect(deactivate.status).toBe(200);
    expect(await RefreshToken.count({ where: { userId: targetUser.id } })).toBe(0);

    const blockedLogin = await request(app).post('/auth/login').send({
      email: targetUser.email,
      password: 'CorrectHorseBattery99!',
      tenantId: loginTenant.id,
    });
    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.code).toBe('ACCOUNT_DEACTIVATED');
  });
});
