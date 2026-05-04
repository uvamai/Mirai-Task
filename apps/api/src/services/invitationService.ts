import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import type { MembershipRole } from '../models/TenantMembership';
import {
  EmployeeProfile,
  sequelize,
  Tenant,
  TenantInvitation,
  TenantMembership,
  User,
} from '../models';
import { assertCanAddEmployeeSeat, syncSeatCount } from './planLimits';
import { assertPasswordPolicy } from './passwordPolicy';
import { sendTenantInvitationEmail } from './mail';
import { env } from '../config/env';
import { logger } from '../logger';
import { assertInviteRoleWithinPolicy, assertMembershipMayInviteTenant, resolveOrgPolicies } from './orgPolicies';

const BCRYPT_ROUNDS = 12;
const INVITE_TTL_MS = 7 * 86400_000;

export class InviteEmailMismatchError extends Error {}
export class InviteSignInRequiredError extends Error {}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function maskEmail(email: string): string {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

async function findOpenInvitationByToken(
  rawToken: string,
  options?: { transaction?: unknown; lock?: unknown }
) {
  const tokenHash = hashInviteToken(rawToken.trim());
  const inv = await TenantInvitation.findOne({
    where: { tokenHash, acceptedAt: { [Op.is]: null } },
    ...(options?.transaction ? { transaction: options.transaction } : {}),
    ...(options?.lock ? { lock: options.lock } : {}),
  } as never);
  if (!inv || new Date(inv.expiresAt).getTime() < Date.now()) {
    throw new Error('Invalid or expired invitation');
  }
  return inv;
}

export async function getTenantInvitationPreview(input: {
  token: string;
}): Promise<{ tenantName: string; invitedEmailMasked: string; invitedEmailDomain: string }> {
  const inv = await findOpenInvitationByToken(input.token);
  const tenant = await Tenant.findByPk(inv.tenantId);
  return {
    tenantName: tenant?.name ?? 'Organization',
    invitedEmailMasked: maskEmail(inv.email),
    invitedEmailDomain: normalizeEmail(inv.email).split('@')[1] ?? '',
  };
}

export function hashInviteToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export async function createTenantInvitation(input: {
  tenantId: string;
  email: string;
  membershipRole: MembershipRole;
  invitedByUserId: string;
  inviterMembershipRole: MembershipRole | string;
}): Promise<{ rawToken: string; invitation: TenantInvitation }> {
  const email = normalizeEmail(input.email);
  if (input.membershipRole === 'ADMIN') {
    throw new Error('Cannot invite as ADMIN');
  }
  const tenantPol = await Tenant.findByPk(input.tenantId);
  if (!tenantPol) {
    throw new Error('Tenant not found');
  }
  const policies = resolveOrgPolicies(tenantPol.settings);
  assertMembershipMayInviteTenant(input.inviterMembershipRole, policies);
  assertInviteRoleWithinPolicy(input.membershipRole, policies);
  await assertCanAddEmployeeSeat(input.tenantId);

  const pending = await TenantInvitation.count({
    where: { tenantId: input.tenantId, acceptedAt: { [Op.is]: null } },
  });
  if (pending >= env.maxPendingInvitesPerTenant) {
    throw new Error('Too many pending invitations; revoke some or raise the limit with your administrator');
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    const anyTm = await TenantMembership.findOne({ where: { userId: existingUser.id } });
    if (anyTm && anyTm.tenantId !== input.tenantId) {
      throw new Error('This email is already registered to another organization');
    }
    const tm = await TenantMembership.findOne({
      where: { tenantId: input.tenantId, userId: existingUser.id },
    });
    if (tm) {
      throw new Error('User is already a member of this organization');
    }
  }

  await TenantInvitation.destroy({
    where: { tenantId: input.tenantId, email, acceptedAt: { [Op.is]: null } },
  });

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invitation = await TenantInvitation.create({
    tenantId: input.tenantId,
    email,
    membershipRole: input.membershipRole,
    tokenHash,
    invitedByUserId: input.invitedByUserId,
    expiresAt,
  });

  const tenant = tenantPol;
  const base = env.publicWebUrl.replace(/\/$/, '');
  const acceptUrl = `${base}/accept-invite?token=${encodeURIComponent(rawToken)}`;
  await sendTenantInvitationEmail({
    to: email,
    acceptUrl,
    organizationName: tenant?.name ?? 'Organization',
  }).catch((err: unknown) => logger.warn('invitation mail skipped', { err }));

  return { rawToken, invitation };
}

function buildAcceptUrl(rawToken: string): string {
  const base = env.publicWebUrl.replace(/\/$/, '');
  return `${base}/accept-invite?token=${encodeURIComponent(rawToken)}`;
}

export function acceptUrlFromRawToken(rawToken: string): string {
  return buildAcceptUrl(rawToken);
}

export async function rotateTenantInvitationToken(input: {
  tenantId: string;
  invitationId: string;
  invitedByUserId: string;
  inviterMembershipRole: MembershipRole | string;
}): Promise<{ rawToken: string; acceptUrl: string }> {
  const inv = await TenantInvitation.findOne({
    where: { id: input.invitationId, tenantId: input.tenantId, acceptedAt: { [Op.is]: null } },
  });
  if (!inv) {
    throw new Error('Invitation not found or already accepted');
  }
  const tenantPol = await Tenant.findByPk(input.tenantId);
  if (!tenantPol) {
    throw new Error('Tenant not found');
  }
  const policies = resolveOrgPolicies(tenantPol.settings);
  assertMembershipMayInviteTenant(input.inviterMembershipRole, policies);
  assertInviteRoleWithinPolicy(inv.membershipRole as MembershipRole, policies);

  const rawToken = randomBytes(32).toString('hex');
  inv.tokenHash = hashInviteToken(rawToken);
  inv.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  inv.invitedByUserId = input.invitedByUserId;
  await inv.save();

  const tenant = tenantPol;
  const acceptUrl = buildAcceptUrl(rawToken);
  await sendTenantInvitationEmail({
    to: inv.email,
    acceptUrl,
    organizationName: tenant?.name ?? 'Organization',
  }).catch((err: unknown) => logger.warn('invitation mail skipped', { err }));

  return { rawToken, acceptUrl };
}

export async function revokeTenantInvitation(input: {
  tenantId: string;
  invitationId: string;
}): Promise<boolean> {
  const n = await TenantInvitation.destroy({
    where: { id: input.invitationId, tenantId: input.tenantId, acceptedAt: { [Op.is]: null } },
  });
  return n > 0;
}

export async function acceptTenantInvitation(input: {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ userId: string; tenantId: string }> {
  const inv = await findOpenInvitationByToken(input.token);
  if (normalizeEmail(input.email) !== normalizeEmail(inv.email)) {
    throw new InviteEmailMismatchError('Email does not match invitation');
  }

  const existingPre = await User.findOne({ where: { email: inv.email } });
  if (existingPre) {
    throw new InviteSignInRequiredError('This email already has an account. Sign in to accept the invitation.');
  }
  assertPasswordPolicy(input.password);

  const result = await sequelize.transaction(async (t) => {
    const txInv = await findOpenInvitationByToken(input.token, { transaction: t, lock: t.LOCK.UPDATE });
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await User.create(
      {
        email: txInv.email,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
      },
      { transaction: t }
    );
    await TenantMembership.create(
      {
        userId: user.id,
        tenantId: txInv.tenantId,
        role: txInv.membershipRole as MembershipRole,
      },
      { transaction: t }
    );
    await EmployeeProfile.create(
      { tenantId: txInv.tenantId, userId: user.id, metadata: {} },
      { transaction: t }
    );
    txInv.acceptedAt = new Date();
    txInv.acceptedUserId = user.id;
    await txInv.save({ transaction: t });
    return { userId: user.id, tenantId: txInv.tenantId };
  });

  await syncSeatCount(result.tenantId);
  return result;
}

export async function acceptTenantInvitationForUser(input: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<{ userId: string; tenantId: string }> {
  const inv = await findOpenInvitationByToken(input.token);
  if (normalizeEmail(input.userEmail) !== normalizeEmail(inv.email)) {
    throw new InviteEmailMismatchError('Signed-in account email does not match invitation');
  }
  const result = await sequelize.transaction(async (t) => {
    const txInv = await findOpenInvitationByToken(input.token, { transaction: t, lock: t.LOCK.UPDATE });
    const tm = await TenantMembership.findOne({
      where: { tenantId: txInv.tenantId, userId: input.userId },
      transaction: t,
    });
    if (tm) {
      throw new Error('Already a member');
    }
    await TenantMembership.create(
      {
        userId: input.userId,
        tenantId: txInv.tenantId,
        role: txInv.membershipRole as MembershipRole,
      },
      { transaction: t }
    );
    await EmployeeProfile.findOrCreate({
      where: { tenantId: txInv.tenantId, userId: input.userId },
      defaults: { tenantId: txInv.tenantId, userId: input.userId, metadata: {} },
      transaction: t,
    });
    txInv.acceptedAt = new Date();
    txInv.acceptedUserId = input.userId;
    await txInv.save({ transaction: t });
    return { userId: input.userId, tenantId: txInv.tenantId };
  });
  await syncSeatCount(result.tenantId);
  return result;
}

export { PlanLimitError } from './planLimits';
export { PasswordPolicyError } from './passwordPolicy';
