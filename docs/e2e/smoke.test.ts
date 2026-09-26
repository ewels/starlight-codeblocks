import { expect, test } from '@playwright/test';

test('home page renders in the requested theme without horizontal scroll', async ({ page }, testInfo) => {
  await page.goto('./');
  const scheme = testInfo.project.use.colorScheme;
  await expect(page.locator('html')).toHaveAttribute('data-theme', String(scheme));
  await expect(page.locator('h1')).toHaveText('starlight-codeblocks');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the copy button has no transition under reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion', 'Only for the reduced-motion project.');
  await page.goto('./features/focus/');
  const button = page.locator('.copy button').first();
  expect(await button.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});
