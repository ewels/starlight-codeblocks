import { expect, test } from '@playwright/test';
import { lightOnly, sitePages } from './helpers.ts';

test('the sitemap lists the pages', () => {
  expect(sitePages.length).toBeGreaterThan(30);
});

for (const path of sitePages) {
  test(`/${path} has no horizontal overflow, and no table is wider than its container`, async ({ page }) => {
    lightOnly();
    await page.goto(`./${path}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const wide = await page.locator('.sl-markdown-content table').evaluateAll((tables) =>
      tables
        .filter((table) => {
          const container = table.parentElement as HTMLElement;
          return (
            table.scrollWidth > table.clientWidth + 1 || table.getBoundingClientRect().width > container.clientWidth + 1
          );
        })
        .map((table) => table.querySelector('th, td')?.textContent),
    );
    expect(wide).toEqual([]);
  });
}
