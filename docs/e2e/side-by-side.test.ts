import { expect, test } from '@playwright/test';
import { css, example, reduced } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/side-by-side-annotations/');
});

test('the notes are a column beside the code on a desktop, and a list under it on a phone', async ({
  page,
  isMobile,
}) => {
  const block = example(page);
  const code = await block.locator('figure').boundingBox();
  const notes = await block.locator('.scb-annotation-notes').boundingBox();
  if (isMobile) {
    expect(notes?.y).toBeGreaterThanOrEqual((code?.y ?? 0) + (code?.height ?? 0));
  } else {
    expect(notes?.x).toBeGreaterThan((code?.x ?? 0) + (code?.width ?? 0));
    expect(Math.abs((notes?.y ?? 0) - (code?.y ?? 0))).toBeLessThan(2);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('codeSide="right" puts the notes in the left column', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone layout has no column.');
  const block = example(page, 2);
  await expect(block.locator('.scb-side-code-right')).toBeAttached();
  const [code, notes] = await Promise.all([
    block.locator('figure').boundingBox(),
    block.locator('.scb-annotation-notes').boundingBox(),
  ]);
  expect((notes?.x ?? 0) + (notes?.width ?? 0)).toBeLessThanOrEqual(code?.x ?? 0);
  expect(Math.abs((notes?.y ?? 0) - (code?.y ?? 0))).toBeLessThan(2);
});

test('the notes column sticks below the header while the block scrolls past', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone layout has no column.');
  const block = example(page);
  await block.locator('.ec-line').nth(16).scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 200));
  const notes = await block.locator('.scb-annotation-notes').boundingBox();
  const header = await page.locator('header.header').boundingBox();
  expect(notes?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
  expect(notes?.y).toBeLessThan((header?.height ?? 0) + 40);
});

test('the notes column stops sticking when it is taller than the space below the header', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The phone layout has no column.');
  await page.setViewportSize({ width: 1024, height: 260 });
  const block = page.locator('[data-scb-annotations]').first();
  await expect(block).toHaveClass(/scb-side-static/);
  expect(await css(block.locator('.scb-annotation-notes'), 'position')).toBe('static');
});

test('hovering over a note highlights its line, and hovering over a line highlights its note', async ({ page }) => {
  const block = example(page);
  const note = block.locator('.scb-annotation-notes li').nth(1);
  const line = block.locator('.ec-line[data-scb-anno="2"]');
  await note.hover();
  await expect(line).toHaveClass(/scb-annotation-lit/);
  const bg = await css(line, 'backgroundColor');
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  await block.locator('.ec-line[data-scb-anno="3"]').hover();
  await expect(block.locator('.scb-annotation-notes li').nth(2)).toHaveClass(/scb-annotation-on/);
  await expect(line).not.toHaveClass(/scb-annotation-lit/);
});

test('a line marker takes the hover colour of annotation markers', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones have no hover.');
  const marker = example(page).locator('.scb-annotation-num').first();
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

test('focusing a note with the keyboard highlights its line', async ({ page }) => {
  const block = example(page);
  await block.locator('.scb-annotation-notes li').first().focus();
  await expect(block.locator('.ec-line[data-scb-anno="1"]')).toHaveClass(/scb-annotation-lit/);
  await page.keyboard.press('Tab');
  await expect(block.locator('.ec-line[data-scb-anno="2"]')).toHaveClass(/scb-annotation-lit/);
  const outline = await css(block.locator('.scb-annotation-notes li').nth(1), 'outlineStyle');
  expect(outline).toBe('solid');
  await expect(block.locator('.ec-line[data-scb-anno="1"]')).not.toHaveClass(/scb-annotation-lit/);
});

test('the note border changes instantly under reduced motion', async ({ page }) => {
  const duration = await css(example(page).locator('.scb-annotation-notes li').first(), 'transitionDuration');
  expect(duration).toBe(reduced() ? '0s' : '0.15s');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the layout still works', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The phone layout has no column.');
    const block = example(page);
    const code = await block.locator('figure').boundingBox();
    const notes = await block.locator('.scb-annotation-notes').boundingBox();
    expect(notes?.x).toBeGreaterThan((code?.x ?? 0) + (code?.width ?? 0));
  });
});

test('the code of every example fits its column on a desktop, without a scroll bar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'On a phone the code can scroll.');
  const pres = page.locator('.scb-side-grid pre');
  expect(await pres.count()).toBeGreaterThan(1);
  for (const width of [1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [i, pre] of (await pres.all()).entries()) {
      const [scroll, client] = await pre.evaluate((el) => [el.scrollWidth, el.clientWidth]);
      expect(scroll, `block ${i + 1} at ${width}px`).toBeLessThanOrEqual(client);
    }
  }
});

type Page = import('@playwright/test').Page;

/** The box of a side-by-side block's grid and the content column, and whether the notes are beside the code. */
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

test.describe('on a page without a table of contents', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones have no space beside the content column.');

  test('wide blocks spread by the same amount on each side, as far as the columns need', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./features/side-by-side-annotations/wide/');
    for (const [index, width] of [
      [0, 800],
      [1, 1000],
    ]) {
      const { column, grid, display, overflow } = await measure(page, index);
      expect(display).toBe('grid');
      expect(grid?.width).toBeCloseTo(width, 0);
      const left = (column?.x ?? 0) - (grid?.x ?? 0);
      const right = (grid?.x ?? 0) + (grid?.width ?? 0) - (column?.x ?? 0) - (column?.width ?? 0);
      expect(Math.abs(left - right)).toBeLessThan(1);
      expect(overflow).toBe(0);
    }
  });

  test('a block that fits the content column does not spread', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./features/side-by-side-annotations/wide/');
    const { column, grid, display } = await measure(page, 2);
    expect(display).toBe('grid');
    expect(grid?.x).toBeCloseTo(column?.x ?? 0, 0);
    expect(grid?.width).toBeCloseTo(column?.width ?? 0, 0);
  });

  test('a block keeps to the content column when the window is too narrow for its columns', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('./features/side-by-side-annotations/wide/');
    expect((await measure(page, 0)).display).toBe('grid');
    const { column, grid, display, overflow } = await measure(page, 1);
    expect(display).toBe('block');
    expect(grid?.x).toBeCloseTo(column?.x ?? 0, 0);
    expect(grid?.width).toBeCloseTo(column?.width ?? 0, 0);
    expect(overflow).toBe(0);
  });

  test('no block spreads below the width at which Starlight shows a table of contents', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('./features/side-by-side-annotations/wide/');
    for (const index of [0, 1]) {
      const { column, grid } = await measure(page, index);
      expect(grid?.width).toBeCloseTo(column?.width ?? 0, 0);
    }
  });
});

test('a wide block keeps to the content column on a page with a table of contents', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone layout has no column.');
  await page.setViewportSize({ width: 1920, height: 900 });
  const { render } = await import('../../packages/starlight-codeblocks/test/render.ts');
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
