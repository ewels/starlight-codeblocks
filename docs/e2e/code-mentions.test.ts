import { expect, type Page, test } from '@playwright/test';
import { css, output, reduced, serveClient } from './helpers.ts';

const lines = (page: Page) => output(page).locator('.ec-line');

test.beforeEach(async ({ page }) => {
  await page.goto('./features/code-mentions/');
});

test.describe('pairing a link with a block, in the browser', () => {
  // No docs example needs the fallback rule: a link with no matching block after it, in its own
  // section, pairs with the nearest matching block before it instead.
  const origin = 'http://codeblocks-mentions.test';
  const html = `<h2>Section A</h2>
  <figure data-scb-mentions><div class="ec-line" data-scb-mention="x">match in A</div></figure>
  <h2>Section B</h2>
  <p>See <a href="#mention:x">the value</a>.</p>
  <script type="module">import init from '/mentions.js'; init();</script>`;

  test('a link with nothing after it in its section pairs with the block before it', async ({ page }) => {
    await serveClient(page, origin, 'mentions', html);
    await page.goto(`${origin}/`);
    await page.getByRole('link', { name: 'the value' }).hover();
    await expect(page.locator('[data-scb-mention="x"]')).toHaveClass(/scb-mention-on/);
  });
});

test('hovering over a link highlights its lines and fades the others', async ({ page }) => {
  await output(page).getByRole('link', { name: 'base case' }).hover();
  await expect(lines(page).nth(1)).toHaveClass(/scb-mention-on/);
  await expect(lines(page).nth(2)).toHaveClass(/scb-mention-on/);
  await expect(lines(page).nth(3)).not.toHaveClass(/scb-mention-on/);
  await expect(output(page).locator('figure')).toHaveClass(/scb-mentioning/);
  await expect.poll(() => css(lines(page).nth(0), 'opacity')).toBe('0.42');
  expect(await css(lines(page).nth(1).locator('.code'), 'borderInlineStartWidth')).toBe('3px');
  await page.mouse.move(0, 0);
  await expect(output(page).locator('figure')).not.toHaveClass(/scb-mentioning/);
});

test('keyboard focus highlights the lines, and blur removes the highlight', async ({ page }) => {
  const link = output(page).getByRole('link', { name: 'recursive step' });
  await link.focus();
  await expect(lines(page).nth(3)).toHaveClass(/scb-mention-on/);
  await link.blur();
  await expect(lines(page).nth(3)).not.toHaveClass(/scb-mention-on/);
});

test('a link with keyboard focus has a 2px ring in its own colour', async ({ page }) => {
  const link = output(page).getByRole('link', { name: 'recursive step' });
  await link.focus();
  const ring = await link.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.outlineStyle, s.outlineWidth, s.outlineOffset, s.outlineColor === s.color];
  });
  expect(ring).toEqual(['solid', '2px', '2px', true]);
});

test('screen readers get the tagged lines as the description of the link', async ({ page }) => {
  await expect(output(page).getByRole('link', { name: 'recursive step' })).toHaveAccessibleDescription(
    /return n \* factorial\(n - 1\)/,
  );
});

test('selecting a link scrolls the block into view, without changing the address', async ({ page }) => {
  const link = output(page).getByRole('link', { name: 'base case' });
  await link.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy({ top: -innerHeight + 120, behavior: 'instant' }));
  await link.click();
  await expect(output(page).locator('figure')).toBeInViewport({ ratio: 0.95 });
  expect(new URL(page.url()).hash).toBe('');
  await expect(lines(page).nth(1)).toHaveClass(/scb-mention-on/);
});

test('one line can belong to two names', async ({ page }) => {
  await output(page, 1).getByRole('link', { name: 'request' }).hover();
  await expect(output(page, 1).locator('.scb-mention-on')).toHaveCount(1);
  await output(page, 1).getByRole('link', { name: 'error handling' }).hover();
  await expect(output(page, 1).locator('.scb-mention-on')).toHaveCount(3);
});

test('the links have a dotted underline', async ({ page }) => {
  const link = output(page).getByRole('link', { name: 'base case' });
  expect(await css(link, 'textDecorationStyle')).toBe('dotted');
});

test('on hover, a link keeps its colour, and its underline turns solid', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones have no hover.');
  const link = output(page).getByRole('link', { name: 'base case' });
  const style = () =>
    link.evaluate((el) => ({ colour: getComputedStyle(el).color, line: getComputedStyle(el).textDecorationStyle }));
  await page.mouse.move(0, 0);
  const rest = await style();
  await link.hover();
  expect(await style()).toEqual({ colour: rest.colour, line: 'solid' });
  // Other prose links still take Starlight's hover colour.
  const other = page.locator('.sl-markdown-content a[href^="/"]:not(.not-content *)').first();
  const before = await css(other, 'color');
  await other.hover();
  expect(await css(other, 'color')).not.toBe(before);
});

test('the fade has no transition under reduced motion', async ({ page }) => {
  const duration = await css(lines(page).nth(0), 'transitionDuration');
  expect(duration).toBe(reduced() ? '0s' : '0.2s');
});

test('without JavaScript, the links do nothing', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/code-mentions/');
  await output(page).getByRole('link', { name: 'base case' }).hover();
  await expect(output(page).locator('.scb-mention-on')).toHaveCount(0);
  await context.close();
});
