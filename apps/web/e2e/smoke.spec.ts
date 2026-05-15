import { test, expect } from '@playwright/test';

test('pricing page renders headline', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: /subscription plans/i })).toBeVisible();
});

test('landing page renders hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /SLA-aware Kanban/i })).toBeVisible();
});

test('login page renders sign in', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible();
});
