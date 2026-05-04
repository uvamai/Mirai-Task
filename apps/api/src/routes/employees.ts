import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { UniqueConstraintError } from 'sequelize';
import { authenticateJwt, loadMembership, requireRole } from '../middleware/auth';
import { EmployeeProfile, TenantMembership, User, sequelize } from '../models';
import {
  assertCanAddEmployeeSeat,
  PlanLimitError,
  syncSeatCount,
} from '../services/planLimits';
import { assertPasswordPolicy, PasswordPolicyError } from '../services/passwordPolicy';
import { createEmployeeSchema, patchEmployeeSchema } from '../validation/employees';
import { logActivity } from '../services/auditService';
import { env } from '../config/env';
import { logger } from '../logger';

const BCRYPT_ROUNDS = 12;

function uploadForTenant(tenantId: string) {
  const dest = path.join(process.cwd(), env.storageDir, tenantId, 'employee-docs');
  return multer({
    limits: { fileSize: 5 * 1024 * 1024 },
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (_req, file, cb) => {
        const safe = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        cb(null, safe);
      },
    }),
  });
}

export const employeesRouter = Router();

employeesRouter.get('/employees', authenticateJwt, loadMembership, async (req, res) => {
  if (!req.tenantId) {
    res.status(400).json({ error: 'Tenant required' });
    return;
  }
  const rows = await EmployeeProfile.findAll({
    where: { tenantId: req.tenantId, deletedAt: { [Op.is]: null } },
    include: [{ model: User, attributes: ['id', 'email', 'firstName', 'lastName'] }],
    order: [['createdAt', 'ASC']],
  });
  res.json({
    employees: rows.map((e) => ({
      id: e.id,
      userId: e.userId,
      email: (e as unknown as { User?: User }).User?.email,
      firstName: (e as unknown as { User?: User }).User?.firstName,
      lastName: (e as unknown as { User?: User }).User?.lastName,
      department: e.department,
      phone: e.phone,
      managerId: e.managerId,
      avatarUrl: e.avatarUrl,
      metadata: e.metadata,
      createdAt: e.createdAt,
    })),
  });
});

employeesRouter.post(
  '/employees',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN'),
  async (req, res) => {
    const { error, value } = createEmployeeSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    try {
      assertPasswordPolicy(value.password);
      await assertCanAddEmployeeSeat(req.tenantId);
      const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
      const result = await sequelize.transaction(async (t) => {
        const user = await User.create(
          {
            email: value.email.toLowerCase(),
            passwordHash,
            firstName: value.firstName,
            lastName: value.lastName,
          },
          { transaction: t }
        );
        await TenantMembership.create(
          { userId: user.id, tenantId: req.tenantId!, role: value.role },
          { transaction: t }
        );
        const profile = await EmployeeProfile.create(
          {
            tenantId: req.tenantId!,
            userId: user.id,
            department: value.department || null,
            phone: value.phone || null,
            metadata: {},
          },
          { transaction: t }
        );
        return { user, profile };
      });
      await syncSeatCount(req.tenantId);
      await logActivity({
        tenantId: req.tenantId,
        actorUserId: req.userId,
        actorType: 'user',
        action: 'employee.create',
        entityType: 'employee_profile',
        entityId: result.profile.id,
        after: { userId: result.user.id, email: result.user.email },
        req,
      });
      res.status(201).json({
        id: result.profile.id,
        userId: result.user.id,
        email: result.user.email,
      });
    } catch (e) {
      if (e instanceof PasswordPolicyError) {
        res.status(400).json({ error: e.message });
        return;
      }
      if (e instanceof PlanLimitError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      if (e instanceof UniqueConstraintError) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
      logger.error('create employee failed', { err: e, requestId: req.requestId });
      res.status(500).json({ error: 'Could not create employee' });
    }
  }
);

employeesRouter.get('/employees/:profileId', authenticateJwt, loadMembership, async (req, res) => {
  const profile = await EmployeeProfile.findOne({
    where: { id: req.params.profileId, tenantId: req.tenantId!, deletedAt: { [Op.is]: null } },
    include: [{ model: User, attributes: ['id', 'email', 'firstName', 'lastName'] }],
  });
  if (!profile) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const u = (profile as unknown as { User?: User }).User;
  res.json({
    id: profile.id,
    userId: profile.userId,
    email: u?.email,
    firstName: u?.firstName,
    lastName: u?.lastName,
    department: profile.department,
    phone: profile.phone,
    managerId: profile.managerId,
    avatarUrl: profile.avatarUrl,
    metadata: profile.metadata,
  });
});

employeesRouter.patch(
  '/employees/:profileId',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    const { error, value } = patchEmployeeSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }
    const profile = await EmployeeProfile.findOne({
      where: { id: req.params.profileId, tenantId: req.tenantId!, deletedAt: { [Op.is]: null } },
    });
    if (!profile) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const before = { department: profile.department, phone: profile.phone, managerId: profile.managerId };
    if (value.department !== undefined) profile.department = value.department || null;
    if (value.phone !== undefined) profile.phone = value.phone || null;
    if (value.managerId !== undefined) profile.managerId = value.managerId;
    if (value.metadata !== undefined) profile.metadata = { ...profile.metadata, ...value.metadata };
    await profile.save();
    await logActivity({
      tenantId: req.tenantId!,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'employee.update',
      entityType: 'employee_profile',
      entityId: profile.id,
      before,
      after: { department: profile.department, phone: profile.phone, managerId: profile.managerId },
      req,
    });
    res.json({ id: profile.id });
  }
);

