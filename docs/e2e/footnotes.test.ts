import { expect, type Page, test } from '@playwright/test';
import { render } from '../../packages/starlight-codeblocks/test/render.ts';
import { copyFromKeyboard, css, example, reduced } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/footnotes/');
});

// A block longer than the docs examples, so the badge and its note in the static list are never both
// on screen at once: no example shows this, the sticky one keeps the list on screen throughout.
async function longBlock(page: Page) {
  const lines = [
    '```py footnotes="static"',
    '# [!ref] Note about x.',
    'x = 1',
    ...Array.from({ length: 40 }, (_, i) => `y${i} = ${i}`),
    '```',
  ];
  const { html } = await render(lines.join('\n'));
  await page.evaluate((html) => {
    const box = document.createElement('div');
    box.id = 'long';
    box.innerHTML = html;
    document.querySelector('.sl-markdown-content')?.prepend(box);
    document.dispatchEvent(new Event('astro:page-load'));
  }, html);
  return page.locator('#long');
}

test('a badge highlights its line and its note, and a click elsewhere clears it', async ({ page }) => {
  const block = example(page);
  const badge = block.getByRole('link', { name: 'Footnote 1', exact: true });
  const line = block.locator('.ec-line', { has: page.locator('[data-scb-fn="1"]') });
  const note = block.locator('.scb-footnotes li').first();
  await badge.click();
  await expect(line).toHaveClass(/scb-footnote-on/);
  await expect(note).toHaveClass(/scb-footnote-on/);
  // After the fade.
  await page.waitForTimeout(300);
  const bar = await css(line.locator('.code'), 'borderInlineStartColor');
  expect(bar).not.toBe('rgba(0, 0, 0, 0)');
  // The note has the same tint and bar as its line, and its text stays where it was.
  const style = (el: Element) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderInlineStartColor];
  const lineTint = await css(line, 'backgroundColor');
  await expect.poll(() => note.evaluate(style)).toEqual([lineTint, bar]);
  const other = block.locator('.scb-footnotes li').nth(1);
  const x = (el: Element) => (el.querySelector('.scb-footnote-num') as Element).getBoundingClientRect().x;
  expect(await note.evaluate(x)).toBeCloseTo(await other.evaluate(x), 0);
  await page.locator('h1').click();
  await expect(line).not.toHaveClass(/scb-footnote-on/);
  await expect(note).not.toHaveClass(/scb-footnote-on/);
});

test('hovering over a badge or a note highlights both until the pointer leaves, and a click keeps it', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Phones have no hover.');
  const block = example(page);
  const badge = block.getByRole('link', { name: 'Footnote 1', exact: true });
  const line = block.locator('.ec-line', { has: page.locator('[data-scb-fn="1"]') });
  const note = block.locator('.scb-footnotes li').first();
  const tint = (el: Element) => getComputedStyle(el).backgroundColor;
  const plain = await note.evaluate(tint);
  await badge.hover();
  await expect(line).toHaveClass(/scb-footnote-peek/);
  await expect(note).toHaveClass(/scb-footnote-peek/);
  await expect.poll(async () => (await note.evaluate(tint)) === (await line.evaluate(tint))).toBe(true);
  await page.mouse.move(0, 0);
  await expect(line).not.toHaveClass(/scb-footnote-peek/);
  await expect.poll(() => note.evaluate(tint)).toBe(plain);
  await note.hover();
  await expect(line).toHaveClass(/scb-footnote-peek/);
  await badge.click();
  await page.mouse.move(0, 0);
  await expect(line).toHaveClass(/scb-footnote-on/);
  await expect(note).toHaveClass(/scb-footnote-on/);
  await expect(note).not.toHaveClass(/scb-footnote-peek/);
});

test('a hover highlight fades in after a short delay, and a click highlight at once', async ({ page }) => {
  const note = example(page).locator('.scb-footnotes li').first();
  const timing = () =>
    note.evaluate((el) => [getComputedStyle(el).transitionDuration, getComputedStyle(el).transitionDelay]);
  if (reduced()) {
    expect((await timing())[0]).toBe('0s');
    return;
  }
  expect(await timing()).toEqual(['0.16s, 0.16s, 0.16s', '0s, 0s, 0s']);
  await note.evaluate((el) => el.classList.add('scb-footnote-peek'));
  expect((await timing())[1]).toBe('0.08s');
  await note.evaluate((el) => el.classList.add('scb-footnote-on'));
  expect((await timing())[1]).toBe('0s, 0s, 0s');
});

