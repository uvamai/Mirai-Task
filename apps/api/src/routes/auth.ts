import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  loginSchema,
  logoutSchema,
  patchMePreferencesSchema,
  refreshSchema,
  registerSchema,
} from "../validation/auth";
import { UniqueConstraintError } from "sequelize";
import {
  loginUser,
  logout,
  PasswordPolicyError,
  refreshTokens,
  registerUser,
} from "../services/authService";
import { authenticateJwt, loadMembership } from "../middleware/auth";
import {
  User,
  TenantSubscription,
  SubscriptionPlan,
  TenantUsage,
  Tenant,
  TenantMembership,
} from "../models";
import { env } from "../config/env";
import { logger } from "../logger";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please try again shortly." },
});

authRouter.post("/auth/register", authLimiter, async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    res
      .status(400)
      .json({ error: "Validation failed", details: error.details });
    return;
  }
  try {
    const { user, tenant, tokens } = await registerUser(value);
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresInSeconds,
    });
  } catch (e) {
    if (e instanceof PasswordPolicyError) {
      res.status(400).json({ error: e.message });
      return;
    }
    if (e instanceof UniqueConstraintError) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    logger.error("register failed", { err: e, requestId: req.requestId });
    res.status(500).json({ error: "Registration failed" });
  }
});

authRouter.post("/auth/login", authLimiter, async (req, res) => {
  const { error, value } = loginSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    res
      .status(400)
      .json({ error: "Validation failed", details: error.details });
    return;
  }
  try {
    const { user, tenantId, tokens } = await loginUser(value);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tenantId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresInSeconds,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Invalid credentials") {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (e instanceof Error && e.message === "Invalid tenant for user") {
      res.status(403).json({ error: e.message });
      return;
    }
    if (e instanceof Error && e.message === "Account is deactivated") {
      res.status(403).json({ error: e.message, code: "ACCOUNT_DEACTIVATED" });
      return;
    }
    logger.error("login failed", { err: e, requestId: req.requestId });
    res.status(500).json({ error: "Login failed" });
  }
});

authRouter.post("/auth/refresh", authLimiter, async (req, res) => {
  const { error, value } = refreshSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    res
      .status(400)
      .json({ error: "Validation failed", details: error.details });
    return;
  }
  try {
    const tokens = await refreshTokens(value.refreshToken);
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresInSeconds,
    });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

authRouter.post("/auth/logout", authLimiter, async (req, res) => {
  const { error, value } = logoutSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    res
      .status(400)
      .json({ error: "Validation failed", details: error.details });
    return;
  }
  await logout(value.refreshToken);
  res.status(204).send();
});

authRouter.get(
  "/auth/me",
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    if (!req.userId || !req.tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await User.findByPk(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const tenant = await Tenant.findByPk(req.tenantId);
    const subscription = await TenantSubscription.findOne({
      where: { tenantId: req.tenantId },
      order: [["createdAt", "DESC"]],
    });
    let plan: SubscriptionPlan | null = null;
    if (subscription) {
      plan = await SubscriptionPlan.findByPk(subscription.planId);
    }
    const usage = await TenantUsage.findByPk(req.tenantId);

    const adminTenant = await Tenant.findOne({
      where: { slug: env.globalAdminTenantSlug },
    });
    let isGlobalAdmin = false;
    if (adminTenant) {
      const superAdminCheck = await TenantMembership.findOne({
        where: { userId: req.userId, tenantId: adminTenant.id, role: "ADMIN" },
      });
      isGlobalAdmin = !!superAdminCheck;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
          }
        : null,
      membership: { role: req.membership?.role },
      isGlobalAdmin,
      subscription: subscription
        ? {
            status: subscription.status,
            planCode: plan?.code,
            planDisplayName: plan?.displayName,
            maxProjects: plan?.maxProjects,
            maxSeats: plan?.maxSeats,
          }
        : null,
      usage: usage
        ? { projectCount: usage.projectCount, seatCount: usage.seatCount }
        : { projectCount: 0, seatCount: 0 },
      preferences: req.membership?.preferences ?? {},
    });
  },
);

authRouter.patch(
  "/auth/me/preferences",
  authenticateJwt,
  loadMembership,
  async (req, res) => {
    const { error, value } = patchMePreferencesSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      res
        .status(400)
        .json({ error: "Validation failed", details: error.details });
      return;
    }
    const m = req.membership;
    if (!m) {
      res.status(403).json({ error: "No membership" });
      return;
    }
    m.preferences = { ...(m.preferences ?? {}), ...value.preferences };
    await m.save();
    res.json({ preferences: m.preferences });
  },
);
