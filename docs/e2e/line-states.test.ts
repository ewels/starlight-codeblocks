import { expect, test } from '@playwright/test';
import { example } from './helpers.ts';

test('marks a state with a bar and a centred label, for screen readers too, and not in a selection', async ({
  page,
}) => {
  await page.goto('./features/line-states/');
  const block = example(page);
  const line = block.locator('.scb-state-error');
  const bar = await line
    .locator('.code')
    .evaluate((el) => [getComputedStyle(el).borderInlineStartWidth, getComputedStyle(el).borderInlineStartStyle]);
  expect(bar).toEqual(['3px', 'solid']);
  await expect(line).toMatchAriaSnapshot(`- text: "Error: for name in sys.argv[1:] SyntaxError: expected ':'"`);

  const { offset, gap } = await line.locator('.scb-state-label').evaluate((el) => {
    const line = (el.closest('.ec-line') as Element).getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const name = (el.querySelector('strong') as Element).getBoundingClientRect();
    const range = document.createRange();
    range.setStart(el.childNodes[1], 1);
    range.setEnd(el.childNodes[1], 2);
    return {
      offset: (box.top + box.bottom - line.top - line.bottom) / 2,
      gap: range.getBoundingClientRect().left - name.right,
    };
  });
  expect(Math.abs(offset)).toBeLessThan(0.3);
  expect(Math.abs(gap - 6)).toBeLessThan(0.5);

  const selected = await block.locator('pre code').evaluate((code) => {
    getSelection()?.selectAllChildren(code);
    return getSelection()?.toString();
  });
  expect(selected).toContain('for name in sys.argv[1:]');
  expect(selected).not.toContain('Error');
  expect(selected).not.toContain('Note');
});