test('a second click on a badge or a note clears its highlight, and several can stay on', async ({ page }) => {
  const block = example(page);
  const notes = block.locator('.scb-footnotes li');
  const first = block.getByRole('link', { name: 'Footnote 1', exact: true });
  await first.click();
  await block.getByRole('link', { name: 'Footnote 2', exact: true }).click();
  await expect(notes.nth(0)).toHaveClass(/scb-footnote-on/);
  await expect(notes.nth(1)).toHaveClass(/scb-footnote-on/);
  await first.click();
  await expect(notes.nth(0)).not.toHaveClass(/scb-footnote-on/);
  await expect(notes.nth(1)).toHaveClass(/scb-footnote-on/);
  await notes.nth(1).click();
  await expect(notes.nth(1)).not.toHaveClass(/scb-footnote-on/);
  await expect(block.locator('.ec-line.scb-footnote-on')).toHaveCount(0);
});

test('a note highlights its line, with the keyboard', async ({ page }) => {
  const block = example(page);
  await block.getByRole('link', { name: 'Footnote 2, for line 5' }).focus();
  await page.keyboard.press('Enter');
  await expect(block.locator('.ec-line.scb-footnote-on')).toContainText('@app.get("/health")');
  await expect(block.locator('.scb-footnotes li').nth(1)).toHaveClass(/scb-footnote-on/);
});

test('selecting a note scrolls its line into view', async ({ page }) => {
  const block = example(page, 1);
  const line = block.locator('.ec-line').filter({ hasText: 'log = logging' });
  await block.locator('.scb-footnotes').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 400));
  await block.locator('.scb-footnotes li').first().click();
  await expect(line).toBeInViewport();
});

test('the sticky list stays at the bottom of the window while the block is on screen', async ({ page }) => {
  const block = example(page, 1);
  await block.locator('.ec-line').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 100));
  const list = block.locator('.scb-footnotes');
  const box = await list.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - height)).toBeLessThan(2);
  // Floating over the code, the list needs its own top border.
  expect(await css(list, 'borderTopWidth')).toBe('1px');
  const first = await css(example(page, 0).locator('.scb-footnotes'), 'position');
  expect(first).toBe('static');
});

test('inline code in the list uses the code font, with round corners in a titled block', async ({ page }) => {
  const code = example(page).locator('.scb-footnotes code').first();
  const style = await code.evaluate((el) => {
    const s = getComputedStyle(el);
    const pre = getComputedStyle(el.closest('.expressive-code')?.querySelector('pre code') as Element);
    return {
      font: s.fontFamily,
      codeFont: pre.fontFamily,
      top: s.borderTopLeftRadius,
      bottom: s.borderBottomLeftRadius,
      clone: s.boxDecorationBreak,
    };
  });
  expect(style).toEqual({ font: style.codeFont, codeFont: style.codeFont, top: '3px', bottom: '3px', clone: 'clone' });
});

