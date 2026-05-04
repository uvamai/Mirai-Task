/**
 * Load before any module that imports `config/env`.
 * dotenv will not override keys already set in the environment.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-jwt-access-secret-min-32-chars!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-jwt-refresh-secret-min-32-chars!';
process.env.ALLOW_X_TENANT_ID = 'true';
process.env.BILLING_MODE = process.env.BILLING_MODE ?? 'mock';
