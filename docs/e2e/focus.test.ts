import { expect, type Locator, test } from '@playwright/test';

const filter = (line: Locator) => line.evaluate((el) => getComputedStyle(el).filter);
const opacity = (line: Locator) => line.evaluate((el) => getComputedStyle(el).opacity);

test.beforeEach(async ({ page }) => {
  await page.goto('./features/focus/');
});

const example = (page: import('@playwright/test').Page) =>
  page.locator('.example').first().locator('[role="tabpanel"]').first().locator('.expressive-code');

test('blurs the lines outside the focus', async ({ page }) => {
  const block = example(page);
  await expect(block.locator('.ec-line')).toHaveCount(10);
  await expect(block.locator('.ec-line.scb-focus-out')).toHaveCount(6);
  const out = block.locator('.ec-line.scb-focus-out').first();
  const focused = block.locator('.ec-line:not(.scb-focus-out)').first();
  expect(await filter(out)).toBe('blur(1.1px)');
  expect(await opacity(out)).toBe('0.48');
  expect(await filter(focused)).toBe('none');
  expect(await opacity(focused)).toBe('1');
});

test('shows every line when the pointer is over the block', async ({ page }) => {
  const block = example(page);
  const out = block.locator('.ec-line.scb-focus-out').first();
  await block.locator('pre').hover();
  await expect.poll(() => filter(out)).toBe('none');
  await expect.poll(() => opacity(out)).toBe('1');
  await page.mouse.move(0, 0);
  await expect.poll(() => filter(out)).toBe('blur(1.1px)');
});

test('shows every line when keyboard focus is in the block', async ({ page }) => {
  const block = example(page);
  const code = block.locator('pre > code');
  await expect(code).toHaveAttribute('tabindex', '0');
  await page.locator('.example').first().locator('[role="tab"]').first().focus();
  await page.keyboard.press('Tab');
  await expect(code).toBeFocused();
  expect(await code.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  await expect.poll(() => filter(block.locator('.ec-line.scb-focus-out').first())).toBe('none');
});

test('uses a transition only when the reader allows motion', async ({ page }, testInfo) => {
  const out = example(page).locator('.ec-line.scb-focus-out').first();
  const duration = await out.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toBe(testInfo.project.name === 'reduced-motion' ? '0s' : '0.25s, 0.25s');
});

test('copies the whole block', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const block = example(page);
  await block.locator('.copy button').focus();
  await page.keyboard.press('Enter');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split('\n')).toHaveLength(10);
  expect(copied).toContain("import { defineConfig } from './lib.js';");
});
