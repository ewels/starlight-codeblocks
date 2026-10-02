import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { encodeVariant } from '../src/expressive-code/code-tabs.ts';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { render } from './render.ts';

const variant = (index: number, labels: string[], control: 'tabs' | 'menu' = 'menu') =>
  `scbTabs="${encodeVariant({ index, labels, control })}"`;

test('renders an editor tab with the title, or with the label and only an icon that the block names, and no menu', async () => {
  const tabs = (fence: string, code = 'x') =>
    render([`\`\`\`${fence} ${variant(0, ['npm', 'Python'], 'tabs')}`, code, '```'].join('\n'));
  const label = await tabs('sh');
  expect(label.html).toContain('<span class="title">npm</span>');
  expect(label.html).not.toContain('is-terminal');
  expect(label.html).not.toContain('<select');
  expect((await tabs('sh icon="pnpm"')).html).toMatch(
    /<span class="title"><svg class="scb-file-icon"[\s\S]*?pnpm" [\s\S]*?npm<\/span>/,
  );
  const titled = await tabs('py title="a.py"');
  expect(titled.html).toMatch(/<span class="title"><svg class="scb-file-icon"[\s\S]*?a\.py<\/span>/);
  const comment = await tabs('py', '# src/b.py\nx = 1');
  expect(comment.html).toContain('src/b.py</span>');
  expect(comment.copyText).toBe('x = 1');
});

test('renders the menu in the title bar, with the variant selected, and hides every variant after the first', async () => {
  const { html, copyText } = await render([`\`\`\`sh ${variant(1, ['npm', 'pnpm'])}`, 'pnpm add x', '```'].join('\n'));
  expect(html).toContain('<span class="scb-tabs-field scb-no-print scb-needs-js">');
  expect(html).toContain('<select class="scb-btn scb-tabs-menu" aria-label="Variant">');
  expect(html).toContain('<option value="0">npm</option><option value="1" selected>pnpm</option>');
  expect(html).toContain('class="scb-tools"');
  expect(html).toMatch(/^<div class="expressive-code" hidden>/);
  expect(copyText).toBe('pnpm add x');
  expect((await render([`\`\`\`sh ${variant(0, ['a', 'b'])}`, 'x', '```'].join('\n'))).html).not.toContain(' hidden>');
});

test('shows a decorative icon for the language of the variant, and a code icon for other languages', async () => {
  const icon = async (lang: string) => {
    const { html } = await render([`\`\`\`${lang} ${variant(0, ['a', 'b'])}`, 'x', '```'].join('\n'));
    return html.match(/<svg class="scb-tabs-icon"[^>]*>(.*?)<\/svg>/)?.[0] ?? '';
  };
  const python = await icon('py');
  expect(python).toContain('aria-hidden="true"');
  expect(python).toContain('fill="currentColor"');
  expect(await icon('python')).toBe(python);
  expect(await icon('js')).not.toBe(python);
  expect(await icon('nextflow')).toContain('stroke="currentColor"');
});

test('renders the same with the feature off, for a block outside code tabs', async () => {
  const md = ['```js', 'a()', '```'].join('\n');
  expect((await render(md)).html).toBe((await render(md, { codeTabs: false })).html);
});

async function directive(markdown: string, options = {}) {
  const metas: (string | null | undefined)[] = [];
  const spy = { name: 'spy', code: (node: { meta?: string | null }) => void metas.push(node.meta) };
  const { html } = await markdownToHtml(markdown, {
    mdastPlugins: [...mdastPlugins(resolveOptions(options), { warn() {} }), spy],
    features: { directive: true },
    fileURL: new URL('file:///site/page.md'),
  });
  const decoded = metas.map((m) => {
    const raw = m?.match(/scbTabs="([^"]+)"/)?.[1];
    return raw ? JSON.parse(decodeURIComponent(raw)) : m;
  });
  return { html, metas, decoded };
}

const npm = [
  ':::code-tabs{sync="pm"}',
  '```sh label="npm"',
  'npm i x',
  '```',
  '```py title="a.py"',
  'x = 1',
  '```',
  ':::',
];

test('wraps the code blocks, and gives each its index and every label', async () => {
  const { html, metas, decoded } = await directive(npm.join('\n'));
  expect(html).toContain(
    '<div class="scb-tabs" data-scb-code-tabs="pm" data-scb-control="tabs" data-scb-labels="[&quot;npm&quot;,&quot;Python&quot;]">',
  );
  expect(decoded).toEqual([
    { index: 0, labels: ['npm', 'Python'], control: 'tabs' },
    { index: 1, labels: ['npm', 'Python'], control: 'tabs' },
  ]);
  expect(metas[1]).toMatch(/^title="a.py" scbTabs=/);
  const diff = await directive(
    [':::code-tabs', '```diff lang="py"', '+x = 1', '```', '```diff lang="js"', '+x = 1', '```', ':::'].join('\n'),
  );
  expect(diff.decoded[0]).toEqual({ index: 0, labels: ['Python', 'JavaScript'], control: 'tabs' });
  expect(diff.html).toContain('data-scb-code-tabs=""');
});

test('takes the control from the directive, then from the site option', async () => {
  const menu = [':::code-tabs{control="menu"}', ...npm.slice(1)].join('\n');
  expect((await directive(menu)).decoded[0].control).toBe('menu');
  expect((await directive(npm.join('\n'), { codeTabs: { control: 'menu' } })).decoded[0].control).toBe('menu');
  const tabs = [':::code-tabs{control="tabs"}', ...npm.slice(1)].join('\n');
  expect((await directive(tabs, { codeTabs: { control: 'menu' } })).decoded[0].control).toBe('tabs');
  await expect(directive([':::code-tabs{control="list"}', ...npm.slice(1)].join('\n'))).rejects.toThrow(
    'page.md: `:::code-tabs` has `control="list"`',
  );
});

test('fails the build for anything but code blocks inside the directive, or for two variants with one label', async () => {
  await expect(directive([':::code-tabs', 'Some text.', '', '```js', 'a()', '```', ':::'].join('\n'))).rejects.toThrow(
    'page.md: `:::code-tabs` can contain only fenced code blocks',
  );
  await expect(
    directive([':::code-tabs', '```sh', 'npm i x', '```', '```bash', 'pnpm add x', '```', ':::'].join('\n')),
  ).rejects.toThrow('page.md: two variants in a `:::code-tabs` have the label "Shell"');
});

test('leaves the directive alone with the feature off', async () => {
  const { html } = await directive(npm.join('\n'), { codeTabs: false });
  expect(html).not.toContain('scb-tabs');
});
