import { expect, test } from '@playwright/test';

test('directives reference puts source and output side by side, and stacks them on a phone', async ({
  page,
}, testInfo) => {
  await page.goto('reference/directives/');
  const panes = page
    .locator('#code-focus')
    .locator('xpath=../following-sibling::div[contains(@class, "example")][1]/div');
  await expect(panes).toHaveCount(2);
  const [source, output] = [await panes.nth(0).boundingBox(), await panes.nth(1).boundingBox()];
  const phone = testInfo.project.name.startsWith('phone');
  expect(output?.y === source?.y).toBe(!phone);
  await expect(page.locator('starlight-toc a[href="#code-focus"]')).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
