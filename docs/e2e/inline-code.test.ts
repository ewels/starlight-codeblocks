import { expect, type Locator, test } from '@playwright/test';

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

test('draws each token in the colour of the current theme, and switches with the theme', async ({ page }) => {
  const code = page.locator('.example .pane').nth(1).locator('code.scb-inline').first();
  await expect(code).toHaveText('await fetch(url)');
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

test('uses the background of the code blocks, and removes the suffix', async ({ page }) => {
  const pane = page.locator('.example .pane').nth(1);
  const code = pane.locator('code.scb-inline').first();
  const block = page.locator('.example .expressive-code pre').first();
  const background = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await background(code)).toBe(await background(block));
  await expect(pane.locator('p:not(.label)').first()).toHaveText(
    'Call await fetch(url) and check res.ok before you read the body.',
  );
});

test('leaves inline code without a suffix unchanged', async ({ page }) => {
  const plain = page.locator('.sl-markdown-content p code', { hasText: /^py$/ });
  await expect(plain).toHaveCount(1);
  await expect(plain.locator('span')).toHaveCount(0);
  const highlighted = page.locator('code.scb-inline').first();
  const background = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await background(plain)).not.toBe(await background(highlighted));
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('uses the same theme as the code blocks', async ({ page }) => {
    const background = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
    const code = page.locator('code.scb-inline').first();
    expect(await background(code)).toBe(await background(page.locator('.expressive-code pre').first()));
    const colours = await token(code.locator('span').first());
    expect([rgb(colours.dark), rgb(colours.light)]).toContain(colours.drawn);
  });
});
