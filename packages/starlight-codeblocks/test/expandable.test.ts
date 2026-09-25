import { expect, test } from 'vitest';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const many = (n: number) => Array.from({ length: n }, (_, i) => `line(${i})`);

test('caps a block at the site default of 12 lines with expandable', async () => {
  const { html, copyText, warnings } = await render(block('js expandable', ...many(20)));
  expect(html).toContain('data-scb-expandable="12"');
  expect(html).toContain('class="scb-expandable-bar scb-no-print"');
  expect(html).toContain('Show all 20 lines');
  expect(copyText.split('\n')).toHaveLength(20);
  expect(warnings).toEqual([]);
});

test('caps a block at N lines with expandable={N}', async () => {
  const { html } = await render(block('py title="report.py" expandable={8}', ...many(15)));
  expect(html).toContain('data-scb-expandable="8"');
  expect(html).toContain('Show all 15 lines');
});

test('does not collapse a block where fewer than 3 lines would be hidden', async () => {
  const { html } = await render(block('js expandable={10}', ...many(12)));
  expect(html).not.toContain('scb-expandable');
});

test('does not collapse a block shorter than the cap', async () => {
  const { html } = await render(block('js expandable={10}', ...many(5)));
  expect(html).not.toContain('scb-expandable');
});

test('renders a block without expandable the same as without the feature', async () => {
  const md = block('js title="a.js" {1}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { expandable: false })).html);
});

test('respects the expandable.lines site default', async () => {
  const { html } = await render(block('js expandable', ...many(10)), { expandable: { lines: 6 } });
  expect(html).toContain('data-scb-expandable="6"');
});

test('does nothing when the feature is off, even with the attribute', async () => {
  const { html } = await render(block('js expandable={5}', ...many(10)), { expandable: false });
  expect(html).not.toContain('scb-expandable');
});
