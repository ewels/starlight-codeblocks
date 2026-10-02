import { expect, test } from '@playwright/test';
import { css } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/file-icons/');
});

test('the icon sits before the title, hidden from screen readers and from the selection', async ({ page }) => {
  const icon = page.locator('.scb-file-icon[data-scb-file-icon-name="json"]').first();
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute('aria-hidden', 'true');
  expect(await css(icon, 'userSelect')).toBe('none');
  const title = icon.locator('..');
  expect(await title.textContent()).toBe('package.json');
});

for (const theme of ['dark', 'light']) {
  test(`a tile in a custom colour gets a black or white icon, in the ${theme} theme`, async ({ page }) => {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
    const tiles = page.locator('.scb-file-icon[data-scb-file-icon="tile"][style]');
    // #3776ab is dark, so its icon is white; #f7df1e is light, so its icon is black.
    expect(await css(tiles.nth(0), 'color')).toMatch(/^(rgb\(255, 255, 255\)|oklch\(1 0 0\))$/);
    expect(await css(tiles.nth(1), 'color')).toMatch(/^(rgb\(0, 0, 0\)|oklch\(0 0 0\))$/);
  });
}
