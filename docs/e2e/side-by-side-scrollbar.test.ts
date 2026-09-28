import { expect, test } from '@playwright/test';

// Playwright hides scrollbars by default, and `100vw` includes a classic one.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('a wide side-by-side block does not make the page scroll sideways with a classic scrollbar', async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(isMobile || browserName !== 'chromium', 'Needs a desktop Chromium window.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./features/side-by-side-annotations/wide/');
  await page.addStyleTag({
    content: '::-webkit-scrollbar { width: 17px; } ::-webkit-scrollbar-thumb { background: grey; }',
  });
  expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBeGreaterThan(10);
  const grids = page.locator('.sl-markdown-content > .expressive-code > .scb-side > .scb-side-grid');
  expect(await grids.nth(1).evaluate((el) => getComputedStyle(el).display)).toBe('grid');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(
    0,
  );
});
