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
  const pre = page.locator('.example').first().locator('.pane').nth(1).locator('pre');
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
