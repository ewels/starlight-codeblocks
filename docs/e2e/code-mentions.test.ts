import { expect, type Page, test } from '@playwright/test';
import { css, once, output, reduced, serveClient } from './helpers.ts';

const lines = (page: Page) => output(page).locator('.ec-line');

test('a link with nothing after it in its section pairs with the block before it', async ({ page }) => {
  once();
  // No docs example needs this fallback rule.
  const origin = 'http://codeblocks-mentions.test';
  await serveClient(
    page,
    origin,
    'mentions',
    `<h2>Section A</h2>
    <figure data-scb-mentions><div class="ec-line" data-scb-mention="x">match in A</div></figure>
    <h2>Section B</h2>
    <p>See <a href="#mention:x">the value</a>.</p>
    <script type="module">import init from '/mentions.js'; init();</script>`,
  );
  await page.goto(`${origin}/`);
  await page.getByRole('link', { name: 'the value' }).hover();
  await expect(page.locator('[data-scb-mention="x"]')).toHaveClass(/scb-mention-on/);
});

test('the pointer highlights the lines of a link and fades the others, and a click scrolls to them', async ({
  page,
  isMobile,
}) => {
  await page.goto('./features/code-mentions/');
  const link = output(page).getByRole('link', { name: 'base case' });
  const figure = output(page).locator('figure');
  expect(await css(lines(page).nth(0), 'transitionDuration')).toBe(reduced() ? '0s' : '0.2s');
  expect(await css(link, 'textDecorationStyle')).toBe('dotted');
  const colour = await css(link, 'color');

  await link.hover();
  await expect(lines(page).nth(1)).toHaveClass(/scb-mention-on/);
  await expect(lines(page).nth(2)).toHaveClass(/scb-mention-on/);
  await expect(lines(page).nth(3)).not.toHaveClass(/scb-mention-on/);
  await expect(figure).toHaveClass(/scb-mentioning/);
  await expect.poll(() => css(lines(page).nth(0), 'opacity')).toBe('0.42');
  expect(await css(lines(page).nth(1).locator('.code'), 'borderInlineStartWidth')).toBe('3px');
  if (!isMobile) {
    expect(await css(link, 'color')).toBe(colour);
    expect(await css(link, 'textDecorationStyle')).toBe('solid');
    // Other prose links still take Starlight's hover colour.
    const other = page.locator('.sl-markdown-content a[href^="/"]:not(.not-content *)').first();
    const before = await css(other, 'color');
    await other.hover();
    expect(await css(other, 'color')).not.toBe(before);
  }
  await page.mouse.move(0, 0);
  await expect(figure).not.toHaveClass(/scb-mentioning/);

  await output(page, 1).getByRole('link', { name: 'request' }).hover();
  await expect(output(page, 1).locator('.scb-mention-on')).toHaveCount(1);
  await output(page, 1).getByRole('link', { name: 'error handling' }).hover();
  await expect(output(page, 1).locator('.scb-mention-on')).toHaveCount(3);

  await link.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy({ top: -innerHeight + 120, behavior: 'instant' }));
  await link.click();
  await expect(figure).toBeInViewport({ ratio: 0.95 });
  expect(new URL(page.url()).hash).toBe('');
  await expect(lines(page).nth(1)).toHaveClass(/scb-mention-on/);
});

test('keyboard focus highlights the lines, with a focus ring, and screen readers get them', async ({ page }) => {
  await page.goto('./features/code-mentions/');
  const link = output(page).getByRole('link', { name: 'recursive step' });
  await expect(link).toHaveAccessibleDescription(/return n \* factorial\(n - 1\)/);
  await link.focus();
  await expect(lines(page).nth(3)).toHaveClass(/scb-mention-on/);
  const ring = await link.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.outlineStyle, s.outlineWidth, s.outlineOffset, s.outlineColor === s.color];
  });
  expect(ring).toEqual(['solid', '2px', '2px', true]);
  await link.blur();
  await expect(lines(page).nth(3)).not.toHaveClass(/scb-mention-on/);
});

test('without JavaScript, the links do nothing', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./features/code-mentions/');
  await output(page).getByRole('link', { name: 'base case' }).hover();
  await expect(output(page).locator('.scb-mention-on')).toHaveCount(0);
  await context.close();
});
