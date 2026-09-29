import { expect, test } from '@playwright/test';
import { css, example } from './helpers.ts';

test('marks changed words with a bar, strikes removed ones in the code colour, keeps some syntax colour, and pads the markers', async ({
  page,
}) => {
  await page.goto('./features/word-level-diff/');
  const block = example(page);
  const decoration = (selector: string) => css(block.locator(selector).first(), 'textDecorationLine');
  expect(await decoration('.scb-worddiff-ins')).toBe('none');
  expect(await css(block.locator('.scb-worddiff-ins').first(), 'boxShadow')).toContain('0px -2px 0px 0px inset');
  expect(await decoration('.scb-worddiff-del')).toBe('line-through');

  const [fg, ...lines] = await block.locator('.scb-worddiff-del').evaluateAll((els) => {
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
  // A dark tint strong enough to see makes the contrast pass lighten the words towards pastels.
  const vivid = (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' ? 20 : 40;
  expect(colours.filter((c) => chroma(c) >= vivid).length).toBeGreaterThanOrEqual(2);

  const pad = await block
    .locator('.ec-line.ins .code')
    .first()
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingInlineStart));
  expect(pad).toBeGreaterThan(20);
});
