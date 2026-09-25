import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/colourised-brackets/');
});

const example = (page: import('@playwright/test').Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

test('colours brackets by nesting depth', async ({ page }) => {
  const block = example(page);
  await expect(block.locator('.scb-brackets-1')).toHaveCount(2);
  await expect(block.locator('.scb-brackets-2')).toHaveCount(2);
});

test('leaves brackets in strings with the normal colour', async ({ page }) => {
  const block = example(page, 2);
  await expect(block.locator('[class*="scb-brackets"]')).toHaveCount(0);
});

test('outlines a bracket and its partner on hover, with the pointer', async ({ page }) => {
  const block = example(page);
  const open = block.locator('.scb-brackets-1').first();
  const close = block.locator('.scb-brackets-1').last();
  await expect(open).not.toHaveClass(/scb-brackets-on/);
  await open.hover();
  await expect(open).toHaveClass(/scb-brackets-on/);
  await expect(close).toHaveClass(/scb-brackets-on/);
  await page.mouse.move(0, 0);
  await expect(open).not.toHaveClass(/scb-brackets-on/);
});

test('the outline appears instantly, with or without reduced motion', async ({ page }) => {
  const open = example(page).locator('.scb-brackets-1').first();
  await open.hover();
  expect(await open.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});
