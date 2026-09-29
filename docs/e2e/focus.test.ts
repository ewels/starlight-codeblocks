import { expect, type Locator, test } from '@playwright/test';
import { contrast, css, example, reduced } from './helpers.ts';

const filter = (line: Locator) => css(line, 'filter');
const opacity = (line: Locator) => css(line, 'opacity');

test.beforeEach(async ({ page }) => {
  await page.goto('./features/focus/');
});

test('blurs the lines outside the focus, and shows them all under the pointer', async ({ page }) => {
  const block = example(page);
  const out = block.locator('.ec-line.scb-focus-out').first();
  const focused = block.locator('.ec-line:not(.scb-focus-out)').first();
  expect(await filter(out)).toBe('blur(1.1px)');
  expect(await opacity(out)).toBe('0.48');
  expect(await filter(focused)).toBe('none');
  expect(await opacity(focused)).toBe('1');
  expect(await css(out, 'transitionDuration')).toBe(reduced() ? '0s' : '0.25s, 0.25s');

  await block.locator('pre').hover();
  await expect.poll(() => filter(out)).toBe('none');
  await expect.poll(() => opacity(out)).toBe('1');
  await page.mouse.move(0, 0);
  await expect.poll(() => filter(out)).toBe('blur(1.1px)');
});

test('shows every line when keyboard focus is in the block, with a visible focus ring', async ({ page }) => {
  const block = example(page);
  const code = block.locator('pre > code');
  await page
    .locator('.example')
    .first()
    .evaluate((el) => {
      const before = document.createElement('button');
      before.id = 'before-example';
      el.before(before);
    });
  await page.locator('#before-example').focus();
  await page.keyboard.press('Tab');
  await expect(code).toBeFocused();
  expect(await css(code, 'outlineStyle')).toBe('solid');
  const [ring, background] = await code.evaluate((el) => [
    getComputedStyle(el).outlineColor,
    getComputedStyle(el.parentElement as Element).backgroundColor,
  ]);
  expect(await contrast(page, ring, background)).toBeGreaterThanOrEqual(3);
  await expect.poll(() => filter(block.locator('.ec-line.scb-focus-out').first())).toBe('none');
});