test('a badge describes itself with its note, and moves focus to the note and back', async ({ page }) => {
  const block = example(page);
  const badge = block.getByRole('link', { name: 'Footnote 1', exact: true });
  const note = block.locator('.scb-footnotes li').first();
  await expect(badge).toHaveAccessibleDescription(((await note.locator('span').textContent()) ?? '').trim());
  await badge.focus();
  await page.keyboard.press('Enter');
  await expect(note).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(note.locator('.scb-footnote-num')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(badge).toBeFocused();
});

test('the links in the list are at least 24 by 24 pixels', async ({ page }) => {
  for (const link of await example(page).locator('.scb-footnote-num').all()) {
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
});

test('a list number lines up with the start of the code, and its note follows closely', async ({ page }) => {
  for (const n of [0, 1]) {
    const block = example(page, n);
    const { number, code, note } = await block.evaluate((el) => {
      const link = el.querySelector('.scb-footnote-num') as HTMLElement;
      const range = document.createRange();
      // The digit of "1.", not the full stop.
      range.setStart(link.firstChild as Text, 0);
      range.setEnd(link.firstChild as Text, 1);
      const tokens = el.querySelector('.ec-line .code > span') as HTMLElement;
      const text = link.nextElementSibling as HTMLElement;
      return {
        number: range.getBoundingClientRect().left,
        code: tokens.getBoundingClientRect().left,
        note: text.getBoundingClientRect().left - link.getBoundingClientRect().right,
      };
    });
    expect(Math.abs(number - code)).toBeLessThan(1.5);
    expect(note).toBeGreaterThan(4);
    expect(note).toBeLessThan(12);
  }
});

test('a focused badge does not stay under the sticky list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  const block = example(page, 1);
  const list = block.locator('.scb-footnotes');
  for (const badge of await block.locator('.scb-footnote-badge').all()) {
    const top = await badge.evaluate((el) => el.getBoundingClientRect().bottom + scrollY - innerHeight + 10);
    await page.evaluate((y) => scrollTo(0, y), top);
    await badge.focus();
    const [badgeBottom, listTop] = await Promise.all([
      badge.evaluate((el) => el.getBoundingClientRect().bottom),
      list.evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(badgeBottom).toBeLessThanOrEqual(listTop);
  }
});

test('copying leaves the badges and notes out', async ({ page }) => {
  const copied = await copyFromKeyboard(example(page));
  expect(copied).toBe(
    'from flask import Flask\n\napp = Flask(__name__)\n\n@app.get("/health")\ndef health():\n    return {"ok": True}',
  );
});

test('selecting a badge scrolls its note into view when the list is off screen', async ({ page }) => {
  const block = await longBlock(page);
  const badge = block.getByRole('link', { name: 'Footnote 1', exact: true });
  await badge.scrollIntoViewIfNeeded();
  const note = block.locator('.scb-footnotes li').first();
  await expect(note).not.toBeInViewport();
  await badge.click();
  await expect(note).toBeInViewport();
  await expect(note).toHaveClass(/scb-footnote-on/);
});

test('the page jumps instead of scrolling smoothly under reduced motion', async ({ page }) => {
  test.skip(!reduced(), 'Only for the reduced-motion project.');
  const block = example(page, 1);
  await block.locator('.scb-footnotes').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 400));
  await block.locator('.scb-footnotes li').first().click();
  await expect(block.locator('.ec-line').filter({ hasText: 'log = logging' })).toBeInViewport({ timeout: 50 });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('a badge is a link to its note', async ({ page }) => {
    const block = example(page);
    await block.getByRole('link', { name: 'Footnote 1', exact: true }).click();
    const id = await block.locator('.scb-footnotes li').first().getAttribute('id');
    expect(page.url()).toContain(`#${id}`);
  });
});

test('a badge fades with its line, and at once under reduced motion', async ({ page }) => {
  const badge = page.locator('.example .pane.output .scb-footnote-badge').first();
  const duration = await css(badge, 'transitionDuration');
  expect(duration).toBe(reduced() ? '0s' : '0.16s, 0.16s, 0.16s');
});

test('a line with two footnotes stays lit while either is on, and Enter on a badge always reaches its note', async ({
  page,
}) => {
  const { html } = await render(['```py', '# [!ref] A', '# [!ref] B', 'app = 1', '```'].join('\n'));
  await page.evaluate((html) => {
    const box = document.createElement('div');
    box.id = 'two';
    box.innerHTML = html;
    document.querySelector('.sl-markdown-content')?.prepend(box);
    document.dispatchEvent(new Event('astro:page-load'));
  }, html);
  const block = page.locator('#two');
  const line = block.locator('.ec-line', { has: page.locator('[data-scb-fn="1"]') });
  const one = block.getByRole('link', { name: 'Footnote 1', exact: true });
  const two = block.getByRole('link', { name: 'Footnote 2', exact: true });
  const [noteOne, noteTwo] = [block.locator('.scb-footnotes li').first(), block.locator('.scb-footnotes li').nth(1)];
  await one.click();
  await two.click();
  await one.click();
  await expect(noteOne).not.toHaveClass(/scb-footnote-on/);
  await expect(noteTwo).toHaveClass(/scb-footnote-on/);
  await expect(line).toHaveClass(/scb-footnote-on/);
  await two.click();
  await expect(line).not.toHaveClass(/scb-footnote-on/);

  await one.focus();
  await page.keyboard.press('Enter');
  await expect(noteOne).toBeFocused();
  await noteOne.locator('.scb-footnote-num').focus();
  await page.keyboard.press('Enter');
  await expect(one).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(noteOne).toBeFocused();
  await expect(noteOne).toHaveClass(/scb-footnote-on/);
});
