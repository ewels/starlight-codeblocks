import { expect, test } from '@playwright/test';
import { render } from '../../packages/starlight-codeblocks/test/render.ts';
import { copyFromKeyboard, css, example } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/inline-callouts/');
});

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
  const arrow = await block.locator('.scb-callout-bubble').evaluate((el) => {
    const box = el.getBoundingClientRect();
    const after = getComputedStyle(el, '::after');
    return box.left + el.clientLeft + Number.parseFloat(after.left) + Number.parseFloat(after.width) / 2;
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

test('copying leaves the callout out, with the keyboard', async ({ page }) => {
  const copied = await copyFromKeyboard(example(page));
  expect(copied).not.toContain('cancel the request');
  expect(copied).not.toContain('[!callout');
  expect(copied).toContain('const res = await fetch(url, { signal: controller.signal });');
});

test('a manual selection leaves the callout out', async ({ page }) => {
  const style = await css(example(page).locator('.scb-callout'), 'userSelect');
  expect(style).toBe('none');
});

test('the arrow always sits on its bubble, also when the matched text is past the right edge', async ({ page }) => {
  for (const bubble of await page.locator('.scb-callout-bubble').all()) {
    const { arrow, left, right } = await bubble.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const after = getComputedStyle(el, '::after');
      const arrow = box.left + el.clientLeft + Number.parseFloat(after.left) + Number.parseFloat(after.width) / 2;
      return { arrow, left: box.left, right: box.right };
    });
    const text = (await bubble.textContent()) ?? '';
    expect(arrow - left, text).toBeGreaterThanOrEqual(10);
    expect(right - arrow, text).toBeGreaterThanOrEqual(10);
  }
});

test('a short bubble near the right edge moves left instead of wrapping on a desktop', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone block is too narrow for every bubble on one line.');
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const bubble of await page.locator('.scb-callout-bubble').all()) {
    const box = await bubble.boundingBox();
    expect(box?.height, (await bubble.textContent()) ?? '').toBeLessThan(40);
  }
});

test('the bubble starts 40px left of the arrow when it fits', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone block is too narrow for the line.');
  const { html } = await render(
    ['```js', '// [!callout /options/] Short note.', 'const value = compute(input, options);', '```'].join('\n'),
  );
  await page.evaluate((html) => {
    const box = document.createElement('div');
    box.id = 'fit';
    box.innerHTML = html;
    document.querySelector('.sl-markdown-content')?.prepend(box);
  }, html);
  const { arrow, left } = await page.locator('#fit .scb-callout-bubble').evaluate((el) => {
    const box = el.getBoundingClientRect();
    const after = getComputedStyle(el, '::after');
    return {
      arrow: box.left + el.clientLeft + Number.parseFloat(after.left) + Number.parseFloat(after.width) / 2,
      left: box.left,
    };
  });
  expect(arrow - left).toBeCloseTo(40, 0);
});

test('code in a bubble uses the code font, with rounded corners', async ({ page }) => {
  const block = example(page);
  const chip = block.locator('.scb-callout-bubble code').first();
  const [font, codeFont, radius] = await Promise.all([
    css(chip, 'fontFamily'),
    css(block.locator('.ec-line').first(), 'fontFamily'),
    css(chip, 'borderTopLeftRadius'),
  ]);
  expect(font).toBe(codeFont);
  expect(radius).toBe('3px');
});

test('between two marked lines, the callout has the same background and bar as the lines', async ({ page }) => {
  for (const meta of ['{1-2}', 'error={1-2}']) {
    const { html } = await render([`\`\`\`js ${meta}`, 'a()', '// [!callout] Note', 'b()', '```'].join('\n'));
    await page.evaluate((html) => {
      document.querySelector('#scb-injected')?.remove();
      const box = document.createElement('div');
      box.id = 'scb-injected';
      box.innerHTML = html;
      document.querySelector('.sl-markdown-content')?.prepend(box);
    }, html);
    const block = page.locator('#scb-injected');
    const line = block.locator('.ec-line').first();
    const callout = block.locator('.scb-callout');
    const colour = (el: Element) => getComputedStyle(el).backgroundColor;
    expect(await callout.evaluate(colour), meta).toBe(await line.evaluate(colour));
    expect(await callout.evaluate(colour), meta).not.toBe('rgba(0, 0, 0, 0)');
    // The bar is the first pixels of the callout's background image, in the line's border colour.
    const bar = await css(line.locator('.code'), 'borderInlineStartColor');
    expect(await css(callout, 'backgroundImage'), meta).toContain(bar);
  }
});
