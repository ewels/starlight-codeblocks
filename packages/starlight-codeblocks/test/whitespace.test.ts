import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { withTrailingWhitespace } from '../src/expressive-code/whitespace.ts';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
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

const trailingBlock = (fence: string, ...lines: string[]) =>
  block(withTrailingWhitespace(lines.join('\n'), fence), ...lines);

test('shows trailing whitespace with whitespace="all", and copies it', async () => {
  const { html, copyText } = await render(trailingBlock('py whitespace="all"', 'a = 1  ', 'b = 2\t'));
  expect(html.match(/class="scb-ws"/g)).toHaveLength(6);
  expect(html.match(/class="scb-ws-tab"/g)).toHaveLength(1);
  expect(copyText).toBe('a = 1  \nb = 2\t');
});

test('puts trailing whitespace back on the right line after blank lines and removed directive lines', async () => {
  const { copyText } = await render(
    trailingBlock('js whitespace="all"', '', 'a();', '// [!ref] A note.', 'b(); ', 'c();'),
  );
  expect(copyText).toBe('a();\nb(); \nc();');
});

test('the default, leading-only mode leaves trailing whitespace out', () => {
  expect(withTrailingWhitespace('a  ', 'py whitespace')).toBe('py whitespace');
});

test('the Markdown plugin records trailing whitespace for whitespace="all" blocks', async () => {
  const metas: (string | null | undefined)[] = [];
  const spy = { name: 'spy', code: (node: { meta?: string | null }) => void metas.push(node.meta) };
  const md = ['```py whitespace="all"', 'a = 1  ', '```', '', '```py whitespace', 'b = 2  ', '```'].join('\n');
  await markdownToHtml(md, {
    mdastPlugins: [...mdastPlugins(resolveOptions(), { warn() {} }), spy],
    fileURL: new URL('file:///site/page.md'),
  });
  expect(metas).toEqual([withTrailingWhitespace('a = 1  ', 'whitespace="all"'), 'whitespace']);
});
