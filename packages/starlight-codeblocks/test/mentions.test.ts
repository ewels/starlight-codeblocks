import { getColorContrast } from '@expressive-code/core';
import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { block, render, styleVariants } from './render.ts';

test('tags lines with [!mention <name>] and removes the tags from the code and the copied text', async () => {
  const { html, copyText, warnings } = await render(
    block('py', 'def f(n):', '    return 1  # [!mention base]', '    return n  # [!mention step] [!mention base]'),
  );
  expect(html).toContain('data-scb-mentions');
  expect(html).toContain('<div class="ec-line" data-scb-mention="base">');
  expect(html).toContain('data-scb-mention="step base"');
  expect(html).not.toContain('[!mention');
  expect(copyText).toBe('def f(n):\n    return 1\n    return n');
  expect(warnings).toEqual([]);
  expect((await render(block('js', 'a() // [!mention]'))).warnings.join()).toContain('`[!mention]` needs one name');
});

test('renders the same with the feature off, for a block without tags', async () => {
  const md = block('js', 'a()');
  expect((await render(md)).html).toBe((await render(md, { mentions: false })).html);
  expect((await render(md)).html).not.toContain('data-scb-mention');
});

test('the bar meets 3:1 contrast', async () => {
  for (const v of await styleVariants()) {
    const get = (key: string) => v.resolvedStyleSettings.get(key as never) as string;
    expect(getColorContrast(get('codeblocksMentions.bar'), get('codeBackground'))).toBeGreaterThanOrEqual(3);
  }
});

async function page(markdown: string, options = {}) {
  const warnings: string[] = [];
  const plugins = mdastPlugins(resolveOptions(options), { warn: (m) => warnings.push(m) });
  const { html } = await markdownToHtml(markdown, { mdastPlugins: plugins, fileURL: new URL('file:///site/page.md') });
  return { html, warnings };
}

const code = (name: string) => ['```py', `x = 1  # [!mention ${name}]`, '```'].join('\n');

test('keeps a link with a tagged block after it in its section, anywhere before it, or in a diff of that lang', async () => {
  for (const markdown of [
    ['See [the value](#mention:x).', '', code('x')],
    [code('x'), '', '## Later', '', 'See [the value](#mention:x).'],
    ['See [x](#mention:x).', '', '```diff lang="py"', '+x = 1  # [!mention x]', '```'],
  ]) {
    const { html, warnings } = await page(markdown.join('\n'));
    expect(html).toContain('href="#mention:x"');
    expect(warnings).toEqual([]);
  }
});

test('turns a link with no block, or with a malformed escape, into plain text, with a warning', async () => {
  const other = await page(['See [the value](#mention:x).', '', '## Next', '', code('x')].join('\n'));
  expect(other.html).not.toContain('href="#mention:x"');
  expect(other.html).toContain('See the value.');
  expect(other.warnings).toEqual([expect.stringContaining('page.md: the link to `#mention:x` has no code block')]);
  const escaped = await page(['See [it](#mention:y).', '', '```py', 'y = 1  # [\\!mention y]', '```'].join('\n'));
  expect(escaped.html).not.toContain('href="#mention:y"');
  const bad = await page(`${code('a')}\n\nSee [bad](#mention:a%E0%A4%A).`);
  expect(bad.warnings).toEqual([expect.stringMatching(/page\.md: .*#mention:a%E0%A4%A.*malformed/)]);
  expect(bad.html).not.toContain('href="#mention:');
});

test('keeps a link with no block in a render with no file, which is one fragment of a page', async () => {
  const warnings: string[] = [];
  const plugins = mdastPlugins(resolveOptions(), { warn: (m) => warnings.push(m) });
  const { html } = await markdownToHtml('See [the value](#mention:x).', { mdastPlugins: plugins });
  expect(html).toContain('href="#mention:x"');
  expect(warnings).toEqual([]);
});

test('leaves mention links alone with the feature off', async () => {
  const { html, warnings } = await page('See [it](#mention:z).', { mentions: false });
  expect(html).toContain('href="#mention:z"');
  expect(warnings).toEqual([]);
});

test('pairs links only with tags that the notation parser reads', async () => {
  const link = 'See [it](#mention:x).';
  const extra = await page([link, '', '```py', 'x = 1  # [!mention x extra]', '```'].join('\n'));
  expect(extra.html).toContain('href="#mention:x"');
  const txt = await page([link, '', '```txt', 'x = 1  # [!mention x]', '```'].join('\n'));
  expect(txt.html).not.toContain('href="#mention:x"');
  const off = await page([link, '', code('x')].join('\n'), { notation: false });
  expect(off.html).not.toContain('href="#mention:x"');
});
