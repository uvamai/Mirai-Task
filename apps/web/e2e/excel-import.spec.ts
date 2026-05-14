import path from 'path';
import { test, expect } from '@playwright/test';

/**
 * T17 Excel import smoke test. Requires:
 *  - E2E_EMAIL / E2E_PASSWORD for an Admin or Manager
 *  - E2E_IMPORT=1 to opt in (kept off by default so CI doesn't create boards on every run)
 */
const enabled =
  process.env.E2E_IMPORT === '1' &&
  Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const describeImport = enabled ? test.describe : test.describe.skip;

describeImport('Excel import wizard', () => {
  test('upload → map → confirm creates a new board with imported tasks', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app/);

    /** Open the first project listed on /app. */
    await page.getByRole('link', { name: /open/i }).first().click();
    await expect(page).toHaveURL(/\/app\/projects\//);

    await page.getByRole('button', { name: /import from excel/i }).click();
    const boardName = `Smoke import ${Date.now()}`;
    await page.getByPlaceholder(/sprint 1/i).fill(boardName);
    await page.setInputFiles('input[type="file"]', path.join(__dirname, 'fixtures', 'import-sample.csv'));

    await page.getByRole('button', { name: /next: map columns/i }).click();
    await expect(page.getByText(/spreadsheet column/i)).toBeVisible();

    await page.getByRole('button', { name: /next: review/i }).click();
    await expect(page.getByText(boardName)).toBeVisible();

    await page.getByRole('button', { name: /create board/i }).click();
    await expect(page.getByText(/created with/i)).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /open board/i }).click();
    /** ImportBanner appears on freshly-imported boards with the 5-min undo timer. */
    await expect(page.getByText(/imported \d+ tasks from/i)).toBeVisible();
  });
});
