import { expect, type Page, test } from '@playwright/test';
import { render } from '../../packages/starlight-codeblocks/test/render.ts';
import { css, example, reduced } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/side-annotations/');
});

/** The box of the grid of a block with side annotations and the content column, and whether the notes are beside the code. */
async function measure(page: Page, index: number) {
  const side = page.locator('.sl-markdown-content > .expressive-code > .scb-side').nth(index);
  const grid = side.locator('.scb-side-grid');
  return {
    column: await page.locator('.sl-markdown-content').boundingBox(),
    grid: await grid.boundingBox(),
    display: await css(grid, 'display'),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  };
}

const boxes = (block: ReturnType<typeof example>) =>
  Promise.all([block.locator('figure').boundingBox(), block.locator('.scb-annotation-notes').boundingBox()]);

test('the notes are a list under the code on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only for phones.');
  const [code, notes] = await boxes(example(page));
  expect(notes?.y).toBeGreaterThanOrEqual((code?.y ?? 0) + (code?.height ?? 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('on a desktop, the notes are a sticky column beside code that fits without a scroll bar', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The phone layout has no column.');
  const block = example(page);
  const [code, notes] = await boxes(block);
  expect(notes?.x).toBeGreaterThan((code?.x ?? 0) + (code?.width ?? 0));
  expect(Math.abs((notes?.y ?? 0) - (code?.y ?? 0))).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // codeSide="right" puts the notes in the left column.
  await expect(example(page, 1).locator('.scb-side-code-right')).toBeAttached();
  const [right, left] = await boxes(example(page, 1));
  expect((left?.x ?? 0) + (left?.width ?? 0)).toBeLessThanOrEqual(right?.x ?? 0);
  expect(Math.abs((left?.y ?? 0) - (right?.y ?? 0))).toBeLessThan(2);

  await block.locator('.ec-line').nth(16).scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 200));
  const stuck = await block.locator('.scb-annotation-notes').boundingBox();
  const header = await page.locator('header.header').boundingBox();
  expect(stuck?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
  expect(stuck?.y).toBeLessThan((header?.height ?? 0) + 40);

  const pres = page.locator('.scb-side-grid pre');
  expect(await pres.count()).toBeGreaterThan(1);
  for (const width of [1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [i, pre] of (await pres.all()).entries()) {
      const [scroll, client] = await pre.evaluate((el) => [el.scrollWidth, el.clientWidth]);
      expect(scroll, `block ${i + 1} at ${width}px`).toBeLessThanOrEqual(client);
    }
  }

  // The notes column stops sticking when it is taller than the space below the header.
  await page.setViewportSize({ width: 1024, height: 260 });
  const first = page.locator('[data-scb-annotations]').first();
  await expect(first).toHaveClass(/scb-side-static/);
  expect(await css(first.locator('.scb-annotation-notes'), 'position')).toBe('static');

  // A wide block keeps to the content column on a page with a table of contents.
  await page.setViewportSize({ width: 1920, height: 900 });
  const { html } = await render(
    [
      '```py annotations="side"',
      'rows = [r for r in read_rows(path) if r["ok"]]  # [!annotate] Keeps the rows to report.',
      '```',
    ].join('\n'),
  );
  await page.evaluate((html) => {
    const box = document.createElement('div');
    box.innerHTML = html;
    document.querySelector('.sl-markdown-content')?.prepend(box.firstElementChild as Element);
  }, html);
  const { column, grid, display } = await measure(page, 0);
  expect(display).toBe('block');
  expect(grid?.x).toBeCloseTo(column?.x ?? 0, 0);
  expect(grid?.width).toBeCloseTo(column?.width ?? 0, 0);
});

test('hovering over a note or a line highlights the other, and a line marker takes the hover colour', async ({
  page,
  isMobile,
}) => {
  const block = example(page);
  const note = block.locator('.scb-annotation-notes li').nth(1);
  const line = block.locator('.ec-line[data-scb-anno="2"]');
  await note.hover();
  await expect(line).toHaveClass(/scb-annotation-lit/);
  expect(await css(line, 'backgroundColor')).not.toBe('rgba(0, 0, 0, 0)');
  await block.locator('.ec-line[data-scb-anno="3"]').hover();
  await expect(block.locator('.scb-annotation-notes li').nth(2)).toHaveClass(/scb-annotation-on/);
  await expect(line).not.toHaveClass(/scb-annotation-lit/);

  if (isMobile) return;
  const marker = block.locator('.scb-annotation-num').first();
  await page.mouse.move(0, 0);
  const rest = await css(marker, 'backgroundColor');
  await marker.hover();
  const { hover, expected, duration } = await marker.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--ec-codeblocksAnnotations-markerHoverBg)';
    el.after(probe);
    const style = getComputedStyle(el);
    const out = {
      hover: style.backgroundColor,
      expected: getComputedStyle(probe).color,
      duration: style.transitionDuration,
    };
    probe.remove();
    return out;
  });
  expect(duration).toBe('0s');
  expect(hover).toBe(expected);
  expect(hover).not.toBe(rest);
});

