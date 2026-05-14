import { test, expect } from '@playwright/test';

/**
 * P2 — Template project flow.
 * Creates a project with the first non-default board template, seeds sample
 * tasks, opens the resulting board, and asserts at least one card is visible.
 *
 * Gated by E2E_TEMPLATE_PROJECT=1 so CI runs that don't want side effects skip it.
 */
const enabled =
  process.env.E2E_TEMPLATE_PROJECT === '1' &&
  Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const describeTpl = enabled ? test.describe : test.describe.skip;

describeTpl('Template project flow', () => {
  test('create project from template with seeded samples → board has cards', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app$/);

    const templateSelect = page.getByTestId('project-template');
    await expect(templateSelect).toBeVisible();
    /** Pick the first option that isn't the "Blank board" default. */
    const options = await templateSelect.locator('option').elementHandles();
    let chosen: string | null = null;
    for (const opt of options) {
      const value = await opt.getAttribute('value');
      if (value && value !== 'default') {
        chosen = value;
        break;
      }
    }
    expect(chosen).not.toBeNull();
    await templateSelect.selectOption(chosen!);

    const projectName = `E2E Tpl ${Date.now()}`;
    await page.getByTestId('project-name').fill(projectName);
    await page.getByTestId('project-seed-samples').check();
    await page.getByTestId('create-project-submit').click();

    const link = page.locator(`[data-testid="project-link"][data-project-name="${projectName}"]`);
    await expect(link).toBeVisible({ timeout: 15000 });
    await link.click();
    await expect(page).toHaveURL(/\/app\/projects\//);

    /** Sample tasks render as board cards in the default board. */
    await expect(page.getByTestId('board-card').first()).toBeVisible({ timeout: 15000 });
    const cardCount = await page.getByTestId('board-card').count();
    expect(cardCount).toBeGreaterThan(0);
  });
});
