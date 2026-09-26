import { expect, type Page, test } from '@playwright/test';

const example = (page: Page, n = 0) => page.locator('.example').nth(n).locator('.pane').nth(1);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
});

test('hidden lines: the markers and the title bar button do not print, and opened lines stay hidden', async ({
  page,
}) => {
  await page.emulateMedia({ media: 'screen' });
  await page.goto('./features/hidden-lines/');
  const block = example(page);
  await block.locator('.scb-hidden-toggle').click();
  await page.emulateMedia({ media: 'print' });
  await expect(block.locator('.scb-hidden-toggle')).toBeHidden();
  for (const marker of await block.locator('.scb-hidden-marker').all()) await expect(marker).toBeHidden();
  for (const line of await block.locator('.scb-hidden-line').all()) await expect(line).toBeHidden();
});

test('open in playground: the links and the form button do not print', async ({ page }) => {
  await page.goto('./features/open-in-playground/');
  const controls = page.locator('.scb-playground');
  expect(await controls.count()).toBeGreaterThan(1);
  await expect(page.locator('form.scb-playground')).toHaveCount(1);
  for (const control of await controls.all()) await expect(control).toBeHidden();
});

test('code switcher: the menu does not print, and the selected variant does', async ({ page }) => {
  await page.goto('./features/code-switcher/');
  const block = example(page);
  await expect(block.locator('.scb-switcher-menu').first()).toBeHidden();
  await expect(block.locator('.expressive-code:not([hidden]) pre').first()).toBeVisible();
});

test('token transitions: the steps and the Previous and Next buttons do not print', async ({ page }) => {
  await page.goto('./features/token-transitions/');
  const current = page.locator('.scb-steps-current').first();
  await expect(current.locator('.scb-steps-stepper')).toBeHidden();
  for (const nav of await current.locator('.scb-steps-nav').all()) await expect(nav).toBeHidden();
  await expect(current.locator('pre')).toBeVisible();
});

test('fill-in placeholders: a field prints as its text, without a border', async ({ page }) => {
  await page.goto('./features/fill-in-placeholders/');
  const field = example(page).locator('.scb-placeholder').first();
  await expect(field).toBeVisible();
  expect(await field.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('none');
});
