import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/side-by-side-annotations/');
});

const example = (page: import('@playwright/test').Page) =>
  page.locator('.example').first().locator('.pane').nth(1).locator('.expressive-code');

test('the notes are a column beside the code on a desktop, and a list under it on a phone', async ({
  page,
  isMobile,
}) => {
  const block = example(page);
  const code = await block.locator('figure').boundingBox();
  const notes = await block.locator('.scb-annotation-notes').boundingBox();
  if (isMobile) {
    expect(notes?.y).toBeGreaterThanOrEqual((code?.y ?? 0) + (code?.height ?? 0));
  } else {
    expect(notes?.x).toBeGreaterThan((code?.x ?? 0) + (code?.width ?? 0));
    expect(Math.abs((notes?.y ?? 0) - (code?.y ?? 0))).toBeLessThan(2);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the notes column sticks below the header while the block scrolls past', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone layout has no column.');
  const block = example(page);
  await block.locator('.ec-line').nth(16).scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 200));
  const notes = await block.locator('.scb-annotation-notes').boundingBox();
  const header = await page.locator('header.header').boundingBox();
  expect(notes?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
  expect(notes?.y).toBeLessThan((header?.height ?? 0) + 40);
});

test('the notes column stops sticking when it is taller than the space below the header', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The phone layout has no column.');
  await page.setViewportSize({ width: 1024, height: 260 });
  const block = page.locator('[data-scb-annotations]').first();
  await expect(block).toHaveClass(/scb-side-static/);
  expect(await block.locator('.scb-annotation-notes').evaluate((el) => getComputedStyle(el).position)).toBe('static');
});

test('hovering over a note highlights its line, and hovering over a line highlights its note', async ({ page }) => {
  const block = example(page);
  const note = block.locator('.scb-annotation-notes li').nth(1);
  const line = block.locator('.ec-line[data-scb-anno="2"]');
  await note.hover();
  await expect(line).toHaveClass(/scb-annotation-lit/);
  const bg = await line.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  await block.locator('.ec-line[data-scb-anno="3"]').hover();
  await expect(block.locator('.scb-annotation-notes li').nth(2)).toHaveClass(/scb-annotation-on/);
  await expect(line).not.toHaveClass(/scb-annotation-lit/);
});

test('focusing a note with the keyboard highlights its line', async ({ page }) => {
  const block = example(page);
  await block.locator('.scb-annotation-notes li').first().focus();
  await expect(block.locator('.ec-line[data-scb-anno="1"]')).toHaveClass(/scb-annotation-lit/);
  await page.keyboard.press('Tab');
  await expect(block.locator('.ec-line[data-scb-anno="2"]')).toHaveClass(/scb-annotation-lit/);
  const outline = await block
    .locator('.scb-annotation-notes li')
    .nth(1)
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
  await expect(block.locator('.ec-line[data-scb-anno="1"]')).not.toHaveClass(/scb-annotation-lit/);
});

test('the note border changes instantly under reduced motion', async ({ page }) => {
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const duration = await example(page)
    .locator('.scb-annotation-notes li')
    .first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toBe(reduced ? '0s' : '0.15s');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the layout still works', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The phone layout has no column.');
    const block = example(page);
    const code = await block.locator('figure').boundingBox();
    const notes = await block.locator('.scb-annotation-notes').boundingBox();
    expect(notes?.x).toBeGreaterThan((code?.x ?? 0) + (code?.width ?? 0));
  });
});

test('the code of the example fits its column on a desktop, without a scroll bar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'On a phone the code can scroll.');
  for (const width of [1024, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    const pre = example(page).locator('pre');
    const [scroll, client] = await pre.evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(scroll, `at ${width}px`).toBeLessThanOrEqual(client);
  }
});
