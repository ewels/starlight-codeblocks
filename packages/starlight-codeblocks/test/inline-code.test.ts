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
    const { html, warnings } = await md('Call `await fetch(url)`{:js} now.', {}, directive);
    expect(html).toMatch(
      /^<p>Call <code class="scb-inline" data-lang="js"><span style="--0:#[0-9A-F]+;--1:#[0-9A-F]+">await<\/span>/,
    );
    expect(html).toContain('fetch</span>');
    expect(html).toMatch(/<\/code> now\.<\/p>$/);
    expect(html).not.toContain('{');
    expect(warnings).toEqual([]);
  },
);

test('escapes the code', async () => {
  const { html } = await md('`a < b && c`{:js}');
  expect(html).toContain('&#x3C;');
  expect(html).not.toContain('< b');
});

test('keeps text right after the suffix, and handles a suffix that ends the paragraph', async () => {
  expect((await md('`x`{:js}, then `y`{:py}')).html).toMatch(
    /<\/code>, then <code class="scb-inline" data-lang="py">.*<\/code><\/p>$/,
  );
});

test('leaves code without a suffix, or with a space before it, unchanged', async () => {
  const plain = 'Use `fetch(url)` and `x` {:js} here.';
  expect((await md(plain)).html).toBe((await md(plain, { inlineHighlighting: false })).html);
  expect((await md(plain)).html).toContain('<code>fetch(url)</code>');
});

test('renders an unknown language as plain inline code, with a warning', async () => {
  const { html, warnings } = await md('Run `x`{:nope}.');
  expect(html).toBe('<p>Run <code>x</code>.</p>');
  expect(warnings).toEqual([
    expect.stringMatching(
      /site\/page\.md: inline code `x` has the unknown language `nope`. It shows as plain inline code\.$/,
    ),
  ]);
});

test('with the feature off, the suffix stays as written', async () => {
  const { html } = await md('Call `f()`{:js}.', { inlineHighlighting: false }, false);
  expect(html).toBe('<p>Call <code>f()</code>{:js}.</p>');
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
  setRegistry({ options: resolveOptions(), plugins: [], clientAssets: true, styleVariants: custom });
  try {
    expect(inlineStyles()).toContain('code.scb-inline { background: #123456;');
  } finally {
    setRegistry(undefined);
  }
});

test('also takes the suffix inside the backticks, as rehype-pretty-code does', async () => {
  const { html, warnings } = await md('Call `await fetch(url){:js}` now.', {}, false);
  expect(html).toMatch(
    /^<p>Call <code class="scb-inline" data-lang="js"><span style="--0:#[0-9A-F]+;--1:#[0-9A-F]+">await<\/span>/,
  );
  expect(html).not.toContain('{');
  expect(warnings).toEqual([]);
});

test('leaves an inner suffix alone in code that is only a suffix, has a backtick, or uses the token form', async () => {
  for (const source of ['`{:js}`', '`` `x`{:js} ``', '`` `x{:js}` ``', '`name{:.entity.name}`']) {
    expect((await md(source)).html).toBe((await md(source, { inlineHighlighting: false })).html);
  }
});

test('removes an inner suffix with an unknown language, with a warning', async () => {
  const { html, warnings } = await md('Run `x{:nope}`.');
  expect(html).toBe('<p>Run <code>x</code>.</p>');
  expect(warnings).toHaveLength(1);
});