employeesRouter.delete(
  '/employees/:profileId',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN'),
  async (req, res) => {
    const profile = await EmployeeProfile.findOne({
      where: { id: req.params.profileId, tenantId: req.tenantId!, deletedAt: { [Op.is]: null } },
    });
    if (!profile) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    profile.deletedAt = new Date();
    await profile.save();
    await TenantMembership.destroy({ where: { userId: profile.userId, tenantId: req.tenantId! } });
    await syncSeatCount(req.tenantId!);
    await logActivity({
      tenantId: req.tenantId!,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'employee.delete',
      entityType: 'employee_profile',
      entityId: profile.id,
      req,
    });
    res.status(204).send();
  }
);

employeesRouter.post(
  '/employees/:profileId/documents',
  authenticateJwt,
  loadMembership,
  requireRole('ADMIN', 'MANAGER', 'EMPLOYEE'),
  (req, res, next) => {
    if (!req.tenantId) {
      res.status(400).json({ error: 'Tenant required' });
      return;
    }
    uploadForTenant(req.tenantId).single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: 'Upload failed', detail: String(err.message) });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const profile = await EmployeeProfile.findOne({
      where: { id: req.params.profileId, tenantId: req.tenantId!, deletedAt: { [Op.is]: null } },
    });
    if (!profile) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (req.membership?.role === 'EMPLOYEE' && profile.userId !== req.userId) {
      res.status(403).json({ error: 'Can only upload to own profile' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file field required' });
      return;
    }
    const relPath = path.relative(process.cwd(), file.path);
    const docs = Array.isArray(profile.metadata.documents)
      ? ([...profile.metadata.documents] as unknown[])
      : [];
    docs.push({ path: relPath, originalName: file.originalname, uploadedAt: new Date().toISOString() });
    profile.metadata = { ...profile.metadata, documents: docs };
    await profile.save();
    await logActivity({
      tenantId: req.tenantId!,
      actorUserId: req.userId!,
      actorType: 'user',
      action: 'employee.document.upload',
      entityType: 'employee_profile',
      entityId: profile.id,
      after: { path: relPath },
      req,
    });
    res.status(201).json({ path: relPath });
  }
);
