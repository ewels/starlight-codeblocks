import { expect, test } from '@playwright/test';
import { lightOnly, phone } from './helpers.ts';

test('directives reference puts source and output side by side, and stacks them on a phone', async ({ page }) => {
  lightOnly();
  await page.goto('reference/directives/');
  const panes = page
    .locator('#code-focus')
    .locator('xpath=../following-sibling::div[contains(@class, "example")][1]/div');
  await expect(panes).toHaveCount(2);
  const [source, output] = [await panes.nth(0).boundingBox(), await panes.nth(1).boundingBox()];
  expect(output?.y === source?.y).toBe(!phone());
});