test('a click on a note or its number keeps the highlight, a second click or a click elsewhere clears it', async ({
  page,
}) => {
  const block = example(page);
  const notes = block.locator('.scb-annotation-notes li');
  const line = (n: number) => block.locator(`.ec-line[data-scb-anno="${n}"]`);
  await notes.nth(1).click();
  await page.mouse.move(0, 0);
  await expect(notes.nth(1)).toHaveClass(/scb-annotation-pin/);
  await expect(line(2)).toHaveClass(/scb-annotation-pin/);
  await notes.nth(1).click();
  await expect(notes.nth(1)).not.toHaveClass(/scb-annotation-pin/);
  await expect(line(2)).not.toHaveClass(/scb-annotation-pin/);
  await notes.nth(0).click();
  await line(3).locator('.scb-annotation-num').click();
  await expect(notes.nth(0)).toHaveClass(/scb-annotation-pin/);
  await expect(notes.nth(2)).toHaveClass(/scb-annotation-pin/);
  await expect(line(3)).toHaveClass(/scb-annotation-pin/);
  await page.locator('h1').click();
  await expect(block.locator('.scb-annotation-pin')).toHaveCount(0);
  await notes.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(line(2)).toHaveClass(/scb-annotation-pin/);
  await page.keyboard.press(' ');
  await expect(line(2)).not.toHaveClass(/scb-annotation-pin/);
});

test('focusing a note with the keyboard highlights its line, and the border changes at once under reduced motion', async ({
  page,
}) => {
  const block = example(page);
  const notes = block.locator('.scb-annotation-notes li');
  expect(await css(notes.first(), 'transitionDuration')).toBe(reduced() ? '0s' : '0.15s, 0.15s');
  await notes.first().focus();
  await expect(block.locator('.ec-line[data-scb-anno="1"]')).toHaveClass(/scb-annotation-lit/);
  await page.keyboard.press('Tab');
  await expect(block.locator('.ec-line[data-scb-anno="2"]')).toHaveClass(/scb-annotation-lit/);
  expect(await css(notes.nth(1), 'outlineStyle')).toBe('solid');
  await expect(block.locator('.ec-line[data-scb-anno="1"]')).not.toHaveClass(/scb-annotation-lit/);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the layout still works', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The phone layout has no column.');
    const [code, notes] = await boxes(example(page));
    expect(notes?.x).toBeGreaterThan((code?.x ?? 0) + (code?.width ?? 0));
  });
});

test('on a page without a table of contents, wide blocks spread evenly as far as the window allows', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Phones have no space beside the content column.');
  const at = async (width: number) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./features/side-annotations/wide/');
  };

  await at(1440);
  for (const [index, width] of [
    [0, 800],
    [1, 1000],
  ] as const) {
    const { column, grid, display, overflow } = await measure(page, index);
    expect(display).toBe('grid');
    expect(grid?.width).toBeCloseTo(width, 0);
    const left = (column?.x ?? 0) - (grid?.x ?? 0);
    const right = (grid?.x ?? 0) + (grid?.width ?? 0) - (column?.x ?? 0) - (column?.width ?? 0);
    expect(Math.abs(left - right)).toBeLessThan(1);
    expect(overflow).toBe(0);
  }
  // A block that fits the content column does not spread.
  const fits = await measure(page, 2);
  expect(fits.display).toBe('grid');
  expect(fits.grid?.x).toBeCloseTo(fits.column?.x ?? 0, 0);
  expect(fits.grid?.width).toBeCloseTo(fits.column?.width ?? 0, 0);

  // Too narrow for the columns of the second block.
  await at(1280);
  expect((await measure(page, 0)).display).toBe('grid');
  const narrow = await measure(page, 1);
  expect(narrow.display).toBe('block');
  expect(narrow.grid?.x).toBeCloseTo(narrow.column?.x ?? 0, 0);
  expect(narrow.grid?.width).toBeCloseTo(narrow.column?.width ?? 0, 0);
  expect(narrow.overflow).toBe(0);

  // No block spreads below the width at which Starlight shows a table of contents.
  await at(1100);
  for (const index of [0, 1]) {
    const { column, grid } = await measure(page, index);
    expect(grid?.width).toBeCloseTo(column?.width ?? 0, 0);
  }
});
