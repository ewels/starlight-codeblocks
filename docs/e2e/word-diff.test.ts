import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/word-level-diff/');
});

const example = (page: import('@playwright/test').Page) =>
  page.locator('.example').first().locator('.pane').nth(1).locator('.expressive-code');

test('marks changed words by shape as well as by tint', async ({ page }) => {
  const block = example(page);
  const decoration = (selector: string) =>
    block
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(await decoration('.scb-worddiff-ins')).toBe('underline');
  expect(await decoration('.scb-worddiff-del')).toBe('line-through');
  await expect(block.locator('.scb-worddiff-ins').first()).toHaveAttribute('role', 'insertion');
  await expect(block.locator('.scb-worddiff-del').first()).toHaveAttribute('role', 'deletion');
});
