import { expect, type Page, test } from '@playwright/test';
import { render } from '../../packages/starlight-codeblocks/test/render.ts';
import { css, example } from './helpers.ts';

/** The bubble's box, and the x of the middle of its arrow. */
const arrow = (el: Element) => {
  const box = el.getBoundingClientRect();
  const after = getComputedStyle(el, '::after');
  const x = box.left + el.clientLeft + Number.parseFloat(after.left) + Number.parseFloat(after.width) / 2;
  return { x, left: box.left, right: box.right };
};

async function inject(page: Page, markdown: string[]) {
  const { html } = await render(markdown.join('\n'));
  await page.evaluate((html) => {
    document.querySelector('#scb-injected')?.remove();
    const box = document.createElement('div');
    box.id = 'scb-injected';
    box.innerHTML = html;
    document.querySelector('.sl-markdown-content')?.prepend(box);
  }, html);
  return page.locator('#scb-injected');
}

test.beforeEach(async ({ page }) => {
  await page.goto('./features/inline-callouts/');
});

test('shows the note in a bubble above its line, inside the block, with its arrow on the bubble', async ({ page }) => {
  const block = example(page);
  const note = block.getByRole('note');
  await expect(note).toHaveText('Lets controller.abort() cancel the request.');
  const line = block.locator('.ec-line').nth(1);
  await expect(line).toContainText('const res');
  expect((await note.boundingBox())?.y).toBeLessThan((await line.boundingBox())?.y ?? 0);

  const bubble = await block.locator('.scb-callout-bubble').boundingBox();
  const pre = await block.locator('pre').boundingBox();
  expect(bubble && pre && bubble.x + bubble.width).toBeLessThanOrEqual((pre?.x ?? 0) + (pre?.width ?? 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await css(block.locator('.scb-callout'), 'userSelect')).toBe('none');

  for (const bubble of await page.locator('.scb-callout-bubble').all()) {
    const { x, left, right } = await bubble.evaluate(arrow);
    const text = (await bubble.textContent()) ?? '';
    expect(x - left, text).toBeGreaterThanOrEqual(10);
    expect(right - x, text).toBeGreaterThanOrEqual(10);
  }

  const chip = block.locator('.scb-callout-bubble code').first();
  expect(await css(chip, 'fontFamily')).toBe(await css(block.locator('.ec-line').first(), 'fontFamily'));
  expect(await css(chip, 'borderTopLeftRadius')).toBe('3px');
});

test('on a desktop, the arrow points at its text, and a bubble moves left instead of wrapping', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'A phone block is too narrow: the token is past the right edge, and bubbles wrap.');
  const block = example(page);
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
  expect(Math.abs((await block.locator('.scb-callout-bubble').evaluate(arrow)).x - token)).toBeLessThan(2);

  for (const bubble of await page.locator('.scb-callout-bubble').all()) {
    expect((await bubble.boundingBox())?.height, (await bubble.textContent()) ?? '').toBeLessThan(40);
  }

  const fit = await inject(page, [
    '```js',
    '// [!callout /options/] Short note.',
    'const value = compute(input, options);',
    '```',
  ]);
  const { x, left } = await fit.locator('.scb-callout-bubble').evaluate(arrow);
  expect(x - left).toBeCloseTo(40, 0);
});

test('between two marked lines, the callout has the same background and bar as the lines', async ({ page }) => {
  for (const meta of ['{1-2}', 'error={1-2}']) {
    const block = await inject(page, [`\`\`\`js ${meta}`, 'a()', '// [!callout] Note', 'b()', 'c()', '```']);
    const line = block.locator('.ec-line').first();
    const callout = block.locator('.scb-callout');
    const background = await css(callout, 'backgroundColor');
    expect(background, meta).toBe(await css(line, 'backgroundColor'));
    expect(background, meta).not.toBe('rgba(0, 0, 0, 0)');
    // The bar is the first pixels of the callout's background image, in the line's border colour.
    const bar = await css(line.locator('.code'), 'borderInlineStartColor');
    expect(await css(callout, 'backgroundImage'), meta).toContain(bar);
  }
  // With a state on every line, the block draws the tint once, under the callout too.
  const all = await inject(page, ['```js error={1-2}', 'a()', '// [!callout] Note', 'b()', '```']);
  expect(await css(all.locator('.scb-callout'), 'backgroundColor')).toBe('rgba(0, 0, 0, 0)');
  expect(await css(all.locator('.scb-callout'), 'backgroundImage')).toBe('none');
  expect(await css(all.locator('pre'), 'backgroundImage')).not.toBe('none');
});
