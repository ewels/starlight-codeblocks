import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test('colours each depth, and outlines a pair instantly under the pointer or the caret', async ({ page }) => {
  await page.goto('./features/colourised-brackets/');
  const block = example(page);
  // Read the innermost element: that is the colour the glyph is drawn in.
  const colour = (selector: string) =>
    block
      .locator(selector)
      .first()
      .evaluate((el) => {
        let inner: Element = el;
        while (inner.firstElementChild) inner = inner.firstElementChild;
        return getComputedStyle(inner).color;
      });
  const colours = await Promise.all(
    ['.scb-brackets-1', '.scb-brackets-2', '.scb-brackets-3', '.ec-line .code'].map(colour),
  );
  expect(new Set(colours).size).toBe(4);
  expect(await block.locator('pre').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);

  const open = block.locator('.scb-brackets-1').first();
  const close = block.locator('.scb-brackets-1').last();
  await expect(open).not.toHaveClass(/scb-brackets-on/);
  await open.hover();
  await expect(open).toHaveClass(/scb-brackets-on/);
  await expect(close).toHaveClass(/scb-brackets-on/);
  expect(await css(open, 'transitionDuration')).toBe('0s');
  await page.mouse.move(0, 0);
  await expect(open).not.toHaveClass(/scb-brackets-on/);

  await open.evaluate((el) => document.getSelection()?.collapse(el.firstChild as Text, 1));
  await expect(open).toHaveClass(/scb-brackets-on/);
  await expect(close).toHaveClass(/scb-brackets-on/);
  await page.evaluate(() => document.getSelection()?.removeAllRanges());
  await expect(open).not.toHaveClass(/scb-brackets-on/);
});
