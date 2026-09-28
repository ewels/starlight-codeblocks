import { getColorContrast } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { pluginCore } from '../src/expressive-code/core.ts';
import { pluginFootnotes } from '../src/expressive-code/footnotes.ts';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

test('turns [!ref] into a badge on the next line, described by an item in the list', async () => {
  const { html, copyText, warnings } = await render(block('py', 'import os', '# [!ref] Creates `app`.', 'app = 1'));
  const badge = html.match(
    /<a class="scb-footnote-badge" href="#([\w-]+)" id="([\w-]+)" aria-label="Footnote 1" aria-describedby="\1-text" data-scb-fn="1">1<\/a><\/div><\/div><\/code><\/pre>/,
  );
  expect(badge).toBeTruthy();
  const [, note, ref] = badge as RegExpMatchArray;
  expect(html).toContain(
    `<ol class="scb-footnotes"><li id="${note}" tabindex="-1" data-scb-fn="1"><a class="scb-footnote-num" href="#${ref}" aria-label="Footnote 1, for line 2">1.</a><span id="${note}-text">Creates <code>app</code>.</span></li></ol>`,
  );
  expect(html).toContain('data-scb-footnotes=""');
  expect(html).not.toContain('[!ref]');
  expect(copyText).toBe('import os\napp = 1');
  expect(warnings).toEqual([]);
});

test('an escaped [\\!ref] stays as a plain comment', async () => {
  const { html, warnings } = await render(block('py', '# [\\!ref] Note', 'a = 1'));
  expect(html).toContain('[!ref] Note');
  expect(html).not.toContain('scb-footnote-badge');
  expect(warnings).toEqual([]);
});

test('numbers footnotes from 1 in line order', async () => {
  const { html } = await render(block('py', '# [!ref] First', 'a = 1', '# [!ref] Second', 'b = 2'));
  expect(html.match(/aria-label="Footnote \d"/g)).toEqual(['aria-label="Footnote 1"', 'aria-label="Footnote 2"']);
  expect(html).toContain('aria-label="Footnote 2, for line 2"');
});

test('makes the list sticky with footnotes="sticky" or the site option, and static with footnotes="static"', async () => {
  const md = (attr: string) => block(`py ${attr}`, '# [!ref] Note', 'a = 1');
  expect((await render(md(''))).html).not.toContain('scb-footnotes-sticky');
  expect((await render(md('footnotes="sticky"'))).html).toContain('scb-footnotes-sticky');
  expect((await render(md(''), { footnotes: { sticky: true } })).html).toContain('scb-footnotes-sticky');
  expect((await render(md('footnotes="static"'), { footnotes: { sticky: true } })).html).not.toContain(
    'scb-footnotes-sticky',
  );
});

test('warns about an unknown footnotes value', async () => {
  const { warnings } = await render(block('py footnotes="top"', '# [!ref] Note', 'a = 1'));
  expect(warnings.join('\n')).toContain('`footnotes="top"` must be');
});

test('keeps the directive with a warning when footnotes are off', async () => {
  const { html, warnings } = await render(block('py', '# [!ref] Note', 'a = 1'), { footnotes: false });
  expect(html).not.toContain('scb-footnote');
  expect(warnings.join('\n')).toContain('is not a known directive');
});

test('renders a block without footnotes the same as without the feature', async () => {
  const md = block('js title="a.js"', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { footnotes: false })).html);
});

test('footnote colours meet their contrast targets in both themes', async () => {
  for (const v of await variants([pluginCore(), pluginFootnotes()])) {
    const get = (key: string) => v.get(`codeblocksFootnotes.${key}`);
    const bg = v.get('codeBackground');
    expect(getColorContrast(get('numberForeground'), bg), v.name).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(get('accent'), bg), v.name).toBeGreaterThanOrEqual(3);
    expect(getColorContrast(get('activeForeground'), get('accent')), v.name).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(get('numberForeground'), get('lineBackground')), v.name).toBeGreaterThanOrEqual(4.5);
  }
});

test('the footnote label counts from startLineNumber', async () => {
  const { html } = await render(block('py startLineNumber=10', 'import os', '# [!ref] Creates `app`.', 'app = 1'));
  expect(html).toContain('aria-label="Footnote 1, for line 11"');
});

test('the list goes below the expandable bar, so that the bar stays under the code', async () => {
  const { html } = await render(
    block('py expandable={2}', '# [!ref] One', 'a = 1', 'b = 2', 'c = 3', 'd = 4', 'e = 5'),
  );
  expect(html).toMatch(/<\/pre><div class="scb-expandable-bar[^"]*">.*?<\/div><ol class="scb-footnotes">/);
});
