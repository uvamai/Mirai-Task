import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { env } from '../config/env';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import { TenantInvitation, User } from '../models';
import {
  acceptTenantInvitation,
  acceptTenantInvitationForUser,
  acceptUrlFromRawToken,
  createTenantInvitation,
  getTenantInvitationPreview,
  InviteEmailMismatchError,
  InviteSignInRequiredError,
  PasswordPolicyError,
  PlanLimitError,
  revokeTenantInvitation,
  rotateTenantInvitationToken,
} from '../services/invitationService';
import { logger } from '../logger';

const acceptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const inviteCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.inviteCreateMaxPerHour,
  standardHeaders: true,
  legacyHeaders: false,
});

const createBody = Joi.object({
  email: Joi.string().email().max(320).required(),
  membershipRole: Joi.string().valid('EMPLOYEE', 'MANAGER').default('EMPLOYEE'),
});

const acceptBody = Joi.object({
  token: Joi.string().min(20).max(512).required(),
  email: Joi.string().email().max(320).required(),
  password: Joi.string().allow('').max(256),
  firstName: Joi.string().min(1).max(120).required(),
  lastName: Joi.string().min(1).max(120).required(),
});

const acceptAuthBody = Joi.object({
  token: Joi.string().min(20).max(512).required(),
});

export const invitationsPublicRouter = Router();

invitationsPublicRouter.get('/public/invitations/preview', async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }
  try {
    const out = await getTenantInvitationPreview({ token });
    res.json(out);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('Invalid') || msg.includes('expired')) {
      res.status(400).json({ error: msg });
      return;
    }
    logger.error('invitation preview failed', { err: e, requestId: req.requestId });
    res.status(500).json({ error: 'Could not load invitation' });
  }
});

invitationsPublicRouter.post('/public/invitations/accept', acceptLimiter, async (req, res) => {
  const { error, value } = acceptBody.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  try {
    const out = await acceptTenantInvitation({
      token: value.token,
      email: value.email,
      password: value.password ?? '',
      firstName: value.firstName,
      lastName: value.lastName,
    });
    res.json({ ok: true, userId: out.userId, tenantId: out.tenantId });
  } catch (e) {
    if (e instanceof InviteEmailMismatchError) {
      res.status(400).json({ error: e.message, code: 'INVITE_EMAIL_MISMATCH' });
      return;
    }
    if (e instanceof InviteSignInRequiredError) {
      res.status(409).json({ error: e.message, code: 'SIGN_IN_REQUIRED' });
      return;
    }
    if (e instanceof PasswordPolicyError) {
      res.status(400).json({ error: e.message });
      return;
    }
    const msg = (e as Error).message;
    if (msg.includes('Invalid') || msg.includes('expired')) {
      res.status(400).json({ error: msg });
      return;
    }
    if (msg.includes('Already')) {
      res.status(409).json({ error: msg });
      return;
    }
    logger.error('accept invitation failed', { err: e, requestId: req.requestId });
    res.status(500).json({ error: 'Could not accept invitation' });
  }
});

invitationsPublicRouter.post(
  '/invitations/accept-authenticated',
  authenticateJwt,
  async (req, res) => {
    const { error, value } = acceptAuthBody.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await User.findByPk(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    try {
      const out = await acceptTenantInvitationForUser({
        token: value.token,
        userId: req.userId,
        userEmail: user.email,
      });
      res.json({ ok: true, userId: out.userId, tenantId: out.tenantId });
    } catch (e) {
      if (e instanceof InviteEmailMismatchError) {
        res.status(400).json({ error: e.message, code: 'INVITE_EMAIL_MISMATCH' });
        return;
      }
      const msg = (e as Error).message;
      if (msg.includes('Invalid') || msg.includes('expired')) {
        res.status(400).json({ error: msg });
        return;
      }
      if (msg.includes('Already')) {
        res.status(409).json({ error: msg });
        return;
      }
      logger.error('accept invitation authenticated failed', { err: e, requestId: req.requestId });
      res.status(500).json({ error: 'Could not accept invitation' });
    }
  }
);

export const invitationsAdminRouter = Router();

invitationsAdminRouter.get('/invitations', authenticateJwt, loadMembership, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.tenantId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  const rows = await TenantInvitation.findAll({
    where: { tenantId: req.tenantId },
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  res.json({
    invitations: rows.map((r) => ({
      id: r.id,
      email: r.email,
      membershipRole: r.membershipRole,
      expiresAt: r.expiresAt,
      acceptedAt: r.acceptedAt,
      createdAt: r.createdAt,
    })),
  });
});

invitationsAdminRouter.post(
  '/invitations',
  inviteCreateLimiter,
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = createBody.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    try {
      const created = await createTenantInvitation({
        tenantId: req.tenantId,
        email: value.email,
        membershipRole: value.membershipRole,
        invitedByUserId: req.userId,
        inviterMembershipRole: req.membership?.role ?? 'EMPLOYEE',
      });
      res.status(201).json({
        ok: true,
        invitation: {
          id: created.invitation.id,
          email: created.invitation.email,
          membershipRole: created.invitation.membershipRole,
          expiresAt: created.invitation.expiresAt,
        },
        acceptUrl: acceptUrlFromRawToken(created.rawToken),
      });
    } catch (e) {
      if (e instanceof PlanLimitError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      const msg = (e as Error).message;
      if (
        msg.includes('Cannot invite') ||
        msg.includes('already') ||
        msg.includes('Too many pending') ||
        msg.includes('Only tenant administrators') ||
        msg.includes('Organization policy does not allow')
      ) {
        const code = (e as Error & { code?: string }).code;
        res.status(code === 'ORG_POLICY_INVITE' || code === 'ORG_POLICY_INVITE_ROLE' ? 403 : 400).json({
          error: msg,
          ...(code ? { code } : {}),
        });
        return;
      }
      logger.error('create invitation failed', { err: e, requestId: req.requestId });
      res.status(500).json({ error: 'Could not create invitation' });
    }
  }
);

invitationsAdminRouter.post(
  '/invitations/:id/rotate',
  inviteCreateLimiter,
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    if (!req.tenantId || !req.userId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    try {
      const out = await rotateTenantInvitationToken({
        tenantId: req.tenantId,
        invitationId: req.params.id,
        invitedByUserId: req.userId,
        inviterMembershipRole: req.membership?.role ?? 'EMPLOYEE',
      });
      res.json({ acceptUrl: out.acceptUrl });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('not found') || msg.includes('already accepted')) {
        res.status(404).json({ error: msg });
        return;
      }
      if (msg.includes('Organization policy') || msg.includes('Only tenant')) {
        res.status(403).json({ error: msg });
        return;
      }
      logger.error('rotate invitation failed', { err: e, requestId: req.requestId });
      res.status(500).json({ error: 'Could not rotate invitation' });
    }
  }
);

invitationsAdminRouter.delete(
  '/invitations/:id',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    if (!req.tenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    const ok = await revokeTenantInvitation({ tenantId: req.tenantId, invitationId: req.params.id });
    if (!ok) {
      res.status(404).json({ error: 'Invitation not found or already accepted' });
      return;
    }
    res.status(204).send();
  }
);
