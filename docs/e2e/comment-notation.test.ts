import { expect, test } from '@playwright/test';
import { clipboard, copyFromKeyboard, example, phone } from './helpers.ts';

test('directives change their lines and disappear from the code and the copied text', async ({ page }) => {
  await page.goto('./guides/comment-notation/');
  const result = example(page);
  await expect(result.locator('.ec-line.del')).toHaveCount(1);
  await expect(result.locator('.ec-line.ins')).toHaveCount(1);
  await expect(result.locator('.ec-line.mark')).toHaveCount(1);
  await expect(result.locator('pre')).not.toContainText('[!code');

  const copied = await copyFromKeyboard(result);
  expect(copied).toBe(
    "export const config = {\n  host: 'localhost',\n  protocol: 'https',\n  port: 3000,\n  port: Number(process.env.PORT ?? 3000),\n  timeout: 5000,\n};",
  );
});

test('directives and attributes combine in one block, with no errors', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('./guides/comment-notation/');

  const retry = example(page, 3);
  await retry.locator('.scb-annotation').first().focus();
  await page.keyboard.press('Enter');
  await expect(retry.locator('.scb-annotation-popover', { hasText: 'Only a timeout is worth a retry.' })).toBeVisible();
  await page.getByRole('link', { name: 'retry loop' }).hover();
  await expect(retry.locator('[data-scb-mention="retries"]').first()).toHaveClass(/scb-mention-on/);

  const client = example(page, 4);
  await expect(client.locator('.scb-callout-bubble', { hasText: 'Sent with every request' })).toBeVisible();
  await client.getByRole('textbox', { name: 'YOUR_TOKEN' }).fill('tok-test');
  if (!phone()) {
    await client.hover();
    await client.locator('.copy button').click();
    expect(await clipboard(page)).toContain('Bearer tok-test');
  }
  expect(errors).toEqual([]);
});
