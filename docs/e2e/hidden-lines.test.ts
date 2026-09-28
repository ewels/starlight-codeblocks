import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/hidden-lines/');
});

const example = (page: import('@playwright/test').Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane.output').locator('.expressive-code');

test('hides lines behind a marker, until it is selected', async ({ page }) => {
  const block = example(page);
  const hidden = block.locator('.scb-hidden-line');
  await expect(hidden).toHaveCount(5);
  await expect(hidden.first()).toBeHidden();
  const marker = block.locator('.scb-hidden-marker').first();
  await expect(marker).toHaveText('3 hidden lines');
  await marker.click();
  await expect(marker).toHaveText('Hide 3 lines');
  await expect(marker).toHaveAttribute('aria-expanded', 'true');
  await expect(hidden.first()).toBeVisible();
});

test('clicking the dashed line, away from the badge, toggles the run', async ({ page }) => {
  // The second marker, not the first: the copy button overlaps the top-right corner of the block.
  const marker = example(page).locator('.scb-hidden-marker').nth(1);
  const box = await marker.boundingBox();
  if (!box) throw new Error('marker has no bounding box');
  await marker.click({ position: { x: box.width - 10, y: box.height / 2 } });
  await expect(marker).toHaveAttribute('aria-expanded', 'true');
});

test('a marker on the first line runs its rule to the end at rest', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the copy button always shows on touch screens');
  await page.mouse.move(0, 0);
  const markers = example(page).locator('.scb-hidden-marker');
  const end = (el: Element) => getComputedStyle(el, '::before').right;
  await expect(markers.first()).toHaveJSProperty('previousElementSibling', null);
  expect(await markers.first().evaluate(end)).toBe(await markers.nth(1).evaluate(end));
});

test('a hidden line that shows is dimmed, on a faint tint', async ({ page }) => {
  const block = example(page);
  await block.locator('.scb-hidden-marker').first().click();
  const code = block.locator('.scb-hidden-line').first().locator('.code');
  await expect(code).toHaveCSS('opacity', '0.75');
  const tint = await code.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(Number(tint.match(/[\d.]+(?=\)$)/)?.[0])).toBeCloseTo(0.04, 2);
});

test('the dashed rule is brighter under the pointer and fainter while its lines show', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones have no hover.');
  const marker = example(page).locator('.scb-hidden-marker').nth(1);
  const alpha = () =>
    marker.evaluate((el) => {
      const colour = getComputedStyle(el, '::before').borderTopColor;
      return Number(colour.match(/[\d.]+/g)?.[3] ?? 1);
    });
  await page.mouse.move(0, 0);
  const rest = await alpha();
  await marker.hover();
  expect(await alpha()).toBeGreaterThan(rest);
  await marker.click();
  await page.mouse.move(0, 0);
  expect(await alpha()).toBeLessThan(rest);
});

test('works with the keyboard', async ({ page }) => {
  const marker = example(page).locator('.scb-hidden-marker').first();
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(marker).toHaveAttribute('aria-expanded', 'true');
});

test('the title bar button shows every run at once', async ({ page }) => {
  const block = example(page);
  const toggle = block.locator('.scb-hidden-toggle');
  await expect(toggle).toHaveText('Show 5 hidden lines');
  await expect(toggle).not.toHaveAttribute('aria-pressed');
  await expect(block.locator('figure')).toHaveAccessibleName('summary.py');
  await toggle.click();
  await expect(toggle).toHaveText('Hide 5 lines');
  const hidden = block.locator('.scb-hidden-line');
  for (const line of await hidden.all()) await expect(line).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveText('Show 5 hidden lines');
  for (const line of await hidden.all()) await expect(line).toBeHidden();
});

test('copies hidden lines too', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await example(page).locator('.copy button').focus();
  await page.keyboard.press('Enter');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('import json');
  expect(copied).toContain('if key.startswith("_"):');
});

test('the marker changes state instantly, with or without reduced motion', async ({ page }) => {
  const marker = example(page).locator('.scb-hidden-marker').first();
  await marker.click();
  expect(await marker.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});

test('a manual selection leaves out the marker text', async ({ page }) => {
  const text = await example(page)
    .locator('pre code')
    .evaluate((code) => {
      getSelection()?.selectAllChildren(code);
      return getSelection()?.toString();
    });
  expect(text).not.toContain('hidden line');
  expect(text).toContain('config = json.loads(Path("config.json").read_text())');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('hidden lines stay hidden, and the markers do nothing', async ({ page }) => {
    const block = example(page);
    const hidden = block.locator('.scb-hidden-line');
    await expect(hidden.first()).toBeHidden();
    await block.locator('.scb-hidden-marker').first().click();
    await expect(hidden.first()).toBeHidden();
  });
  test('the title bar button is hidden', async ({ page }) => {
    await expect(example(page).locator('.scb-hidden-toggle')).toBeHidden();
  });
  test('a block with no title shows no empty title bar', async ({ page }) => {
    const untitled = example(page, 2);
    await expect(untitled.locator('.frame')).not.toHaveClass(/has-title/);
    await expect(untitled.locator('.header')).toBeHidden();
  });
});
