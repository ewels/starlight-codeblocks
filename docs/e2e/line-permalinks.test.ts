import { expect, type Page, test } from '@playwright/test';

const example = (page: Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');
const line = (page: Page, n: number) => page.locator(`#cfg-L${n}`);

test.beforeEach(async ({ page }) => {
  await page.goto('./features/line-permalinks/');
});

test('selecting a number highlights its line and changes the address, without scrolling', async ({ page }) => {
  const number = example(page).locator('a.scb-permalink', { hasText: '2' });
  await number.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  const entries = await page.evaluate(() => history.length);
  await number.click();
  await expect(line(page, 2)).toHaveClass(/scb-permalink-target/);
  await expect(number).toHaveAttribute('aria-current', 'true');
  expect(new URL(page.url()).hash).toBe('#cfg-L2');
  expect(await page.evaluate(() => scrollY)).toBe(before);
  expect(await page.evaluate(() => history.length)).toBe(entries);
});

test('Shift selects the range from the last number', async ({ page }) => {
  const numbers = example(page).locator('a.scb-permalink');
  await numbers.nth(1).click();
  await numbers.nth(3).click({ modifiers: ['Shift'] });
  expect(new URL(page.url()).hash).toBe('#cfg-L2-L4');
  for (const n of [2, 3, 4]) await expect(line(page, n)).toHaveClass(/scb-permalink-target/);
  await expect(line(page, 1)).not.toHaveClass(/scb-permalink-target/);
  await expect(line(page, 5)).not.toHaveClass(/scb-permalink-target/);
});

test('works with the keyboard', async ({ page }) => {
  const numbers = example(page).locator('a.scb-permalink');
  await numbers.nth(0).focus();
  await page.keyboard.press('Enter');
  await numbers.nth(2).focus();
  await page.keyboard.press('Shift+Enter');
  expect(new URL(page.url()).hash).toBe('#cfg-L1-L3');
  await expect(line(page, 3)).toHaveClass(/scb-permalink-target/);
});

test('highlights the lines in the address on load and scrolls to them', async ({ page }) => {
  await page.goto('./features/line-permalinks/#cfg-L6-L8');
  for (const n of [6, 7, 8]) await expect(line(page, n)).toHaveClass(/scb-permalink-target/);
  await expect(line(page, 6)).toBeInViewport();
});

test('follows changes to the address', async ({ page }) => {
  await page.evaluate(() => {
    location.hash = '#cfg-L5';
  });
  await expect(line(page, 5)).toHaveClass(/scb-permalink-target/);
});

test('a link to a hidden line opens its marker', async ({ page }) => {
  await page.goto('./features/line-permalinks/#server-L1');
  await expect(page.locator('#server-L1')).toBeVisible();
  await expect(page.locator('#server-L1')).toHaveClass(/scb-permalink-target/);
});

test('the hidden-lines marker and the callout arrow line up with the code after the numbers', async ({ page }) => {
  const block = example(page, 2);
  const marker = await block.locator('.scb-hidden-marker span').boundingBox();
  const code = await block.locator('#server-L4 .code').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getClientRects()[0]?.left ?? 0;
  });
  expect(Math.abs((marker?.x ?? 0) - code)).toBeLessThan(1.5);
  const arrow = await block.locator('.scb-callout').evaluate((el) => {
    const after = getComputedStyle(el, '::after');
    return el.getBoundingClientRect().left + Number.parseFloat(after.left) + Number.parseFloat(after.width) / 2;
  });
  const token = await block.locator('#server-L5 .code span', { hasText: 'listen' }).boundingBox();
  if (!token) throw new Error('No listen token');
  expect(Math.abs(arrow - (token.x + token.width / 2))).toBeLessThan(2);
});

test('line numbers are not in a manual copy', async ({ page }) => {
  const text = await example(page)
    .locator('pre')
    .evaluate((pre) => {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return selection?.toString() ?? '';
    });
  expect(text).toContain('server:');
  expect(text).not.toMatch(/^1/m);
});

test('without JavaScript, the numbers still link to their lines', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/line-permalinks/');
  await expect(example(page).locator('a.scb-permalink').first()).toHaveAttribute('href', '#cfg-L1');
  await context.close();
});
