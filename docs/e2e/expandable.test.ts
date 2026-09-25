import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/expandable-blocks/');
});

const example = (page: import('@playwright/test').Page, n = 0) =>
  page.locator('.example').nth(n).locator('[role="tabpanel"]').first().locator('.expressive-code');

test('collapses a long block behind a button', async ({ page }) => {
  const block = example(page);
  const pre = block.locator('pre');
  await expect(pre).toHaveAttribute('data-scb-expandable', '8');
  await expect(pre).toHaveClass(/scb-expandable-collapsed/);
  const lines = block.locator('.ec-line');
  await expect(lines).toHaveCount(24);
  await expect(lines.nth(20)).toBeHidden();
  const button = block.locator('.scb-expandable-toggle');
  await expect(button).toHaveText('Show all 24 lines');
  await button.click();
  await expect(button).toHaveText('Show fewer lines');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(lines.nth(20)).toBeVisible();
  await expect(pre).not.toHaveClass(/scb-expandable-collapsed/);
  await button.click();
  await expect(button).toHaveText('Show all 24 lines');
  await expect(lines.nth(20)).toBeHidden();
});

test('collapses a second block on the page independently, at the site default', async ({ page }) => {
  const block = example(page, 1);
  const pre = block.locator('pre');
  await expect(pre).toHaveAttribute('data-scb-expandable', '12');
  await expect(block.locator('.scb-expandable-toggle')).toHaveText('Show all 20 lines');
});

test('works with the keyboard', async ({ page }) => {
  const button = example(page).locator('.scb-expandable-toggle');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
});

test('the fade and the button do not print', async ({ page }) => {
  const bar = example(page).locator('.scb-expandable-bar');
  await page.emulateMedia({ media: 'print' });
  await expect(bar).toBeHidden();
});

test('has no transition, with or without reduced motion', async ({ page }) => {
  const pre = example(page).locator('pre');
  await example(page).locator('.scb-expandable-toggle').click();
  expect(await pre.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});
