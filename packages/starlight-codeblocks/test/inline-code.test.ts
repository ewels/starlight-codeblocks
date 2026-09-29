import { ExpressiveCode } from 'expressive-code';
import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { resolveOptions } from '../src/options.ts';
import { setRegistry } from '../src/registry.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { inlineStyles } from '../src/satteri/inline-code.ts';

async function md(markdown: string, options = {}, directive = true) {
  const warnings: string[] = [];
  const { html } = await markdownToHtml(markdown, {
    mdastPlugins: mdastPlugins(resolveOptions(options), { warn: (m) => warnings.push(m) }),
    features: { directive },
    fileURL: new URL('file:///site/page.md'),
  });
  return { html: html.trim(), warnings };
}

test.each([true, false])(
  'highlights inline code with a {:lang} suffix and removes it (directives %s)',
  async (directive) => {
    const { html, warnings } = await md(
      'Call `await fetch(url)`{:js}, `int x`{:c++}, `var x{:c#}` and `a < b`{:py}',
      {},
      directive,
    );
    expect(html).toMatch(
      /^<p>Call <code class="scb-inline" data-lang="js"><span style="--0:#[0-9A-F]+;--1:#[0-9A-F]+">await<\/span>/,
    );
    expect(html).toContain('data-lang="c++"');
    expect(html).toContain('data-lang="c#"');
    expect(html).toMatch(/<\/code>, <code/);
    expect(html).toMatch(/<\/code><\/p>$/);
    expect(html).toContain('&lt;');
    expect(html).not.toContain('{');
    expect(warnings).toEqual([]);
  },
);

test.each([
  'Use `fetch(url)` and `x` {:js} here.',
  '`{:js}`',
  '`` `x`{:js} ``',
  '`` `x{:js}` ``',
  '`name{:.entity.name}`',
])('leaves %s unchanged', async (source) => {
  expect((await md(source)).html).toBe((await md(source, { inlineHighlighting: false })).html);
});

test('with the feature off, the suffix stays as written', async () => {
  const { html } = await md('Call `f()`{:js}.', { inlineHighlighting: false }, false);
  expect(html).toBe('<p>Call <code>f()</code>{:js}.</p>');
});

test('renders an unknown language as plain inline code, with a warning', async () => {
  const { html, warnings } = await md('Run `x`{:nope} and `y{:nope}`.');
  expect(html).toBe('<p>Run <code>x</code> and <code>y</code>.</p>');
  expect(warnings).toEqual([
    expect.stringMatching(
      /site\/page\.md: inline code `x` has the unknown language `nope`. It shows as plain inline code\.$/,
    ),
    expect.stringContaining('`y`'),
  ]);
});

test('highlights inline code with no suffix in the default language, and a suffix wins over it', async () => {
  const options = { inlineHighlighting: { defaultLanguage: 'py' } };
  const { html, warnings } = await md('Call `len(items)` or `fetch(url){:js}`.', options);
  expect(html).toMatch(/^<p>Call <code class="scb-inline" data-lang="py"><span style="--0:/);
  expect(html).toContain('<code class="scb-inline" data-lang="js">');
  expect(warnings).toEqual([]);
});

test.each(['`config.toml{:txt}`', '`config.toml`{:txt}', '`config.toml{:text}`'])(
  'keeps %s as plain inline code, with the default language on or off',
  async (source) => {
    for (const options of [{}, { inlineHighlighting: { defaultLanguage: 'py' } }]) {
      const { html, warnings } = await md(`Edit ${source} now.`, options);
      expect(html).toBe('<p>Edit <code>config.toml</code> now.</p>');
      expect(warnings).toEqual([]);
    }
  },
);

test('warns once about an unknown default language, and keeps the inline code plain', async () => {
  const options = { inlineHighlighting: { defaultLanguage: 'nope-lang' } };
  const { html, warnings } = await md('Use `a` and `b`.\n\nThen `c`.', options);
  expect(html).toBe('<p>Use <code>a</code> and <code>b</code>.</p>\n<p>Then <code>c</code>.</p>');
  expect(warnings).toEqual([
    expect.stringMatching(/page\.md: `inlineHighlighting\.defaultLanguage` is the unknown language `nope-lang`\./),
  ]);
});

const variants = new ExpressiveCode().styleVariants;

test('styles switch themes the way Starlight switches Expressive Code themes', () => {
  const css = inlineStyles(variants, {});
  expect(css).toContain('code.scb-inline { background: #24292e; color: #e1e4e8; }');
  expect(css).toContain('color: var(--0, inherit)');
  expect(css).toContain(":root:not([data-theme='dark']) code.scb-inline { background: #fff;");
  expect(css).toContain(":root[data-theme='light'] code.scb-inline span[style^='--'] {\n  color: var(--1, inherit)");
});

test('styles follow the site themeCssSelector, themeCssRoot and useDarkModeMediaQuery', () => {
  const css = inlineStyles(variants, {
    themeCssRoot: 'html',
    themeCssSelector: (theme) => `.theme-${theme.name}`,
    useDarkModeMediaQuery: false,
  });
  expect(css).not.toContain('@media');
  expect(css).toContain('html.theme-github-light code.scb-inline {');
  expect(inlineStyles(variants, { themeCssSelector: false })).not.toContain("[data-theme='light'] code");
});

test('styles use the site engine style variants from the registry', () => {
  const custom = new ExpressiveCode({ styleOverrides: { codeBackground: '#123456' } }).styleVariants;
  setRegistry({ options: resolveOptions(), plugins: [], styleVariants: custom });
  try {
    expect(inlineStyles()).toContain('code.scb-inline { background: #123456;');
  } finally {
    setRegistry(undefined);
  }
});

test('keeps highlighted inline code in the text of a heading, for its id and the table of contents', async () => {
  let text = '';
  await markdownToHtml('## Call `fetch(url)`{:js} first', {
    mdastPlugins: mdastPlugins(resolveOptions(), { warn: () => {} }),
    hastPlugins: [
      {
        name: 'text',
        element: {
          filter: ['h2'],
          visit(node, ctx) {
            text = ctx.textContent(node);
          },
        },
      },
    ],
  });
  expect(text).toBe('Call fetch(url) first');
});
