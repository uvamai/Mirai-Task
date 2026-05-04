import path from 'path';
import dotenv from 'dotenv';

const repoRootEnv = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: repoRootEnv });
dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: requireEnv('DATABASE_URL', 'postgres://mirai:mirai@localhost:55432/mirai_tasker'),
  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET', 'dev-access-secret-min-32-characters-long'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-min-32-characters-long'),
  accessTtlMin: Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 15),
  refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  billingMode: (process.env.BILLING_MODE ?? 'mock') as 'mock' | 'stripe',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  allowXTenantId: process.env.ALLOW_X_TENANT_ID === 'true',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  /** Public web origin for Stripe Checkout / Portal return URLs */
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173',
  socketEnabled: process.env.SOCKET_ENABLED === 'true',
  storageDir: process.env.STORAGE_DIR ?? 'storage',
  /** Plan code assigned on self-serve registration (must exist in subscription_plans) */
  defaultSignupPlanCode: process.env.DEFAULT_SIGNUP_PLAN_CODE ?? 'starter',
  /** When >0, periodically delete activity_logs older than this many days (all tenants). */
  activityLogRetentionDays: Math.max(0, Number(process.env.ACTIVITY_LOG_RETENTION_DAYS ?? 0)) || 0,
  /** Cloudflare Turnstile secret (optional). When set, public intake requires a token. */
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
  hcaptchaSecretKey: process.env.HCAPTCHA_SECRET_KEY,
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY,
  /** Max pending (unaccepted) invitations per tenant. */
  maxPendingInvitesPerTenant: Math.min(5000, Math.max(1, Number(process.env.MAX_PENDING_INVITES_PER_TENANT ?? 100))),
  inviteCreateMaxPerHour: Math.min(200, Math.max(5, Number(process.env.INVITE_CREATE_MAX_PER_HOUR ?? 30))),
  /** Tenant slug that grants platform-wide super-admin access to its ADMIN members. */
  globalAdminTenantSlug: process.env.GLOBAL_ADMIN_TENANT_SLUG ?? 'mirai-admin',
};

if (env.nodeEnv === 'production') {
  if (env.jwtAccessSecret.length < 32 || env.jwtRefreshSecret.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters in production');
  }
}
