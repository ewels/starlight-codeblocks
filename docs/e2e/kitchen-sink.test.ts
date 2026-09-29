import { expect, test } from '@playwright/test';
import { clipboard, example, phone } from './helpers.ts';

test('the features of the busiest block work together, with no errors', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('./guides/kitchen-sink/');
  const block = example(page, 3);
  await expect(block.locator('.scb-state-label', { hasText: 'Always 200' })).toBeVisible();
  await expect(block.locator('.scb-callout-bubble', { hasText: 'Checked on every request' })).toBeVisible();

  await block.locator('.scb-annotation').first().focus();
  await page.keyboard.press('Enter');
  await expect(block.locator('.scb-annotation-popover', { hasText: 'Before any route.' })).toBeVisible();

  const mention = page.getByRole('link', { name: 'health route' });
  await mention.hover();
  await expect(block.locator('[data-scb-mention="health"]').first()).toHaveClass(/scb-mention-on/);

  await block.getByRole('textbox', { name: 'YOUR_API_KEY' }).fill('sk-test');
  if (!phone()) {
    await block.hover();
    await block.locator('.copy button').click();
    expect(await clipboard(page)).toContain("=== 'sk-test'");
  }
  expect(errors).toEqual([]);
});
