import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { expect, test } from 'vitest';
import { findColours, swatchFormats, wholeColour } from '../src/expressive-code/swatches.ts';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { remarkFromSatteri } from '../src/satteri/remark.ts';
import { baseStyles, block, render } from './render.ts';

const all = [...swatchFormats];
const found = (text: string, context: 'stylesheet' | 'code' | 'prose', formats = all) =>
  findColours(text, context, formats).map((m) => m.colour);

test('finds every format in a stylesheet declaration', () => {
  expect(
    found(
      'a { color: #fff; background: #ff000080; border: 1px solid rebeccapurple; outline-color: rgb(0 0 0 / 50%); }',
      'stylesheet',
    ),
  ).toEqual(['#fff', '#ff000080', 'rebeccapurple', 'rgb(0 0 0 / 50%)']);
  expect(
    found(
      'x: rgba(255, 0, 0, .5) hsl(120deg 50% 50%) hwb(0 0% 0%) lab(50% 40 59) lch(52 72 50) oklab(0.5 0.1 0.1) oklch(70% 0.1 200) color(display-p3 1 0 0);',
      'stylesheet',
    ),
  ).toHaveLength(8);
});

test('skips things that look like colours but are not', () => {
  // ID selectors, classes, custom properties, Sass variables, SVG fragments, entities and computed values.
  expect(
    found(
      '#bad { } #fab:hover { } .red { --blue: 1; $green: 2; fill: url(#fade); content: "&#123"; color: rgb(var(--r), 0, 0); }',
      'stylesheet',
    ),
  ).toEqual([]);
  expect(found('a:hover, b { color: red; }', 'stylesheet')).toEqual(['red']);
  expect(found('#2563eb { }', 'stylesheet')).toEqual([]);
});

test('in other code, finds only colours that look like values', () => {
  expect(found(`const theme = { fg: '#fff', bg: "#1e1e2e", accent: 'tomato', ring: rgb(0, 0, 0) };`, 'code')).toEqual([
    '#fff',
    '#1e1e2e',
    'tomato',
    'rgb(0, 0, 0)',
  ]);
  expect(found('<rect fill="#ff5f1f" class="bg-[#0ea5e9]" />', 'code')).toEqual(['#ff5f1f', '#0ea5e9']);
  expect(found('// TODO #add the red tan button, see #123', 'code')).toEqual([]);
  expect(found('const red = tan; paint(red); rgb(r, g, b);', 'code')).toEqual([]);
  expect(found('color: #ccc', 'code')).toEqual(['#ccc']);
  expect(found('page.html#facade', 'code')).toEqual([]);
});

test('in prose, skips issue numbers, tags and colour names', () => {
  expect(found('Fixed in #123 and #4567, tagged #cafe and #added, and red text.', 'prose')).toEqual([]);
  expect(found('The brand colour is #ff5f1f, with #0f0 and rgb(0 0 0 / 0.5) accents.', 'prose')).toEqual([
    '#ff5f1f',
    '#0f0',
    'rgb(0 0 0 / 0.5)',
  ]);
});

test('formats filter what matches', () => {
  expect(found('a { color: #fff; border-color: red; }', 'stylesheet', ['hex'])).toEqual(['#fff']);
  expect(found('a { color: #fff; border-color: red; }', 'stylesheet', ['named'])).toEqual(['red']);
});

test('wholeColour accepts inline code that is one colour only', () => {
  expect(wholeColour('#ff5f1f', all)).toBe('#ff5f1f');
  expect(wholeColour(' rebeccapurple ', all)).toBe('rebeccapurple');
  expect(wholeColour('color: red', all)).toBeUndefined();
  expect(wholeColour('red', ['hex'])).toBeUndefined();
  expect(wholeColour('#123', all)).toBeUndefined();
});

test('renders a swatch before each colour, on by default, and keeps the copied text', async () => {
  const code = ['a {', '  color: #ff5f1f;', '  background: rgb(0 0 0 / 50%);', '}'];
  const { html, copyText, warnings } = await render(block('css', ...code));
  expect(html.match(/class="scb-swatch-text"/g)).toHaveLength(2);
  expect(html).toContain('data-scb-colour="#ff5f1f"');
  expect(html).toContain('style="--scb-swatch: rgb(0 0 0 / 50%)"');
  expect(html).toContain('<span class="scb-swatch" aria-hidden="true"></span>');
  expect(html).toContain('data-scb-swatches');
  expect(copyText).toBe(code.join('\n'));
  expect(warnings).toEqual([]);
});

test('swatches=false, the option, languages and copy each turn parts off', async () => {
  const css = block('css', 'a { color: #fff; }');
  expect((await render(block('css swatches=false', 'a { color: #fff; }'))).html).not.toContain('scb-swatch');
  const off = await render(css, { swatches: false });
  expect(off.html).toBe((await render(block('css swatches=false', 'a { color: #fff; }'))).html);
  expect((await render(css, { swatches: { languages: ['js'] } })).html).not.toContain('scb-swatch');
  expect(
    (await render(block('css swatches', 'a { color: #fff; }'), { swatches: { languages: ['js'] } })).html,
  ).toContain('scb-swatch');
  expect((await render(block('js', "const c = '#fff';"), { swatches: { languages: ['javascript'] } })).html).toContain(
    'scb-swatch',
  );
  expect((await render(css, { swatches: { copy: false } })).html).not.toContain('data-scb-swatches');
});

test('shape, size and hover change the styles', async () => {
  const css = await baseStyles({ swatches: { shape: 'circle', size: '10px', hover: false } });
  expect(css).toContain('border-radius:50%');
  expect(css).toContain('width:10px');
  expect(css).not.toMatch(/swatch-text:is\(:hover/);
  expect(await baseStyles()).toMatch(/swatch-text:is\(:hover/);
});

test('validates the options', () => {
  expect(resolveOptions().swatches).toMatchObject({ languages: 'all', shape: 'rounded', prose: false, copy: true });
  expect(() => resolveOptions({ swatches: { shape: 'star' as never } })).toThrow(/swatches.shape/);
  expect(() => resolveOptions({ swatches: { size: '10' } })).toThrow(/swatches.size/);
  expect(() => resolveOptions({ swatches: { formats: ['cmyk' as never] } })).toThrow(/swatches.formats/);
});

async function md(markdown: string, options = {}) {
  const plugin = remarkFromSatteri(mdastPlugins(resolveOptions(options), { warn: () => {} }));
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [plugin] });
  return (await processor.render(markdown, { fileURL: new URL('file:///site/page.md') })).code;
}

test('prose swatches are off by default, and cover text and whole inline code when on', async () => {
  const text = 'Use #ff5f1f, not #123, and `rebeccapurple` or `color: red`.';
  expect(await md(text)).not.toContain('scb-swatch');
  const html = await md(text, { swatches: { prose: true } });
  expect(html.match(/class="scb-swatch-text"/g)).toHaveLength(2);
  expect(html).toContain(
    '<span class="scb-swatch-text" data-scb-colour="#ff5f1f" data-scb-swatches="" style="--scb-swatch: #ff5f1f"><span class="scb-swatch" aria-hidden="true"></span>#ff5f1f</span>',
  );
  expect(html).toContain('<code><span class="scb-swatch-text" data-scb-colour="rebeccapurple"');
  expect(html).toContain('<code>color: red</code>');
});
