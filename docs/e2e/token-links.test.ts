import { expect, type Page, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/token-links/');
});

const example = (page: Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

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
  const plain = await example(page)
    .locator('.ec-line')
    .first()
    .locator('span')
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  expect(style.underline).not.toBe(plain);
});

test('the pointer shows a background on hover', async ({ page }) => {
  const link = example(page).getByRole('link', { name: 'linspace' });
  const before = await link.evaluate((a) => getComputedStyle(a).backgroundColor);
  await link.hover();
  expect(await link.evaluate((a) => getComputedStyle(a).backgroundColor)).not.toBe(before);
});

test('readers can reach the link with the keyboard', async ({ page }) => {
  const block = example(page, 1);
  await block.getByRole('link', { name: 'Path', exact: true }).focus();
  await page.keyboard.press('Tab');
  const next = block.getByRole('link', { name: 'read_text' });
  await expect(next).toBeFocused();
  expect(await next.evaluate((a) => getComputedStyle(a).outlineStyle)).toBe('solid');
});

test('site-relative links get the base', async ({ page }) => {
  const link = example(page, 2).getByRole('link', { name: 'codeblocks' });
  await expect(link).toHaveAttribute('href', '/starlight-codeblocks/reference/options/');
  await link.click();
  await expect(page).toHaveURL(/\/reference\/options\/$/);
});

test('the copied text has no directive', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await example(page).locator('.copy button').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'import numpy as np\n\nx = np.linspace(0, 1, 50)\ny = np.sin(2 * np.pi * x)',
  );
});
