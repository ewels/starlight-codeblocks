import { expect, test } from '@playwright/test';
import { css, lightOnly, output } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  lightOnly();
  await page.emulateMedia({ media: 'print' });
});

test('hidden lines: the markers and the title bar button do not print, and opened lines stay hidden', async ({
  page,
}) => {
  await page.emulateMedia({ media: 'screen' });
  await page.goto('./features/hidden-lines/');
  const block = output(page);
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

test('code tabs: the other tabs and the menu do not print, and the selected variant prints with its tab', async ({
  page,
}) => {
  await page.goto('./features/code-tabs/');
  await expect(page.locator('[data-scb-code-tabs]:not([data-scb-ready])')).toHaveCount(0);
  const block = output(page).locator('.expressive-code:not([hidden])').first();
  await expect(block.getByRole('tab', { selected: true })).toBeVisible();
  await expect(block.getByRole('tab', { selected: false }).first()).toBeHidden();
  await expect(block.locator('pre')).toBeVisible();
  await expect(output(page, 3).locator('.scb-tabs-menu').first()).toBeHidden();
});

test('code walkthrough: every step prints with its label, without the step buttons', async ({ page }) => {
  await page.goto('./features/code-walkthrough/');
  const blocks = output(page).locator('.scb-steps > .expressive-code');
  expect(await blocks.count()).toBe(3);
  for (const block of await blocks.all()) {
    await expect(block.locator('pre')).toBeVisible();
    await expect(block.locator('.scb-steps-label')).toBeVisible();
  }
  const current = page.locator('.scb-steps-current').first();
  await expect(current.locator('.scb-steps-stepper')).toBeHidden();
  for (const nav of await current.locator('.scb-steps-nav').all()) await expect(nav).toBeHidden();
});

test('focus: the other lines print sharp and only a little faded', async ({ page }) => {
  await page.goto('./features/focus/');
  const line = output(page).locator('.scb-focus-out').first();
  const [filter, opacity] = await line.evaluate((el) => [getComputedStyle(el).filter, getComputedStyle(el).opacity]);
  expect(filter).toBe('none');
  expect(Number(opacity)).toBeGreaterThanOrEqual(0.6);
});

test('scrollycoding: every step prints in full with its own code, and nothing sticks', async ({ page }) => {
  await page.goto('./features/scrollycoding/');
  const steps = page.locator('.scb-scrolly').first().locator('.scb-scrolly-step');
  expect(await steps.count()).toBe(5);
  for (const step of await steps.all()) {
    expect(await css(step, 'opacity')).toBe('1');
    await expect(step.locator('.scb-scrolly-text')).toBeVisible();
    await expect(step.locator('pre')).toBeVisible();
    for (const line of await step.locator('.scb-focus-out').all()) {
      expect(await css(line, 'filter')).toBe('none');
    }
  }
  await expect(page.locator('.scb-scrolly-code').first()).toBeHidden();
});

test('fill-in placeholders: a field prints as its text, without a border', async ({ page }) => {
  await page.goto('./features/fill-in-placeholders/');
  const field = output(page).locator('.scb-placeholder').first();
  await expect(field).toBeVisible();
  expect(await css(field, 'borderTopStyle')).toBe('none');
});
