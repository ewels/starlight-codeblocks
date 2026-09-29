import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/token-links/');
});

test('links keep their token colour, with an underline, a hover background and the site base', async ({ page }) => {
  const link = example(page).getByRole('link', { name: 'linspace' });
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
  const before = await css(link, 'backgroundColor');
  await link.hover();
  expect(await css(link, 'backgroundColor')).not.toBe(before);

  await example(page, 2).getByRole('link', { name: 'codeblocks' }).click();
  await expect(page).toHaveURL(/\/starlight-codeblocks\/reference\/options\/$/);
});

test('readers can reach the link with the keyboard', async ({ page }) => {
  const block = example(page, 1);
  await block.getByRole('link', { name: 'Path', exact: true }).focus();
  await page.keyboard.press('Tab');
  const next = block.getByRole('link', { name: 'read_text' });
  await expect(next).toBeFocused();
  expect(await css(next, 'outlineStyle')).toBe('solid');
});
