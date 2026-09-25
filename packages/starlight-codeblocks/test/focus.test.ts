import { expect, test } from 'vitest';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const lineClasses = (html: string) => html.match(/<div class="ec-line[^"]*"/g)?.map((m) => m.slice(12, -1));

test('blurs the lines outside focus={range}', async () => {
  const { html, copyText, warnings } = await render(block('js focus={2-3}', 'a()', 'b()', 'c()', 'd()'));
  expect(lineClasses(html)).toEqual(['ec-line scb-focus-out', 'ec-line', 'ec-line', 'ec-line scb-focus-out']);
  expect(html).toContain('<pre data-language="js"><code tabindex="0">');
  expect(copyText).toBe('a()\nb()\nc()\nd()');
  expect(warnings).toEqual([]);
});

test('focuses lines with [!code focus] and [!code focus:N]', async () => {
  const { html, copyText } = await render(
    block('js', 'a() // [!code focus]', 'b()', 'c() // [!code focus:2]', 'd()', 'e()'),
  );
  expect(lineClasses(html)).toEqual([
    'ec-line',
    'ec-line scb-focus-out',
    'ec-line',
    'ec-line',
    'ec-line scb-focus-out',
  ]);
  expect(copyText).toBe('a()\nb()\nc()\nd()\ne()');
});

test('combines the attribute and directives', async () => {
  const { html } = await render(block('js focus={1}', 'a()', 'b() // [!code focus]', 'c()'));
  expect(lineClasses(html)).toEqual(['ec-line', 'ec-line', 'ec-line scb-focus-out']);
});

test('renders a block without focused lines as without the feature', async () => {
  const md = block('js title="app.js" {2}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { focus: false })).html);
});

test('warns about lines outside the block', async () => {
  const { html, warnings } = await render(block('js focus={1,5}', 'a()', 'b()'));
  expect(lineClasses(html)).toEqual(['ec-line', 'ec-line scb-focus-out']);
  expect(warnings).toEqual([
    'src/content/docs/example.md, js code block: `focus={1,5}` names line 5, but the block has 2 lines. The plugin ignores it.',
  ]);
});

test('fails the build for a bad range', async () => {
  await expect(render(block('js focus={a}', 'a()'))).rejects.toThrow('`focus={a}` is not a valid range');
});

test('leaves [!code focus] in the code when focus is off', async () => {
  const { copyText, warnings } = await render(block('js', 'a() // [!code focus]'), { focus: false });
  expect(copyText).toBe('a() // [!code focus]');
  expect(warnings).toHaveLength(1);
});

test('blurs by default and only fades with style: dim', async () => {
  const css = async (options = {}) => {
    const { ExpressiveCode } = await import('expressive-code');
    const { pluginCodeblocks } = await import('../src/expressive-code/index.ts');
    return new ExpressiveCode({ plugins: [pluginCodeblocks(options)] }).getBaseStyles();
  };
  const blur = await css();
  expect(blur).toMatch(/\.scb-focus-out\{[^}]*filter:blur\(var\(--ec-codeblocksFocus-blur\)\)/);
  expect(blur).toMatch(/\.frame:not\(\.scb-scrolly-frame\):hover \.scb-focus-out/);
  expect(blur).toMatch(/\.frame:focus-within \.scb-focus-out/);
  const dim = await css({ focus: { style: 'dim' } });
  expect(dim).toMatch(/\.scb-focus-out\{opacity:var\(--ec-codeblocksFocus-opa\);transition/);
});
