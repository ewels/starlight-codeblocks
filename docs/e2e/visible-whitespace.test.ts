import { expect, test } from '@playwright/test';

test('a tab keeps its width to the next tab stop, with the arrow at its start', async ({ page }) => {
  await page.goto('./features/visible-whitespace/');
  const tab = page.locator('.example .pane .scb-ws-tab').first();
  await expect(tab).toBeAttached();
  const result = await tab.evaluate((el) => {
    const code = el.closest('.code') as HTMLElement;
    const probe = document.createElement('span');
    probe.textContent = 'ab';
    const midline = el.cloneNode(true) as HTMLElement;
    code.prepend(probe, midline);
    const ch = probe.getBoundingClientRect().width / 2;
    const size = Number(getComputedStyle(code).tabSize) || 8;
    const glyph = midline.firstElementChild as HTMLElement;
    const out = {
      width: midline.getBoundingClientRect().width / ch,
      expected: size - 2,
      glyphLeft: glyph.getBoundingClientRect().left - midline.getBoundingClientRect().left,
      align: getComputedStyle(glyph, '::before').textAlign,
      text: midline.textContent,
    };
    probe.remove();
    midline.remove();
    return out;
  });
  expect(result.text).toBe('\t');
  expect(result.width).toBeCloseTo(result.expected, 1);
  expect(result.glyphLeft).toBe(0);
  expect(['start', 'left']).toContain(result.align);
});

test('a manual selection gives the real tab and spaces, not the glyphs', async ({ page }) => {
  await page.goto('./features/visible-whitespace/');
  const pre = page.locator('.example').first().locator('.pane.output').locator('pre');
  const text = await pre.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString() ?? '';
  });
  expect(text).toContain('\tcargo build --release');
  expect(text).toContain('    cargo test');
  expect(text).not.toContain('·');
});

test('the glyphs sit on the middle of the line, like the text', async ({ page }) => {
  await page.goto('./features/visible-whitespace/');
  const spaces = page.locator('.example .pane .scb-ws');
  await expect(spaces.first()).toBeAttached();
  const offset = await spaces.first().evaluate((el) => {
    const style = document.createElement('style');
    style.textContent = '.scb-probe::before { content: none !important; }';
    document.head.append(style);
    const host = el.firstElementChild as HTMLElement;
    host.classList.add('scb-probe');
    const glyph = document.createElement('span');
    glyph.style.display = 'block';
    glyph.textContent = '·';
    host.append(glyph);
    const a = glyph.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const out = a.top + a.height / 2 - (b.top + b.height / 2);
    glyph.remove();
    host.classList.remove('scb-probe');
    style.remove();
    return out;
  });
  expect(Math.abs(offset)).toBeLessThan(1);
});

test('whitespace="all" shows trailing whitespace', async ({ page }) => {
  await page.goto('./features/visible-whitespace/');
  const code = page.locator('.example').nth(1).locator('.pane.output .ec-line .code').first();
  await expect(code.locator(':scope > :last-child')).toHaveClass('scb-ws');
});

test('the source of the trailing whitespace example keeps its trailing space, on screen and in the copy', async ({
  page,
}) => {
  await page.goto('./features/visible-whitespace/');
  const source = page.locator('.example').nth(1).locator('.pane.source');
  expect(await source.locator('.ec-line').nth(1).textContent()).toBe('-  const width = 10; ');
  const copied = await source.locator('.copy button').getAttribute('data-code');
  expect(copied).toContain('-  const width = 10; \x7F');
});

test('the glyphs are faint: about a third of the way from the code background to the code text', async ({ page }) => {
  await page.goto('./features/visible-whitespace/');
  const glyph = page.locator('.example .pane .scb-ws > [aria-hidden]').first();
  await expect(glyph).toBeAttached();
  const { colour, text } = await glyph.evaluate((el) => ({
    colour: getComputedStyle(el, '::before').color,
    text: (() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--ec-codeFg)';
      el.append(probe);
      const out = getComputedStyle(probe).color;
      probe.remove();
      return out;
    })(),
  }));
  const [r, g, b, alpha] = colour.match(/[\d.]+/g)?.map(Number) ?? [];
  expect([r, g, b]).toEqual(
    text
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number),
  );
  expect(alpha).toBeGreaterThan(0.25);
  expect(alpha).toBeLessThan(0.45);
});
