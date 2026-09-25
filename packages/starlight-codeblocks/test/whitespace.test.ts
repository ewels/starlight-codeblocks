import { expect, test } from 'vitest';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

test('shows leading whitespace only by default', async () => {
  const { html, copyText, warnings } = await render(
    block('make title="Makefile" whitespace', 'build:', '\tcargo build --release'),
  );
  expect(html).toContain('<span class="scb-ws-tab"><span aria-hidden="true"></span>');
  expect(html).not.toMatch(/scb-ws[^-]/); // no glyph on the internal spaces of "cargo build --release"
  expect(copyText).toBe('build:\n\tcargo build --release');
  expect(warnings).toEqual([]);
});

test('shows every space and tab with whitespace="all"', async () => {
  const { html, copyText } = await render(block('py whitespace="all"', 'a = 1'));
  expect(html.match(/class="scb-ws"/g)).toHaveLength(2);
  expect(copyText).toBe('a = 1');
});

test('the glyph is aria-hidden, and the real character stays in the line', async () => {
  const { html } = await render(block('py whitespace="all"', 'a = 1'));
  expect(html).toContain('<span class="scb-ws"><span aria-hidden="true"></span><span style=');
  expect(html).toContain('> </span></span>');
});

test('renders a block without the attribute the same as without the feature', async () => {
  const md = block('js title="app.js" {1}', 'a()', '  b()');
  expect((await render(md)).html).toBe((await render(md, { whitespace: false })).html);
});

test('does nothing when the feature is off, even with the attribute', async () => {
  const { html } = await render(block('py whitespace="all"', 'a = 1'), { whitespace: false });
  expect(html).not.toContain('scb-ws');
});
