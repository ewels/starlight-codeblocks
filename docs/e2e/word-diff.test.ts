import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test('marks changed words by shape in the code colour, keeps their syntax colours, and pads the markers', async ({
  page,
}) => {
  await page.goto('./features/word-level-diff/');
  const block = example(page);
  const decoration = (selector: string) => css(block.locator(selector).first(), 'textDecorationLine');
  expect(await decoration('.scb-worddiff-ins')).toBe('underline');
  expect(await decoration('.scb-worddiff-del')).toBe('line-through');

  const [fg, ...lines] = await block.locator('.scb-worddiff-ins, .scb-worddiff-del').evaluateAll((els) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--ec-codeFg)';
    els[0]?.closest('.expressive-code')?.append(probe);
    const fg = getComputedStyle(probe).color;
    probe.remove();
    return [fg, ...new Set(els.map((el) => getComputedStyle(el).textDecorationColor))];
  });
  expect(lines).toEqual([fg]);

  const colours = await block
    .locator('.scb-worddiff-ins span')
    .evaluateAll((els) => [...new Set(els.map((el) => getComputedStyle(el).color))]);
  const chroma = (c: string) => {
    const [r = 0, g = 0, b = 0] = (c.match(/\d+/g) ?? []).map(Number);
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  expect(colours.filter((c) => chroma(c) >= 40).length).toBeGreaterThanOrEqual(2);

  const pad = await block
    .locator('.ec-line.ins .code')
    .first()
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingInlineStart));
  expect(pad).toBeGreaterThan(20);
});
