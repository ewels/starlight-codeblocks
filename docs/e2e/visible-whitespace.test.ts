import { expect, test } from '@playwright/test';
import { output } from './helpers.ts';

test('tabs keep their width, glyphs sit mid-line in a faint colour, and a selection has the real whitespace', async ({
  page,
}) => {
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
      expected: size - (2 % size),
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

  const glyph = page.locator('.example .pane .scb-ws > [aria-hidden]').first();
  await expect(glyph).toBeAttached();
  const { colour, fg } = await glyph.evaluate((el) => ({
    colour: getComputedStyle(el, '::before').color,
    fg: (() => {
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
    fg
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number),
  );
  expect(alpha).toBeGreaterThan(0.25);
  expect(alpha).toBeLessThan(0.45);

  const text = await output(page)
    .locator('pre')
    .evaluate((el) => {
      getSelection()?.selectAllChildren(el);
      return getSelection()?.toString() ?? '';
    });
  expect(text).toContain('\tcargo build --release');
  expect(text).toContain('    cargo test');
  expect(text).not.toContain('·');
});
