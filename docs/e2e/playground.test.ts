import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test.beforeEach(async ({ page, context }) => {
  await context.route(/^https:\/\/(www\.typescriptlang\.org|stackblitz\.com)\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: `<p>${route.request().method()}</p>` }),
  );
  await page.goto('./features/open-in-playground/');
});

test('the link and the post form sit in the title bar, and open a new tab with the pointer', async ({ page }) => {
  const block = example(page);
  const link = block.locator('a.scb-playground');
  const header = await block.locator('.header').boundingBox();
  const box = await link.boundingBox();
  if (!header || !box) throw new Error('missing element');
  expect(box.y).toBeGreaterThanOrEqual(header.y);
  expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
  expect(header.x + header.width - (box.x + box.width)).toBeLessThan(16);
  const height = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
  const untitled = await height('.frame:not(.has-title):not(.is-terminal):has(.scb-tools) .header');
  expect(Math.abs(untitled - (await height('.frame.has-title:not(.is-terminal) .header')))).toBeLessThan(0.5);

  await expect(link).toHaveAccessibleName('Open in TS Playground (opens in a new tab)');
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  expect(popup.url()).toContain('typescriptlang.org/play#code/');

  const form = example(page, 3).locator('form.scb-playground');
  await expect(form.locator('input[name="project[files][index.js]"]')).toHaveValue(/const words/);
  const button = form.getByRole('button', { name: 'Open in StackBlitz (opens in a new tab)' });
  const [post] = await Promise.all([page.waitForEvent('popup'), button.click()]);
  await expect(post.locator('p')).toHaveText('POST');
});

test('the link opens with the keyboard, and shows the focus ring, not the hover fill', async ({ page }) => {
  const link = example(page).locator('a.scb-playground');
  const rest = await css(link, 'backgroundColor');
  await link.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  expect(await css(link, 'outlineStyle')).toBe('solid');
  expect(await css(link, 'backgroundColor')).toBe(rest);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')]);
  expect(popup.url()).toContain('typescriptlang.org/play#code/');
});
