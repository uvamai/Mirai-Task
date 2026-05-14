import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * P2 — Board drag-and-drop.
 *
 * dnd-kit (PointerSensor with `distance: 6` activation constraint) responds to
 * native mouse down/move/up. We drive it with Playwright `page.mouse.*` to drag
 * a card from its current column to another column on the same board.
 *
 * Gated by E2E_BOARD_DND=1 so CI can opt-out (the spec mutates board state).
 */
const enabled =
  process.env.E2E_BOARD_DND === '1' &&
  Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const describeDnd = enabled ? test.describe : test.describe.skip;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/app/);
}

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('No bounding box for locator');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragCardToColumn(page: Page, card: Locator, targetColumn: Locator) {
  const handle = card.getByTestId('board-card-drag-handle');
  const start = await centerOf(handle);
  const target = await centerOf(targetColumn);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  /** dnd-kit activates after 6px of movement. Step the move so PointerSensor
   *  registers activation and emits onDragOver events along the way. */
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const x = start.x + ((target.x - start.x) * i) / steps;
    const y = start.y + ((target.y - start.y) * i) / steps;
    await page.mouse.move(x, y, { steps: 2 });
  }
  await page.mouse.up();
}

describeDnd('Board drag-and-drop', () => {
  test('drag a card to a different column updates its status', async ({ page }) => {
    await login(page);

    /** Open the first project listed on the dashboard. */
    const firstProject = page.locator('[data-testid="project-link"]').first();
    await expect(firstProject).toBeVisible({ timeout: 15000 });
    await firstProject.click();

    await expect(page.getByTestId('board-column').first()).toBeVisible({ timeout: 15000 });

    const cards = page.getByTestId('board-card');
    const cardCount = await cards.count();
    test.skip(cardCount === 0, 'No cards on the first project board; cannot exercise DnD.');

    /** Pick a card whose status is NOT the last column, drag to last column. */
    const columns = page.getByTestId('board-column');
    const columnCount = await columns.count();
    test.skip(columnCount < 2, 'Board needs at least two columns to drag between.');

    const lastColumn = columns.nth(columnCount - 1);
    const lastColumnName = (await lastColumn.getAttribute('data-column')) ?? '';

    let pickedCard: Locator | null = null;
    let pickedKey = '';
    for (let i = 0; i < cardCount; i++) {
      const c = cards.nth(i);
      const status = (await c.getAttribute('data-task-status')) ?? '';
      if (status !== lastColumnName) {
        pickedCard = c;
        pickedKey = (await c.getAttribute('data-task-key')) ?? '';
        break;
      }
    }
    test.skip(!pickedCard || !pickedKey, 'All cards already in the last column.');

    await dragCardToColumn(page, pickedCard!, lastColumn);

    /** After server settles, the moved card should be a child of the last column. */
    const moved = lastColumn.locator(`[data-task-key="${pickedKey}"]`);
    await expect(moved).toBeVisible({ timeout: 10000 });
    await expect(moved).toHaveAttribute('data-task-status', lastColumnName);
  });
});
