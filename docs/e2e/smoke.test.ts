import { expect, test } from '@playwright/test';

test('home page renders a code block in the requested theme', async ({ page }, testInfo) => {
  await page.goto('./');
  const scheme = testInfo.project.use.colorScheme;
  await expect(page.locator('html')).toHaveAttribute('data-theme', String(scheme));
  await expect(page.locator('.expressive-code').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
