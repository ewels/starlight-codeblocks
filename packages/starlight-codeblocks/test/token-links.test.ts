import { getColorContrast } from '@expressive-code/core';
import { afterEach, expect, test } from 'vitest';
import { isSafeUrl } from '../src/expressive-code/core.ts';
import { withBase } from '../src/expressive-code/token-links.ts';
import { resolveOptions } from '../src/options.ts';
import { setRegistry } from '../src/registry.ts';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

const url = 'https://numpy.org/doc/stable/reference/generated/numpy.linspace.html';

afterEach(() => setRegistry(undefined));

test('links the first match of the text on the next line, keeps its colours, and removes the directive', async () => {
  const { html, copyText, warnings } = await render(
    block('py', 'import numpy as np', `# [!link /linspace/ ${url}]`, 'x = np.linspace(0, 1, 50)'),
  );
  expect(html).toMatch(new RegExp(`<a class="scb-link" href="${url}"><span style="--0:[^>]*>linspace</span></a>`));
  expect(html).not.toContain('[!link');
  expect(copyText).toBe('import numpy as np\nx = np.linspace(0, 1, 50)');
  expect(warnings).toEqual([]);
  const twice = await render(block('js', '// [!link /a/ https://example.com/]', 'a + a'));
  expect(twice.html.match(/class="scb-link"/g)).toHaveLength(1);
  expect(twice.html).toMatch(/<\/a><span[^>]*> <\/span><span[^>]*>\+<\/span><span[^>]*> a</);
});

test('stacks several link lines above one line', async () => {
  const { html } = await render(
    block(
      'py',
      '# [!link /Path/ https://docs.python.org/3/library/pathlib.html]',
      '# [!link /read_text/ https://docs.python.org/3/library/pathlib.html#pathlib.Path.read_text]',
      'text = Path("a.txt").read_text()',
    ),
  );
  expect(html.match(/class="scb-link"/g)).toHaveLength(2);
  expect(html).toContain('href="https://docs.python.org/3/library/pathlib.html#pathlib.Path.read_text"');
});

test('reads a site-relative URL as one word, and adds Astro base to it', async () => {
  const md = block('js', '// [!link /createClient/ /reference/client/]', 'createClient()');
  expect((await render(md)).html).toContain('href="/reference/client/"');
  setRegistry({ options: resolveOptions(), plugins: [], base: '/docs' });
  expect((await render(md)).html).toContain('href="/docs/reference/client/"');
});

test('withBase leaves other URLs alone, and does not add the base twice', () => {
  expect(withBase('/reference/', '/docs/')).toBe('/docs/reference/');
  expect(withBase('/docs/reference/', '/docs')).toBe('/docs/reference/');
  expect(withBase('/reference/', '/')).toBe('/reference/');
  expect(withBase('https://example.com/', '/docs')).toBe('https://example.com/');
  expect(withBase('//example.com/', '/docs')).toBe('//example.com/');
  expect(withBase('#section', '/docs')).toBe('#section');
});

test('warns about a link without a URL, and about text with no match', async () => {
  const { html, warnings } = await render(
    block('js', '// [!link /a/]', 'a()', '// [!link /zzz/ https://example.com/]', 'b()'),
  );
  expect(html).not.toContain('scb-link');
  expect(warnings).toEqual([
    'src/content/docs/example.md, js code block, line 3: `/zzz/` in `[!link]` does not match the line it applies to. The line renders without it.',
    'src/content/docs/example.md, js code block, line 1: `[!link]` needs the text to link and one URL, such as `[!link /Path/ https://example.com/]`.',
  ]);
});

test('renders a block without links the same as without the feature', async () => {
  const md = block('js title="a.js"', 'const a = 1;');
  expect((await render(md)).html).toBe((await render(md, { tokenLinks: false })).html);
});

test('the underline meets 3:1 contrast in both themes', async () => {
  for (const { get, name } of await variants()) {
    const colour = get('codeblocksTokenLinks.underline');
    expect(getColorContrast(colour, get('codeBackground')), name).toBeGreaterThanOrEqual(3);
  }
});

test('does not link a javascript: URL, however it is hidden', async () => {
  const { html, warnings } = await render(block('js', '// [!link /alert/ javascript:alert(1)]', 'alert(1)'));
  expect(html).not.toContain('javascript:');
  expect(warnings.join('\n')).toContain('http');
  for (const url of [
    ' javascript:alert(1)',
    '\x01javascript:alert(1)',
    'java\tscript:alert(1)',
    'JaVaScRiPt:alert(1)',
  ]) {
    expect(isSafeUrl(url), JSON.stringify(url)).toBe(false);
  }
  for (const url of ['https://example.com/', 'http://example.com/', '/docs/', '../x', '#y', 'page?q=a:b']) {
    expect(isSafeUrl(url), url).toBe(true);
  }
});
