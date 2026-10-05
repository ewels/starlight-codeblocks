import { expect, type Locator, test } from '@playwright/test';
import { css } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/inline-code-highlighting/');
});

const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

/** The colour that the span draws, and the colour its `--0` (dark) and `--1` (light) variables ask for. */
const token = (span: Locator) =>
  span.evaluate((el) => ({
    drawn: getComputedStyle(el).color,
    dark: el.style.getPropertyValue('--0'),
    light: el.style.getPropertyValue('--1'),
  }));

const theme = (locator: Locator) => locator.page().evaluate(() => document.documentElement.dataset.theme as string);

const background = (l: Locator) => css(l, 'backgroundColor');

test('draws chips on the code block background, in the colours of the theme, and switches with it', async ({
  page,
}) => {
  const code = page.locator('.example .pane.output').first().locator('code.scb-inline').first();
  await expect(code).toHaveText('[] + {}');
  expect(await background(code)).toBe(await background(page.locator('.example .expressive-code pre').first()));
  const plain = page.locator('.sl-markdown-content p code', { hasText: /^py$/ });
  expect(await background(plain)).not.toBe(await background(code));
  const corners = await code.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.borderRadius, s.boxDecorationBreak || s.getPropertyValue('-webkit-box-decoration-break')];
  });
  expect(corners).toEqual(['4px', 'clone']);

  const keyword = code.locator('span').first();
  const current = await theme(code);
  const colours = await token(keyword);
  expect(colours.drawn).toBe(rgb(current === 'dark' ? colours.dark : colours.light));
  const other = current === 'dark' ? 'light' : 'dark';
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, other);
  expect((await token(keyword)).drawn).toBe(rgb(other === 'dark' ? colours.dark : colours.light));
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('uses the same theme as the code blocks', async ({ page }) => {
    const code = page.locator('code.scb-inline').first();
    expect(await background(code)).toBe(await background(page.locator('.expressive-code pre').first()));
    const colours = await token(code.locator('span').first());
    expect([rgb(colours.dark), rgb(colours.light)]).toContain(colours.drawn);
  });
});
