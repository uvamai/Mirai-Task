import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { Op } from 'sequelize';
import { env } from '../config/env';
import {
  EmployeeProfile,
  RefreshToken,
  SubscriptionPlan,
  Tenant,
  TenantMembership,
  TenantSubscription,
  TenantUsage,
  User,
  sequelize,
} from '../models';
import { assertPasswordPolicy, PasswordPolicyError } from './passwordPolicy';
import { slugifyOrganizationName, uniqueSlugAttempt } from './slug';

const BCRYPT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

function accessExpiresInSeconds(): number {
  return env.accessTtlMin * 60;
}

export function signAccessToken(userId: string, tenantId: string): string {
  return jwt.sign({ sub: userId, tid: tenantId }, env.jwtAccessSecret, {
    expiresIn: `${env.accessTtlMin}m`,
  });
}

export function verifyAccessToken(token: string): { userId: string; tenantId: string } {
  const decoded = jwt.verify(token, env.jwtAccessSecret) as JwtPayload & { sub: string; tid: string };
  if (!decoded.sub || !decoded.tid) {
    throw new Error('Invalid token payload');
  }
  return { userId: decoded.sub, tenantId: decoded.tid };
}

async function issueTokens(userId: string, tenantId: string): Promise<TokenPair> {
  const accessToken = signAccessToken(userId, tenantId);
  const rawRefresh = randomBytes(48).toString('base64url');
  const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.refreshTtlDays);
  await RefreshToken.create({ userId, tenantId, tokenHash, expiresAt });
  return {
    accessToken,
    refreshToken: rawRefresh,
    expiresInSeconds: accessExpiresInSeconds(),
  };
}

async function pickDefaultPlan(): Promise<SubscriptionPlan> {
  const code = env.defaultSignupPlanCode;
  const plan = await SubscriptionPlan.findOne({ where: { code } });
  if (!plan) {
    throw new Error(`Subscription plan '${code}' not seeded`);
  }
  return plan;
}

async function resolveUniqueSlug(baseName: string): Promise<string> {
  const base = slugifyOrganizationName(baseName);
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    const existing = await Tenant.findOne({ where: { slug: candidate } });
    if (!existing) return candidate;
    candidate = uniqueSlugAttempt(base);
  }
  throw new Error('Could not allocate unique tenant slug');
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}): Promise<{ user: User; tenant: Tenant; tokens: TokenPair }> {
  assertPasswordPolicy(input.password);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const plan = await pickDefaultPlan();

  const result = await sequelize.transaction(async (t) => {
    const user = await User.create(
      {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      },
      { transaction: t }
    );
    const slug = await resolveUniqueSlug(input.organizationName);
    const tenant = await Tenant.create(
      {
        name: input.organizationName,
        slug,
        billingEmail: input.email.toLowerCase(),
        status: 'active',
        settings: {},
      },
      { transaction: t }
    );
    await TenantMembership.create(
      { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
      { transaction: t }
    );
    await TenantSubscription.create(
      {
        tenantId: tenant.id,
        planId: plan.id,
        status: env.billingMode === 'mock' ? 'active' : 'trialing',
        trialEndsAt: env.billingMode === 'mock' ? null : new Date(Date.now() + 14 * 86400_000),
      },
      { transaction: t }
    );
    await TenantUsage.create(
      {
        tenantId: tenant.id,
        projectCount: 0,
        seatCount: 1,
        updatedAt: new Date(),
      },
      { transaction: t }
    );
    await EmployeeProfile.create(
      { tenantId: tenant.id, userId: user.id, metadata: {} },
      { transaction: t }
    );
    return { user, tenant };
  });

  const tokens = await issueTokens(result.user.id, result.tenant.id);
  return { user: result.user, tenant: result.tenant, tokens };
}

export async function loginUser(input: {
  email: string;
  password: string;
  tenantId?: string;
}): Promise<{ user: User; tenantId: string; tokens: TokenPair }> {
  const user = await User.findOne({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.passwordHash) {
    throw new Error('Invalid credentials');
  }
  if (!user.isLoginActive) {
    throw new Error('Account is deactivated');
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new Error('Invalid credentials');
  }
  const memberships = await TenantMembership.findAll({
    where: { userId: user.id },
    order: [['createdAt', 'ASC']],
  });
  if (memberships.length === 0) {
    throw new Error('No tenant membership');
  }
  let tenantId = memberships[0].tenantId;
  if (input.tenantId) {
    const match = memberships.find((m) => m.tenantId === input.tenantId);
    if (!match) {
      throw new Error('Invalid tenant for user');
    }
    tenantId = input.tenantId;
  }
  await RefreshToken.destroy({
    where: {
      userId: user.id,
      expiresAt: { [Op.lt]: new Date() },
    },
  });
  const tokens = await issueTokens(user.id, tenantId);
  return { user, tenantId, tokens };
}

export async function refreshTokens(rawRefresh: string): Promise<TokenPair> {
  const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
  const row = await RefreshToken.findOne({ where: { tokenHash } });
  if (!row || row.expiresAt < new Date()) {
    throw new Error('Invalid refresh token');
  }
  const membership = await TenantMembership.findOne({
    where: { userId: row.userId, tenantId: row.tenantId },
  });
  if (!membership) {
    throw new Error('No membership');
  }
  const tenantId = row.tenantId;
  await row.destroy();
  return issueTokens(row.userId, tenantId);
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
  await RefreshToken.destroy({ where: { tokenHash } });
}

export { PasswordPolicyError };
