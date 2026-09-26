import { expect, type Page, test } from '@playwright/test';
import { render } from '../../packages/starlight-codeblocks/test/render.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/footnotes/');
});

// A block longer than the docs examples, so the badge and its note in the static list are never both
// on screen at once: no example shows this, the sticky one keeps the list on screen throughout.
async function longBlock(page: Page) {
  const lines = [
    '```py footnotes="static"',
    '# [!ref] Note about x.',
    'x = 1',
    ...Array.from({ length: 40 }, (_, i) => `y${i} = ${i}`),
    '```',
  ];
  const { html } = await render(lines.join('\n'));
  await page.evaluate((html) => {
    const box = document.createElement('div');
    box.id = 'long';
    box.innerHTML = html;
    document.querySelector('.sl-markdown-content')?.prepend(box);
    document.dispatchEvent(new Event('astro:page-load'));
  }, html);
  return page.locator('#long');
}

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

test('a badge describes itself with its note, and moves focus to the note and back', async ({ page }) => {
  const block = example(page);
  const badge = block.getByRole('link', { name: 'Footnote 1', exact: true });
  const note = block.locator('.scb-footnotes li').first();
  await expect(badge).toHaveAccessibleDescription(((await note.locator('span').textContent()) ?? '').trim());
  await badge.focus();
  await page.keyboard.press('Enter');
  await expect(note).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(note.locator('.scb-footnote-num')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(badge).toBeFocused();
});

test('the links in the list are at least 24 by 24 pixels', async ({ page }) => {
  for (const link of await example(page).locator('.scb-footnote-num').all()) {
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
});

test('a focused badge does not stay under the sticky list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  const block = example(page, 1);
  const list = block.locator('.scb-footnotes');
  for (const badge of await block.locator('.scb-footnote-badge').all()) {
    const top = await badge.evaluate((el) => el.getBoundingClientRect().bottom + scrollY - innerHeight + 10);
    await page.evaluate((y) => scrollTo(0, y), top);
    await badge.focus();
    const [badgeBottom, listTop] = await Promise.all([
      badge.evaluate((el) => el.getBoundingClientRect().bottom),
      list.evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(badgeBottom).toBeLessThanOrEqual(listTop);
  }
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

test('selecting a badge scrolls its note into view when the list is off screen', async ({ page }) => {
  const block = await longBlock(page);
  const badge = block.getByRole('link', { name: 'Footnote 1', exact: true });
  await badge.scrollIntoViewIfNeeded();
  const note = block.locator('.scb-footnotes li').first();
  await expect(note).not.toBeInViewport();
  await badge.click();
  await expect(note).toBeInViewport();
  await expect(note).toHaveClass(/scb-footnote-on/);
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
