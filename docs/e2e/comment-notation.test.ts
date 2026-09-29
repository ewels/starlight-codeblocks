import { expect, test } from '@playwright/test';
import { copyFromKeyboard, example } from './helpers.ts';

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
