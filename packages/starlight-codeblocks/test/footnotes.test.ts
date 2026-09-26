import { getColorContrast } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCore } from '../src/expressive-code/core.ts';
import { pluginFootnotes } from '../src/expressive-code/footnotes.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

test('turns [!ref] into a badge on the next line and an item in the list', async () => {
  const { html, copyText, warnings } = await render(block('py', 'import os', '# [!ref] Creates `app`.', 'app = 1'));
  const badge = html.match(
    /<a class="scb-footnote-badge" href="#([\w-]+)" id="([\w-]+)" aria-label="Footnote 1" data-scb-fn="1">1<\/a><\/div><\/div><\/code><\/pre>/,
  );
  expect(badge).toBeTruthy();
  const [, note, ref] = badge as RegExpMatchArray;
  expect(html).toContain(
    `<ol class="scb-footnotes"><li id="${note}" data-scb-fn="1"><a class="scb-footnote-num" href="#${ref}" aria-label="Footnote 1, for line 2">1.</a><span>Creates <code>app</code>.</span></li></ol>`,
  );
  expect(html).toContain('data-scb-footnotes=""');
  expect(html).not.toContain('[!ref]');
  expect(copyText).toBe('import os\napp = 1');
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
  const ec = new ExpressiveCode({ plugins: [pluginCore(), pluginFootnotes()] });
  await ec.getBaseStyles();
  const backgrounds = { dark: ['#23262f', '#24292e'], light: ['#f6f7f9', '#ffffff'] };
  for (const variant of ec.styleVariants) {
    const get = (key: string) => variant.resolvedStyleSettings.get(`codeblocksFootnotes.${key}` as never) as string;
    for (const bg of backgrounds[variant.theme.type]) {
      expect(getColorContrast(get('numberForeground'), bg)).toBeGreaterThanOrEqual(4.5);
      expect(getColorContrast(get('accent'), bg)).toBeGreaterThanOrEqual(3);
    }
    expect(getColorContrast(get('activeForeground'), get('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(getColorContrast(get('numberForeground'), get('lineBackground'))).toBeGreaterThanOrEqual(4.5);
  }
});

test('the footnote label counts from startLineNumber', async () => {
  const { html } = await render(block('py startLineNumber=10', 'import os', '# [!ref] Creates `app`.', 'app = 1'));
  expect(html).toContain('aria-label="Footnote 1, for line 11"');
});
