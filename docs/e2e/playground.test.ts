import { expect, type Page, test } from '@playwright/test';

test.beforeEach(async ({ page, context }) => {
  await context.route(/^https:\/\/(www\.typescriptlang\.org|stackblitz\.com)\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: `<p>${route.request().method()}</p>` }),
  );
  await page.goto('./features/open-in-playground/');
});

const example = (page: Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

test('the link opens the TS Playground in a new tab, with the pointer', async ({ page }) => {
  const link = example(page).locator('a.scb-playground');
  await expect(link).toHaveAccessibleName('Open in TS Playground (opens in a new tab)');
  await expect(link).toHaveAttribute('href', /^https:\/\/www\.typescriptlang\.org\/play#code\/./);
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  expect(popup.url()).toContain('typescriptlang.org/play#code/');
});

test('the link opens with the keyboard, and shows a focus ring', async ({ page }) => {
  const link = example(page).locator('a.scb-playground');
  await link.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')]);
  expect(popup.url()).toContain('typescriptlang.org/play#code/');
});

test('a post playground submits a form to a new tab', async ({ page }) => {
  const form = example(page, 3).locator('form.scb-playground');
  await expect(form.locator('input[name="project[files][index.js]"]')).toHaveValue(/const words/);
  const button = form.getByRole('button', { name: 'Open in StackBlitz (opens in a new tab)' });
  const [popup] = await Promise.all([page.waitForEvent('popup'), button.click()]);
  await expect(popup.locator('p')).toHaveText('POST');
});

test('the button sits at the end of the title bar, inside the block', async ({ page }) => {
  const block = example(page);
  const header = await block.locator('.header').boundingBox();
  const link = await block.locator('a.scb-playground').boundingBox();
  if (!header || !link) throw new Error('missing element');
  expect(link.y).toBeGreaterThanOrEqual(header.y);
  expect(link.y + link.height).toBeLessThanOrEqual(header.y + header.height);
  expect(header.x + header.width - (link.x + link.width)).toBeLessThan(16);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the link is there and has its URL', async ({ page }) => {
    await expect(example(page).locator('a.scb-playground')).toHaveAttribute('href', /typescriptlang/);
  });
});
