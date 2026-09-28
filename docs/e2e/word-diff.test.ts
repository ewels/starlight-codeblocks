import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./features/word-level-diff/');
});

const example = (page: import('@playwright/test').Page) =>
  page.locator('.example').first().locator('.pane.output').locator('.expressive-code');

test('marks changed words by shape as well as by tint', async ({ page }) => {
  const block = example(page);
  const decoration = (selector: string) =>
    block
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(await decoration('.scb-worddiff-ins')).toBe('underline');
  expect(await decoration('.scb-worddiff-del')).toBe('line-through');
  await expect(block.locator('.scb-worddiff-ins').first()).toHaveAttribute('role', 'insertion');
  await expect(block.locator('.scb-worddiff-del').first()).toHaveAttribute('role', 'deletion');
});

test('a diff block leaves a gap between the + and - markers and the code', async ({ page }) => {
  const pad = await example(page)
    .locator('.ec-line.ins .code')
    .first()
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingInlineStart));
  expect(pad).toBeGreaterThan(20);
});

test('changed words keep their syntax colours', async ({ page }) => {
  const colours = await example(page)
    .locator('.scb-worddiff-ins span')
    .evaluateAll((els) => [...new Set(els.map((el) => getComputedStyle(el).color))]);
  const chroma = (c: string) => {
    const [r = 0, g = 0, b = 0] = (c.match(/\d+/g) ?? []).map(Number);
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  expect(colours.filter((c) => chroma(c) >= 40).length).toBeGreaterThanOrEqual(2);
});

test('the underline and the line-through have one colour, the code foreground', async ({ page }) => {
  const colours = await example(page)
    .locator('.scb-worddiff-ins, .scb-worddiff-del')
    .evaluateAll((els) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--ec-codeFg)';
      els[0]?.closest('.expressive-code')?.append(probe);
      const fg = getComputedStyle(probe).color;
      probe.remove();
      return [fg, ...new Set(els.map((el) => getComputedStyle(el).textDecorationColor))];
    });
  expect(colours.length).toBe(2);
  expect(colours[1]).toBe(colours[0]);
});
