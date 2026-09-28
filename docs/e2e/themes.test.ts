import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./guides/use-with-other-themes/');
});

test('each card shows the block in its own theme, whatever the theme of the site', async ({ page }) => {
  const cards = page.locator('.theme-gallery').first().locator('.card');
  await expect(cards).toHaveCount(8);
  const read = () =>
    cards.evaluateAll((els) =>
      els.map((el) => ({
        bg: getComputedStyle(el.querySelector('pre') as Element).backgroundColor,
        keyword: getComputedStyle(el.querySelector('.ec-line span[style]') as Element).color,
        accent: getComputedStyle(el.querySelector('.scb-annotation') as Element).backgroundColor,
      })),
    );
  const first = await read();
  // GitHub Light and Min Light share a white background, so the pair of colours tells them apart.
  expect(new Set(first.map((c) => `${c.bg} ${c.keyword}`)).size).toBe(8);
  expect(new Set(first.map((c) => c.accent)).size).toBeGreaterThanOrEqual(6);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  });
  expect(await read()).toEqual(first);
});
