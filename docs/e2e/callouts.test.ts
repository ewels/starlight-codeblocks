import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/inline-callouts/');
});

const example = (page: import('@playwright/test').Page, n = 0) =>
  page.locator('.example').nth(n).locator('.pane').nth(1).locator('.expressive-code');

test('shows the note in a bubble above its line, with the note role', async ({ page }) => {
  const note = example(page).getByRole('note');
  await expect(note).toHaveText('Lets controller.abort() cancel the request.');
  const line = example(page).locator('.ec-line').nth(1);
  await expect(line).toContainText('const res');
  expect((await note.boundingBox())?.y).toBeLessThan((await line.boundingBox())?.y ?? 0);
});

test('the arrow points at the middle of the matched text', async ({ page, isMobile }) => {
  test.skip(isMobile, 'On a phone the token is past the right edge, so the arrow stays inside the block.');
  const block = example(page);
  const arrow = await block.locator('.scb-callout').evaluate((el) => {
    const box = el.getBoundingClientRect();
    const after = getComputedStyle(el, '::after');
    return box.left + Number.parseFloat(after.left) + Number.parseFloat(after.width) / 2;
  });
  const token = await block
    .locator('.ec-line')
    .nth(1)
    .evaluate((line) => {
      const range = document.createRange();
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent?.indexOf('signal') ?? -1;
        if (at >= 0) {
          range.setStart(node, at);
          range.setEnd(node, at + 6);
          const r = range.getBoundingClientRect();
          return r.left + r.width / 2;
        }
      }
      return Number.NaN;
    });
  expect(Math.abs(arrow - token)).toBeLessThan(2);
});

test('the bubble stays inside the block and the page does not scroll sideways', async ({ page }) => {
  const block = example(page);
  const bubble = await block.locator('.scb-callout-bubble').boundingBox();
  const pre = await block.locator('pre').boundingBox();
  expect(bubble && pre && bubble.x + bubble.width).toBeLessThanOrEqual((pre?.x ?? 0) + (pre?.width ?? 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('copying leaves the callout out, with the keyboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await example(page).locator('.copy button').focus();
  await page.keyboard.press('Enter');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).not.toContain('cancel the request');
  expect(copied).not.toContain('[!callout');
  expect(copied).toContain('const res = await fetch(url, { signal: controller.signal });');
});

test('a manual selection leaves the callout out', async ({ page }) => {
  const style = await example(page)
    .locator('.scb-callout')
    .evaluate((el) => getComputedStyle(el).userSelect);
  expect(style).toBe('none');
});

test('a short bubble near the right edge moves left instead of wrapping on a desktop', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone block is too narrow for every bubble on one line.');
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const bubble of await page.locator('.scb-callout-bubble').all()) {
    const box = await bubble.boundingBox();
    expect(box?.height, (await bubble.textContent()) ?? '').toBeLessThan(40);
  }
});
