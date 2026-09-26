import { getColorContrast } from '@expressive-code/core';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { ExpressiveCode } from 'expressive-code';
import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { linksValidatorExclude } from '../src/index.ts';
import { resolveOptions } from '../src/options.ts';
import { setRegistry } from '../src/registry.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

test('turns line numbers into links to each line, and gives the block and each line an id', async () => {
  const { html, copyText, warnings } = await render(block('yaml id="cfg"', 'server:', '  port: 8080'));
  expect(html).toContain('id="cfg"');
  expect(html).toContain('data-scb-permalinks');
  expect(html).toContain('--scb-gutter:4.2ch');
  expect(html).toContain(
    '<div class="ec-line" id="cfg-L1"><div class="gutter"><a class="scb-permalink" href="#cfg-L1" aria-label="Link to line 1">1</a></div>',
  );
  expect(html).toContain('href="#cfg-L2"');
  expect(copyText).toBe('server:\n  port: 8080');
  expect(warnings).toEqual([]);
});

test('counts the lines that readers see, from startLineNumber', async () => {
  const { html } = await render(block('js id="app" startLineNumber=9', 'a()', '// [!callout /b/] Note.', 'b()'));
  expect(html).toContain('id="app-L9"');
  expect(html).toContain('href="#app-L10"');
  expect(html).not.toContain('app-L11');
  expect(html).toContain('--scb-gutter:4.2ch');
});

test('widens the gutter for three-digit line numbers', async () => {
  const { html } = await render(block('js id="big" startLineNumber=99', 'a()', 'b()'));
  expect(html).toContain('--scb-gutter:5.2ch');
});

test('keeps the line ids on hidden lines, so that the hidden lines script opens them', async () => {
  const { html } = await render(block('js id="h" hidden={2}', 'a()', 'b()'));
  expect(html).toContain('aria-controls="h-L2"');
  expect(html).toContain('id="h-L2"');
});

test('removes the numbers of the line numbers plugin from blocks with an id', async () => {
  const ec = new ExpressiveCode({ plugins: [pluginLineNumbers(), pluginCodeblocks()] });
  const { renderedGroupAst } = await ec.render({ code: 'a()\nb()', language: 'js', meta: 'id="x"' });
  const { toHtml } = await import('@expressive-code/core/hast');
  const html = toHtml(renderedGroupAst);
  expect(html).not.toContain('<div class="ln"');
  expect(html.match(/class="scb-permalink"/g)).toHaveLength(2);
  const plain = toHtml((await ec.render({ code: 'a()', language: 'js' })).renderedGroupAst);
  expect(plain).toContain('<div class="ln"');
});

test('leaves blocks without an id unchanged, and renders the same with the feature off', async () => {
  const md = block('js', 'a()');
  const on = await render(md);
  expect(on.html).not.toContain('scb-permalink');
  expect(on.html).toBe((await render(md, { permalinks: false })).html);
  expect((await render(block('js id="x"', 'a()'), { permalinks: false })).html).not.toContain('scb-permalink');
});

test('line numbers meet text contrast, and the target bar 3:1', async () => {
  const ec = new ExpressiveCode({ plugins: pluginCodeblocks() });
  await ec.getBaseStyles();
  for (const v of ec.styleVariants) {
    const get = (key: string) => v.resolvedStyleSettings.get(key as never) as string;
    const bg = get('codeBackground');
    expect(getColorContrast(get('codeblocksPermalinks.foreground'), bg)).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(get('codeblocksPermalinks.target'), bg)).toBeGreaterThanOrEqual(3);
  }
});

test('warns when two blocks on one page have the same id', async () => {
  const warnings: string[] = [];
  const plugins = mdastPlugins(resolveOptions(), { warn: (m) => warnings.push(m) });
  const md = ['```js id="a"', 'x', '```', '', '```js id="b"', 'y', '```', '', '```js id="a"', 'z', '```'].join('\n');
  await markdownToHtml(md, { mdastPlugins: plugins, fileURL: new URL('file:///site/page.md') });
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('two code blocks have `id="a"`');
  expect(warnings[0]).toContain('page.md');
});

test('linksValidatorExclude skips mention links and links to blocks with an id', async () => {
  setRegistry({ options: resolveOptions(), plugins: [], clientAssets: true, blockIds: new Set() });
  const plugins = mdastPlugins(resolveOptions(), { warn() {} });
  await markdownToHtml(block('js id="cfg"', 'x'), { mdastPlugins: plugins, fileURL: new URL('file:///site/page.md') });
  const excluded = (link: string) => linksValidatorExclude({ link });
  expect(['#cfg', '#cfg-L2', '#cfg-L2-L5', '/guide/#cfg-L1', '#mention:x', '../a/#mention:y'].map(excluded)).toEqual(
    Array(6).fill(true),
  );
  expect(['#other', '#other-L2', '#cfg-X', '/guide/', 'https://example.com/#cfgx'].map(excluded)).toEqual(
    Array(5).fill(false),
  );
  setRegistry(undefined);
});
