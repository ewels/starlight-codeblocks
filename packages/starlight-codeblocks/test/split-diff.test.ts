import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { expect, test } from 'vitest';
import { block, render } from './render.ts';

const toggle = (html: string) => html.match(/<span[^>]*scb-split-switch[^>]*>.*?<\/span>/g);

test('adds a Unified and Split switch to a block with removed and added lines, and keeps the copied text', async () => {
  const { html, copyText, warnings } = await render(block('diff lang="js"', ' a', '-b = 1', '+b = 2', ' c'));
  expect(toggle(html)).toEqual([
    '<span role="group" aria-label="Diff view" class="scb-split-switch scb-no-print scb-needs-js">' +
      '<button type="button" class="scb-btn scb-split-toggle" data-scb-view="unified" aria-pressed="true">Unified</button>' +
      '<button type="button" class="scb-btn scb-split-toggle" data-scb-view="split" aria-pressed="false">Split</button></span>',
  ]);
  expect(html).toContain('<pre data-language="js" data-scb-split-diff="unified" data-scb-split-sync="">');
  expect(copyText).toBe('a\nb = 1\nb = 2\nc');
  expect(warnings).toEqual([]);
});

test.each([
  ['js ins={2} del={1}', 'const port = 8080;', 'const port = env.PORT;'],
  ['js', 'const port = 8080; // [!code --]', 'const port = env.PORT; // [!code ++]'],
])('reads %s the same way as a diff block', async (fence, ...lines) => {
  expect(toggle((await render(block(fence, ...lines))).html)).toHaveLength(1);
});

test.each([
  ['only added lines', block('diff', ' a', '+b')],
  ['only removed lines', block('diff', ' a', '-b')],
  ['splitDiff=false', block('diff splitDiff=false', '-a', '+b')],
  ['splitDiff.switch=false', block('diff splitDiff.switch=false', '-a', '+b')],
  ['a collapsed section', block('diff collapse={1-2}', ' a', ' b', ' c', '-d', '+e')],
])('leaves a block with %s unchanged', async (_, markdown) => {
  const plugins = [pluginCollapsibleSections()];
  const { html } = await render(markdown, {}, plugins);
  expect(html).not.toContain('scb-split');
  expect(html).toBe((await render(markdown, { splitDiff: false }, plugins)).html);
});

const pressed = (html: string) => html.match(/data-scb-view="(\w+)" aria-pressed="true"/)?.[1];

test.each([
  ['the site option', block('diff', '-a', '+b'), { splitDiff: { view: 'split' as const } }],
  ['the fence line', block('diff splitDiff.view="split"', '-a', '+b'), {}],
])('starts in the split view from %s, with Split pressed', async (_, markdown, options) => {
  const { html, warnings } = await render(markdown, options);
  expect(html).toContain('data-scb-split-diff="split" data-scb-split-sync=""');
  expect(pressed(html)).toBe('split');
  expect(warnings).toEqual([]);
});

test('with no switch, a block stays in its view, and a unified block is left as it is', async () => {
  const split = await render(block('diff splitDiff.view="split" splitDiff.switch=false', '-a', '+b'));
  expect(split.html).toContain('<pre data-language="diff" data-scb-split-diff="split">');
  expect(toggle(split.html)).toBeNull();
  const site = { splitDiff: { switch: false } };
  const unified = await render(block('diff', '-a', '+b'), site);
  expect(unified.html).toBe((await render(block('diff', '-a', '+b'), { splitDiff: false })).html);
  expect(toggle((await render(block('diff splitDiff.switch=true', '-a', '+b'), site)).html)).toHaveLength(1);
});

test('a block with sync off switches alone', async () => {
  const { html } = await render(block('diff splitDiff.sync=false', '-a', '+b'));
  expect(html).toContain('<pre data-language="diff" data-scb-split-diff="unified">');
  expect(toggle(html)).toHaveLength(1);
  const site = await render(block('diff', '-a', '+b'), { splitDiff: { sync: false } });
  expect(site.html).not.toContain('data-scb-split-sync');
});

test('warns about a bad value, and keeps the site setting', async () => {
  const { html, warnings } = await render(block('diff splitDiff.view="side" splitDiff.sync=maybe', '-a', '+b'));
  expect(pressed(html)).toBe('unified');
  expect(html).toContain('data-scb-split-sync');
  expect(warnings).toEqual([
    expect.stringContaining('`splitDiff.view="side"` must be `"unified"` or `"split"`'),
    expect.stringContaining('`splitDiff.sync=maybe` must be `true` or `false`'),
  ]);
});
