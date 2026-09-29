import { expect, type Page, test } from '@playwright/test';
import { example, reduced } from './helpers.ts';

const line = (page: Page, n: number) => page.locator(`#cfg-L${n}`);
const target = /scb-permalink-target/;

test('a click on a number selects its line, and Shift a range, without scrolling or history', async ({ page }) => {
  await page.goto('./features/line-permalinks/');
  const numbers = example(page).locator('a.scb-permalink');
  await numbers.nth(1).scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  const entries = await page.evaluate(() => history.length);
  await numbers.nth(1).click();
  await expect(line(page, 2)).toHaveClass(target);
  await expect(numbers.nth(1)).toHaveAttribute('aria-current', 'true');
  expect(new URL(page.url()).hash).toBe('#cfg-L2');
  expect(await page.evaluate(() => scrollY)).toBe(before);
  expect(await page.evaluate(() => history.length)).toBe(entries);

  await numbers.nth(3).click({ modifiers: ['Shift'] });
  expect(new URL(page.url()).hash).toBe('#cfg-L2-L4');
  for (const n of [2, 3, 4]) await expect(line(page, n)).toHaveClass(target);
  await expect(line(page, 1)).not.toHaveClass(target);
  await expect(line(page, 5)).not.toHaveClass(target);

  const text = await example(page)
    .locator('pre')
    .evaluate((pre) => {
      getSelection()?.selectAllChildren(pre);
      return getSelection()?.toString() ?? '';
    });
  expect(text).toContain('server:');
  expect(text).not.toMatch(/^1/m);

  // The hidden-lines marker and the callout arrow line up with the code after the numbers.
  const block = example(page, 2);
  const marker = await block.locator('.scb-hidden-marker span').boundingBox();
  const code = await block.locator('#server-L4 .code').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getClientRects()[0]?.left ?? 0;
  });
  expect(Math.abs((marker?.x ?? 0) - code)).toBeLessThan(1.5);
  const arrow = await block.locator('.scb-callout-bubble').evaluate((el) => {
    const after = getComputedStyle(el, '::after');
    return (
      el.getBoundingClientRect().left +
      el.clientLeft +
      Number.parseFloat(after.left) +
      Number.parseFloat(after.width) / 2
    );
  });
  const token = await block.locator('#server-L5 .code span', { hasText: 'listen' }).boundingBox();
  if (!token) throw new Error('No listen token');
  expect(Math.abs(arrow - (token.x + token.width / 2))).toBeLessThan(2);
});

test('works with the keyboard, with a focus ring round the number', async ({ page }) => {
  await page.goto('./features/line-permalinks/');
  const numbers = example(page).locator('a.scb-permalink');
  await numbers.nth(0).focus();
  const gap = await numbers.nth(0).evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const ringInner = el.getBoundingClientRect().right - 2 * Number.parseFloat(getComputedStyle(el).outlineWidth);
    return ringInner - range.getBoundingClientRect().right;
  });
  expect(gap).toBeGreaterThanOrEqual(1);
  await page.keyboard.press('Enter');
  await numbers.nth(2).focus();
  await page.keyboard.press('Shift+Enter');
  expect(new URL(page.url()).hash).toBe('#cfg-L1-L3');
  await expect(line(page, 3)).toHaveClass(target);
});

test('selects and scrolls to the lines in the address on load and when it changes', async ({ page }) => {
  await page.goto('./features/line-permalinks/#cfg-L6-L8');
  for (const n of [6, 7, 8]) await expect(line(page, n)).toHaveClass(target);
  // Under reduced motion the scroll is instant, not smooth.
  await expect(line(page, 6)).toBeInViewport(reduced() ? { timeout: 50 } : {});
  await page.evaluate(() => {
    location.hash = '#server-L1';
  });
  await expect(page.locator('#server-L1')).toHaveClass(target);
  await expect(page.locator('#server-L1')).toBeInViewport();
});
