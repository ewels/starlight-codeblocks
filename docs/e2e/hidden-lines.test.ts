import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/hidden-lines/');
});

test('markers and the title bar button show hidden lines, with the pointer', async ({ page, isMobile }) => {
  const block = example(page);
  const markers = block.locator('.scb-hidden-marker');
  const hidden = block.locator('.scb-hidden-line');
  await page.mouse.move(0, 0);
  // The copy button always shows on touch screens, so the rule of a first-line marker stops short.
  if (!isMobile) {
    const end = (el: Element) => getComputedStyle(el, '::before').right;
    await expect(markers.first()).toHaveJSProperty('previousElementSibling', null);
    expect(await markers.first().evaluate(end)).toBe(await markers.nth(1).evaluate(end));
  }

  const toggle = block.locator('.scb-hidden-toggle');
  await expect(toggle).toHaveText('Show 5 hidden lines');
  await expect(toggle).not.toHaveAttribute('aria-pressed');
  await expect(block.locator('figure')).toHaveAccessibleName('summary.py');
  await toggle.click();
  await expect(toggle).toHaveText('Hide 5 lines');
  for (const line of await hidden.all()) await expect(line).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveText('Show 5 hidden lines');
  for (const line of await hidden.all()) await expect(line).toBeHidden();

  // The second marker, not the first: the copy button overlaps the top-right corner of the block.
  const second = markers.nth(1);
  const alpha = () =>
    second.evaluate((el) => Number(getComputedStyle(el, '::before').borderTopColor.match(/[\d.]+/g)?.[3] ?? 1));
  await page.mouse.move(0, 0);
  const rest = await alpha();
  if (!isMobile) {
    await second.hover();
    expect(await alpha()).toBeGreaterThan(rest);
  }
  const box = await second.boundingBox();
  if (!box) throw new Error('marker has no bounding box');
  await second.click({ position: { x: box.width - 10, y: box.height / 2 } });
  await expect(second).toHaveAttribute('aria-expanded', 'true');
  if (!isMobile) {
    await page.mouse.move(0, 0);
    expect(await alpha()).toBeLessThan(rest);
  }

  const marker = markers.first();
  await expect(marker).toHaveText('3 hidden lines');
  await marker.click();
  await expect(marker).toHaveText('Hide 3 lines');
  await expect(marker).toHaveAttribute('aria-expanded', 'true');
  expect(await css(marker, 'transitionDuration')).toBe('0s');
  const code = hidden.first().locator('.code');
  await expect(code).toBeVisible();
  await expect(code).toHaveCSS('opacity', '0.75');
  expect(Number((await css(code, 'backgroundColor')).match(/[\d.]+(?=\)$)/)?.[0])).toBeCloseTo(0.04, 2);
});

test('works with the keyboard, and a manual selection leaves out the marker text', async ({ page }) => {
  const text = await example(page)
    .locator('pre code')
    .evaluate((code) => {
      getSelection()?.selectAllChildren(code);
      return getSelection()?.toString();
    });
  expect(text).not.toContain('hidden line');
  expect(text).toContain('config = json.loads(Path("config.json").read_text())');

  const marker = example(page).locator('.scb-hidden-marker').first();
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(marker).toHaveAttribute('aria-expanded', 'true');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('hidden lines stay hidden, with no title bar button and no empty title bar', async ({ page }) => {
    const block = example(page);
    const hidden = block.locator('.scb-hidden-line');
    await expect(hidden.first()).toBeHidden();
    await block.locator('.scb-hidden-marker').first().click();
    await expect(hidden.first()).toBeHidden();
    await expect(block.locator('.scb-hidden-toggle')).toBeHidden();
    const untitled = example(page, 2);
    await expect(untitled.locator('.frame')).not.toHaveClass(/has-title/);
    await expect(untitled.locator('.header')).toBeHidden();
  });
});
