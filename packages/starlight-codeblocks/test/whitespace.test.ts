import { getColorContrast, onBackground } from '@expressive-code/core';
import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { withTrailingWhitespace } from '../src/expressive-code/whitespace.ts';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

test('shows leading whitespace only by default', async () => {
  const { html, copyText, warnings } = await render(
    block('make title="Makefile" whitespace', 'build:', '\tcargo build --release'),
  );
  expect(html).toContain('<span class="scb-ws-tab"><span aria-hidden="true"></span>');
  expect(html).not.toMatch(/scb-ws[^-]/);
  expect(copyText).toBe('build:\n\tcargo build --release');
  expect(warnings).toEqual([]);
});

test('shows every space and tab with whitespace="all", as an aria-hidden glyph over the real character', async () => {
  const { html, copyText } = await render(block('py whitespace="all"', 'a = 1'));
  expect(html.match(/class="scb-ws"/g)).toHaveLength(2);
  expect(html).toContain('<span class="scb-ws"><span aria-hidden="true"></span><span style=');
  expect(html).toContain('> </span></span>');
  expect(copyText).toBe('a = 1');
});

test('renders the same as without the feature when a block does not use it or the feature is off', async () => {
  const md = block('js title="app.js" {1}', 'a()', '  b()');
  expect((await render(md)).html).toBe((await render(md, { whitespace: false })).html);
  expect((await render(block('py whitespace="all"', 'a = 1'), { whitespace: false })).html).not.toContain('scb-ws');
});

const trailingBlock = (fence: string, ...lines: string[]) =>
  block(withTrailingWhitespace(lines.join('\n'), fence), ...lines);

test('shows and copies trailing whitespace with whitespace="all" only, on the right line', async () => {
  const { html, copyText } = await render(trailingBlock('py whitespace="all"', 'a = 1  ', 'b = 2\t'));
  expect(html.match(/class="scb-ws"/g)).toHaveLength(6);
  expect(html.match(/class="scb-ws-tab"/g)).toHaveLength(1);
  expect(copyText).toBe('a = 1  \nb = 2\t');
  const lines = ['', 'a();', '// [!ref] A note.', 'b(); ', 'c();'];
  expect((await render(trailingBlock('js whitespace="all"', ...lines))).copyText).toBe('a();\nb(); \nc();');
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

test('the glyphs are fainter than the code, but still visible, in every theme', async () => {
  for (const v of await variants()) {
    const bg = v.get('codeBackground');
    const glyph = getColorContrast(onBackground(v.get('codeblocksWhitespace.foreground'), bg), bg);
    expect(glyph, v.name).toBeGreaterThan(1.4);
    expect(glyph, v.name).toBeLessThan(getColorContrast(v.get('codeblocks.mutedForeground'), bg) / 2);
  }
});
