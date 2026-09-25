import { expect, test } from '@playwright/test';

test('directives change their lines and disappear from the code and the copied text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./features/comment-notation/');
  const result = page.locator('.example').first().locator('.pane').nth(1).locator('.expressive-code');
  await expect(result.locator('.ec-line.del')).toHaveCount(1);
  await expect(result.locator('.ec-line.ins')).toHaveCount(1);
  await expect(result.locator('.ec-line.mark')).toHaveCount(1);
  await expect(result.locator('pre')).not.toContainText('[!code');

  await result.locator('.copy button').focus();
  await page.keyboard.press('Enter');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(
    "export const config = {\n  port: 3000,\n  port: Number(process.env.PORT ?? 3000),\n  host: 'localhost',\n};",
  );
});

test('the source pane keeps the directives as written', async ({ page }) => {
  await page.goto('./features/comment-notation/');
  const source = page.locator('.example').first().locator('.pane').first();
  await expect(source).toContainText('port: 3000, // [!code --]');
});

test('an escaped directive renders as text', async ({ page }) => {
  await page.goto('./features/comment-notation/');
  const result = page.locator('.example').last().locator('.pane').nth(1);
  await expect(result.locator('pre')).toHaveText('const port = 8080; // [!code highlight]');
});
