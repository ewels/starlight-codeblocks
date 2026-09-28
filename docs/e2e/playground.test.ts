import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test.beforeEach(async ({ page, context }) => {
  await context.route(/^https:\/\/(www\.typescriptlang\.org|stackblitz\.com)\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: `<p>${route.request().method()}</p>` }),
  );
  await page.goto('./features/open-in-playground/');
});

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
  expect(await css(link, 'outlineStyle')).toBe('solid');
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

test('the bar of an untitled block is as tall as a titled bar', async ({ page }) => {
  const height = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
  const untitled = await height('.frame:not(.has-title):not(.is-terminal):has(.scb-tools) .header');
  expect(Math.abs(untitled - (await height('.frame.has-title:not(.is-terminal) .header')))).toBeLessThan(0.5);
});

test('a focused button shows the focus ring, not the hover fill', async ({ page }) => {
  const button = example(page).locator('a.scb-playground');
  const background = () => css(button, 'backgroundColor');
  const rest = await background();
  await button.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  expect(await css(button, 'outlineStyle')).toBe('solid');
  expect(await background()).toBe(rest);
});
