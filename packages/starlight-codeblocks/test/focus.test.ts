import { expect, test } from 'vitest';
import { baseStyles, block, lineClasses, render } from './render.ts';

test('blurs the lines outside focus={range}, and makes the code a named focusable region', async () => {
  const { html, copyText, warnings } = await render(block('js focus={2-3}', 'a()', 'b()', 'c()', 'd()'));
  expect(lineClasses(html)).toEqual(['ec-line scb-focus-out', 'ec-line', 'ec-line', 'ec-line scb-focus-out']);
  expect(html).toContain('<pre data-language="js"><code tabindex="0" role="region" aria-label="Code block">');
  expect(copyText).toBe('a()\nb()\nc()\nd()');
  expect(warnings).toEqual([]);
  const titled = await render(block('js title="app.js" focus={1}', 'a()', 'b()'));
  expect(titled.html).toContain('<code tabindex="0" role="region" aria-label="Code: app.js">');
});

test('focuses lines with [!code focus] and [!code focus:N], combined with the attribute', async () => {
  const { html, copyText } = await render(
    block('js focus={6}', 'a() // [!code focus]', 'b()', 'c() // [!code focus:2]', 'd()', 'e()', 'f()'),
  );
  expect(lineClasses(html)).toEqual([
    'ec-line',
    'ec-line scb-focus-out',
    'ec-line',
    'ec-line',
    'ec-line scb-focus-out',
    'ec-line',
  ]);
  expect(copyText).toBe('a()\nb()\nc()\nd()\ne()\nf()');
});

test('renders as without the feature when a block has no focus, and leaves directives when it is off', async () => {
  const md = block('js title="app.js" {2}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { focus: false })).html);
  const { copyText, warnings } = await render(block('js', 'a() // [!code focus]'), { focus: false });
  expect(copyText).toBe('a() // [!code focus]');
  expect(warnings).toHaveLength(1);
});

test('warns about lines outside the block, and fails the build for a bad range', async () => {
  const { html, warnings } = await render(block('js focus={1,5}', 'a()', 'b()'));
  expect(lineClasses(html)).toEqual(['ec-line', 'ec-line scb-focus-out']);
  expect(warnings).toEqual([
    'src/content/docs/example.md, js code block: `focus={1,5}` names line 5, but the block has 2 lines. The plugin ignores it.',
  ]);
  await expect(render(block('js focus={a}', 'a()'))).rejects.toThrow('`focus={a}` is not a valid range');
});

test('blurs by default and only fades with style: dim', async () => {
  const blur = await baseStyles();
  expect(blur).toMatch(/\.scb-focus-out\{[^}]*filter:blur\(var\(--ec-codeblocksFocus-blur\)\)/);
  expect(blur).toMatch(/\.frame:not\(\.scb-scrolly-frame\):hover \.scb-focus-out/);
  expect(blur).toMatch(/\.frame:focus-within \.scb-focus-out/);
  expect(blur).toMatch(/\.scb-focus-out:is\(\.scb-mention-on, \.scb-permalink-target, \.scb-annotation-lit,/);
  const dim = await baseStyles({ focus: { style: 'dim' } });
  expect(dim).toMatch(/\.scb-focus-out\{opacity:var\(--ec-codeblocksFocus-opa\);transition/);
});
