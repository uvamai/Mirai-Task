import { test, expect } from '@playwright/test';

/**
 * P2 — Invitations admin flow.
 * Requires an Admin/Manager E2E_EMAIL/E2E_PASSWORD and E2E_INVITES=1 to opt in
 * (the test creates a fresh invitation and then revokes it).
 */
const enabled =
  process.env.E2E_INVITES === '1' &&
  Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const describeInvites = enabled ? test.describe : test.describe.skip;

describeInvites('Invitations admin flow', () => {
  test('create → list shows new row → revoke removes it', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app/);

    await page.goto('/app/employees');
    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();

    const email = `e2e_invite_${Date.now()}@example.test`;
    await page.getByTestId('invite-email').fill(email);
    await page.getByTestId('invite-role').selectOption('EMPLOYEE');

    page.once('dialog', (d) => void d.accept());
    await page.getByTestId('invite-submit').click();

    const row = page.locator('[data-testid="invitation-row"]', { hasText: email });
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText(/pending/i)).toBeVisible();
    await expect(page.getByText(/shareable accept link/i)).toBeVisible();

    page.once('dialog', (d) => void d.accept());
    await row.getByRole('button', { name: /revoke/i }).click();

    await expect(row).toHaveCount(0, { timeout: 15000 });
  });
});
