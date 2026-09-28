import { expect, test } from '@playwright/test';
import { copyFromKeyboard, css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/token-links/');
});

test('links the text, keeps its token colour, and underlines it', async ({ page }) => {
  const link = example(page).getByRole('link', { name: 'linspace' });
  await expect(link).toHaveAttribute('href', 'https://numpy.org/doc/stable/reference/generated/numpy.linspace.html');
  const style = await link.evaluate((a) => {
    const s = getComputedStyle(a);
    return {
      line: s.textDecorationLine,
      underline: s.textDecorationColor,
      text: getComputedStyle(a.firstElementChild as Element).color,
    };
  });
  expect(style.line).toBe('underline');
  expect(style.underline).not.toBe(style.text);
  const plain = await css(example(page).locator('.ec-line').first().locator('span').first(), 'color');
  expect(style.underline).not.toBe(plain);
});

test('the pointer shows a background on hover', async ({ page }) => {
  const link = example(page).getByRole('link', { name: 'linspace' });
  const before = await css(link, 'backgroundColor');
  await link.hover();
  expect(await css(link, 'backgroundColor')).not.toBe(before);
});

test('readers can reach the link with the keyboard', async ({ page }) => {
  const block = example(page, 1);
  await block.getByRole('link', { name: 'Path', exact: true }).focus();
  await page.keyboard.press('Tab');
  const next = block.getByRole('link', { name: 'read_text' });
  await expect(next).toBeFocused();
  expect(await css(next, 'outlineStyle')).toBe('solid');
});

test('site-relative links get the base', async ({ page }) => {
  const link = example(page, 2).getByRole('link', { name: 'codeblocks' });
  await expect(link).toHaveAttribute('href', '/starlight-codeblocks/reference/options/');
  await link.click();
  await expect(page).toHaveURL(/\/reference\/options\/$/);
});

test('the copied text has no directive', async ({ page }) => {
  expect(await copyFromKeyboard(example(page))).toBe(
    'import numpy as np\n\nx = np.linspace(0, 1, 50)\ny = np.sin(2 * np.pi * x)',
  );
});
