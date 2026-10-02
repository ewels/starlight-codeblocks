import { expect, type Page, test } from '@playwright/test';
import { once, reduced } from './helpers.ts';

const handle = (page: Page) => page.getByRole('slider', { name: /Divider/ });
const clip = (page: Page) => page.locator('.hero-slider .layer.after').evaluate((el) => getComputedStyle(el).clipPath);
const lineTops = (page: Page, layer: string) =>
  page
    .locator(`.hero-slider .layer.${layer} .ec-line`)
    .evaluateAll((lines) => lines.map((line) => line.getBoundingClientRect().top));

test('the two layers line up line for line, and only the top one uses the plugin', async ({ page }) => {
  await page.goto('./');
  const before = await lineTops(page, 'before');
  expect(before).toHaveLength(10);
  expect(await lineTops(page, 'after')).toEqual(before);
  await expect(page.locator('.hero-slider .layer.before [class*="scb-"]')).toHaveCount(0);
  await expect(page.locator('.hero-slider .layer.after .scb-api-link').first()).toBeVisible();
});

test('the arrow, Home and End keys move the divider', async ({ page }) => {
  once();
  await page.goto('./');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '38', { timeout: 5000 });
  await handle(page).press('ArrowRight');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '43');
  expect(await clip(page)).toContain('43%');
  await handle(page).press('ArrowLeft');
  await handle(page).press('ArrowLeft');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '33');
  await handle(page).press('Home');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '0');
  await expect(handle(page)).toHaveAttribute('aria-valuetext', '100% of the block shows the plugin');
  await handle(page).press('End');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '100');
  expect(await clip(page)).toContain('100%');
});

test('dragging on the block moves the divider', async ({ page }) => {
  once();
  await page.goto('./');
  const box = await page.locator('.hero-slider .compare').boundingBox();
  if (!box) throw new Error('No slider');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6, { steps: 4 });
  await page.mouse.up();
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '20');
});

test('the divider sweeps in, except with reduced motion', async ({ page }) => {
  await page.goto('./');
  const start = Number(await handle(page).getAttribute('aria-valuenow'));
  if (reduced()) {
    expect(start).toBe(38);
    await page.waitForTimeout(600);
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '38');
  } else {
    expect(start).toBeGreaterThan(38);
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '38', { timeout: 5000 });
  }
});
