import { test, expect } from '@playwright/test';

/**
 * Full-stack flows (T13). Requires Vite proxy to API (dev) or combined stack.
 * Set E2E_EMAIL and E2E_PASSWORD to run; entire describe is skipped otherwise.
 */
const creds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const describeAuth = creds ? test.describe : test.describe.skip;

describeAuth('authenticated flows', () => {
  test('login and land on app', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByRole('link', { name: /projects/i })).toBeVisible();
  });

  test('dashboard shows projects heading', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: /^projects$/i })).toBeVisible();
  });
});
