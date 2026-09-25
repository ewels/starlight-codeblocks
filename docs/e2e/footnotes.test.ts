import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/footnotes/');
});

const example = (page: import('@playwright/test').Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

test('a badge highlights its line and its note, and a click elsewhere clears it', async ({ page }) => {
  const block = example(page);
  const badge = block.getByRole('link', { name: 'Footnote 1', exact: true });
  const line = block.locator('.ec-line', { has: page.locator('[data-scb-fn="1"]') });
  const note = block.locator('.scb-footnotes li').first();
  await badge.click();
  await expect(line).toHaveClass(/scb-footnote-on/);
  await expect(note).toHaveClass(/scb-footnote-on/);
  const bar = await line.locator('.code').evaluate((el) => getComputedStyle(el).borderInlineStartColor);
  expect(bar).not.toBe('rgba(0, 0, 0, 0)');
  await page.locator('h1').click();
  await expect(line).not.toHaveClass(/scb-footnote-on/);
  await expect(note).not.toHaveClass(/scb-footnote-on/);
});

test('a note highlights its line, with the keyboard', async ({ page }) => {
  const block = example(page);
  await block.getByRole('link', { name: 'Footnote 2, for line 5' }).focus();
  await page.keyboard.press('Enter');
  await expect(block.locator('.ec-line.scb-footnote-on')).toContainText('@app.get("/health")');
  await expect(block.locator('.scb-footnotes li').nth(1)).toHaveClass(/scb-footnote-on/);
});

test('selecting a note scrolls its line into view', async ({ page }) => {
  const block = example(page, 1);
  const line = block.locator('.ec-line').filter({ hasText: 'log = logging' });
  await block.locator('.scb-footnotes').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 400));
  await block.locator('.scb-footnotes li').first().click();
  await expect(line).toBeInViewport();
});

test('the sticky list stays at the bottom of the window while the block is on screen', async ({ page }) => {
  const block = example(page, 1);
  await block.locator('.ec-line').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 100));
  const list = block.locator('.scb-footnotes');
  const box = await list.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - height)).toBeLessThan(2);
  const first = await example(page, 0)
    .locator('.scb-footnotes')
    .evaluate((el) => getComputedStyle(el).position);
  expect(first).toBe('static');
});

test('copying leaves the badges and notes out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await example(page).locator('.copy button').focus();
  await page.keyboard.press('Enter');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(
    'from flask import Flask\n\napp = Flask(__name__)\n\n@app.get("/health")\ndef health():\n    return {"ok": True}',
  );
});

test('the page jumps instead of scrolling smoothly under reduced motion', async ({ page }) => {
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  test.skip(!reduced, 'Only for the reduced-motion project.');
  const block = example(page, 1);
  await block.locator('.scb-footnotes').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 400));
  await block.locator('.scb-footnotes li').first().click();
  await expect(block.locator('.ec-line').filter({ hasText: 'log = logging' })).toBeInViewport({ timeout: 50 });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('a badge is a link to its note', async ({ page }) => {
    const block = example(page);
    await block.getByRole('link', { name: 'Footnote 1', exact: true }).click();
    const id = await block.locator('.scb-footnotes li').first().getAttribute('id');
    expect(page.url()).toContain(`#${id}`);
  });
});
