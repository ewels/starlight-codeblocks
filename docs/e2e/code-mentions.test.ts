import { expect, type Page, test } from '@playwright/test';

const pane = (page: Page, n = 0) => page.locator('.example').nth(n).locator('.pane').nth(1);
const lines = (page: Page) => pane(page).locator('.ec-line');

test.beforeEach(async ({ page }) => {
  await page.goto('./features/code-mentions/');
});

test('hovering over a link highlights its lines and fades the others', async ({ page }) => {
  await pane(page).getByRole('link', { name: 'base case' }).hover();
  await expect(lines(page).nth(1)).toHaveClass(/scb-mention-on/);
  await expect(lines(page).nth(2)).toHaveClass(/scb-mention-on/);
  await expect(lines(page).nth(3)).not.toHaveClass(/scb-mention-on/);
  await expect(pane(page).locator('figure')).toHaveClass(/scb-mentioning/);
  await expect
    .poll(() =>
      lines(page)
        .nth(0)
        .evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe('0.42');
  expect(
    await lines(page)
      .nth(1)
      .evaluate((el) => getComputedStyle(el).boxShadow),
  ).toContain('inset');
  await page.mouse.move(0, 0);
  await expect(pane(page).locator('figure')).not.toHaveClass(/scb-mentioning/);
});

test('keyboard focus highlights the lines, and blur removes the highlight', async ({ page }) => {
  const link = pane(page).getByRole('link', { name: 'recursive step' });
  await link.focus();
  await expect(lines(page).nth(3)).toHaveClass(/scb-mention-on/);
  await link.blur();
  await expect(lines(page).nth(3)).not.toHaveClass(/scb-mention-on/);
});

test('screen readers get the tagged lines as the description of the link', async ({ page }) => {
  await expect(pane(page).getByRole('link', { name: 'recursive step' })).toHaveAccessibleDescription(
    /return n \* factorial\(n - 1\)/,
  );
});

test('selecting a link scrolls the block into view, without changing the address', async ({ page }) => {
  const link = pane(page).getByRole('link', { name: 'base case' });
  await link.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy({ top: -innerHeight + 120, behavior: 'instant' }));
  await link.click();
  await expect(pane(page).locator('figure')).toBeInViewport({ ratio: 0.95 });
  expect(new URL(page.url()).hash).toBe('');
  await expect(lines(page).nth(1)).toHaveClass(/scb-mention-on/);
});

test('one line can belong to two names', async ({ page }) => {
  await pane(page, 1).getByRole('link', { name: 'request' }).hover();
  await expect(pane(page, 1).locator('.scb-mention-on')).toHaveCount(1);
  await pane(page, 1).getByRole('link', { name: 'error handling' }).hover();
  await expect(pane(page, 1).locator('.scb-mention-on')).toHaveCount(3);
});

test('the links have a dotted underline', async ({ page }) => {
  const link = pane(page).getByRole('link', { name: 'base case' });
  expect(await link.evaluate((el) => getComputedStyle(el).textDecorationStyle)).toBe('dotted');
});

test('the fade has no transition under reduced motion', async ({ page }, info) => {
  const duration = await lines(page)
    .nth(0)
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toBe(info.project.name === 'reduced-motion' ? '0s' : '0.2s');
});

test('without JavaScript, the links do nothing', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/code-mentions/');
  await pane(page).getByRole('link', { name: 'base case' }).hover();
  await expect(pane(page).locator('.scb-mention-on')).toHaveCount(0);
  await context.close();
});
