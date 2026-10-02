import { expect, test } from '@playwright/test';
import { clipboard, css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/colour-swatches/');
});

test('a click on a colour copies it, and the swatch copies no text', async ({ page }) => {
  const block = example(page);
  const colour = block.locator('.scb-swatch-text[role="button"]').filter({ hasText: 'rebeccapurple' });
  await expect(colour).toHaveAccessibleName('Copy colour rebeccapurple');
  expect(await css(colour.locator('.scb-swatch'), 'backgroundImage')).toContain('rgb(102, 51, 153)');
  expect(await css(colour.locator('.scb-swatch'), 'userSelect')).toBe('none');
  await colour.click();
  await expect.poll(() => clipboard(page)).toBe('rebeccapurple');
  await expect(colour).toHaveAttribute('data-scb-copied', 'Copied');
  await expect(page.locator('body > [aria-live="polite"]')).toHaveText('Copied rebeccapurple');
  const text = await block.locator('pre').evaluate((pre) => {
    getSelection()?.selectAllChildren(pre);
    return getSelection()?.toString() ?? '';
  });
  expect(text).toContain('background: rebeccapurple;');
});

test('a colour is a button for the keyboard, with a focus ring and the hover tint', async ({ page }) => {
  const colour = example(page).locator('.scb-swatch-text[role="button"]').first();
  const before = await css(colour, 'backgroundColor');
  await colour.focus();
  expect(await css(colour, 'outlineStyle')).toBe('solid');
  await expect.poll(() => css(colour, 'backgroundColor')).not.toBe(before);
  await page.keyboard.press('Enter');
  await expect.poll(() => clipboard(page)).toBe('#ffffff');
});

test('prose colours get swatches, and issue numbers do not', async ({ page }) => {
  const prose = page.locator('.sl-markdown-content > :not(.example, .expressive-code) .scb-swatch-text');
  await expect(prose.filter({ hasText: '#ff5f1f' }).first()).toBeVisible();
  await expect(page.getByText('issue numbers such as #123', { exact: false }).locator('.scb-swatch')).toHaveCount(0);
});
