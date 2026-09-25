import { getColorContrast } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

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
});

test('warns about a tag without exactly one name', async () => {
  const { warnings } = await render(block('js', 'a() // [!mention]'));
  expect(warnings.join()).toContain('`[!mention]` needs one name');
});

test('renders the same with the feature off, for a block without tags', async () => {
  const md = block('js', 'a()');
  expect((await render(md)).html).toBe((await render(md, { mentions: false })).html);
  expect((await render(md)).html).not.toContain('data-scb-mention');
});

test('the bar meets 3:1 contrast', async () => {
  const ec = new ExpressiveCode({ plugins: pluginCodeblocks() });
  await ec.getBaseStyles();
  for (const v of ec.styleVariants) {
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

test('keeps a link with a tagged block after it in its section, or anywhere before it', async () => {
  const after = await page(['See [the value](#mention:x).', '', code('x')].join('\n'));
  expect(after.html).toContain('href="#mention:x"');
  expect(after.warnings).toEqual([]);
  const before = await page([code('x'), '', '## Later', '', 'See [the value](#mention:x).'].join('\n'));
  expect(before.html).toContain('href="#mention:x"');
  expect(before.warnings).toEqual([]);
});

test('turns a link with no block into plain text, with a warning', async () => {
  const other = await page(['See [the value](#mention:x).', '', '## Next', '', code('x')].join('\n'));
  expect(other.html).not.toContain('href="#mention:x"');
  expect(other.html).toContain('See the value.');
  expect(other.warnings).toHaveLength(1);
  expect(other.warnings[0]).toContain('page.md: the link to `#mention:x` has no code block');
  const escaped = await page(['See [it](#mention:y).', '', '```py', 'y = 1  # [\\!mention y]', '```'].join('\n'));
  expect(escaped.html).not.toContain('href="#mention:y"');
});

test('leaves mention links alone with the feature off', async () => {
  const { html, warnings } = await page('See [it](#mention:z).', { mentions: false });
  expect(html).toContain('href="#mention:z"');
  expect(warnings).toEqual([]);
});
