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
