import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { encodeVariant } from '../src/expressive-code/code-switcher.ts';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { render } from './render.ts';

const variant = (index: number, labels: string[]) => `scbSwitcher="${encodeVariant({ index, labels })}"`;

test('renders the menu in the title bar, with the variant selected, and hides every variant after the first', async () => {
  const { html, copyText } = await render([`\`\`\`sh ${variant(1, ['npm', 'pnpm'])}`, 'pnpm add x', '```'].join('\n'));
  expect(html).toContain('<span class="scb-switcher-field scb-no-print scb-needs-js">');
  expect(html).toContain('<select class="scb-btn scb-switcher-menu" aria-label="Variant">');
  expect(html).toContain('<option value="0">npm</option><option value="1" selected>pnpm</option>');
  expect(html).toContain('class="scb-tools"');
  expect(html).toMatch(/^<div class="expressive-code" hidden>/);
  expect(copyText).toBe('pnpm add x');
  expect((await render([`\`\`\`sh ${variant(0, ['a', 'b'])}`, 'x', '```'].join('\n'))).html).not.toContain(' hidden>');
});

test('shows a decorative icon for the language of the variant, and a code icon for other languages', async () => {
  const icon = async (lang: string) => {
    const { html } = await render([`\`\`\`${lang} ${variant(0, ['a', 'b'])}`, 'x', '```'].join('\n'));
    return html.match(/<svg class="scb-switcher-icon"[^>]*>(.*?)<\/svg>/)?.[0] ?? '';
  };
  const python = await icon('py');
  expect(python).toContain('aria-hidden="true"');
  expect(python).toContain('fill="currentColor"');
  expect(await icon('python')).toBe(python);
  expect(await icon('js')).not.toBe(python);
  expect(await icon('nextflow')).toContain('stroke="currentColor"');
});

test('renders the same with the feature off, for a block outside a switcher', async () => {
  const md = ['```js', 'a()', '```'].join('\n');
  expect((await render(md)).html).toBe((await render(md, { codeSwitcher: false })).html);
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
    const raw = m?.match(/scbSwitcher="([^"]+)"/)?.[1];
    return raw ? JSON.parse(decodeURIComponent(raw)) : m;
  });
  return { html, metas, decoded };
}

const npm = [
  ':::code-switcher{sync="pm"}',
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
  expect(html).toContain('<div class="scb-switcher" data-scb-code-switcher="pm">');
  expect(decoded).toEqual([
    { index: 0, labels: ['npm', 'Python'] },
    { index: 1, labels: ['npm', 'Python'] },
  ]);
  expect(metas[1]).toMatch(/^title="a.py" scbSwitcher=/);
  const diff = await directive(
    [':::code-switcher', '```diff lang="py"', '+x = 1', '```', '```diff lang="js"', '+x = 1', '```', ':::'].join('\n'),
  );
  expect(diff.decoded[0]).toEqual({ index: 0, labels: ['Python', 'JavaScript'] });
  expect(diff.html).toContain('data-scb-code-switcher=""');
});

test('fails the build for anything but code blocks inside the directive, or for two variants with one label', async () => {
  await expect(
    directive([':::code-switcher', 'Some text.', '', '```js', 'a()', '```', ':::'].join('\n')),
  ).rejects.toThrow('page.md: `:::code-switcher` can contain only fenced code blocks');
  await expect(
    directive([':::code-switcher', '```sh', 'npm i x', '```', '```bash', 'pnpm add x', '```', ':::'].join('\n')),
  ).rejects.toThrow('page.md: two variants in a `:::code-switcher` have the label "Shell"');
});

test('leaves the directive alone with the feature off', async () => {
  const { html } = await directive(npm.join('\n'), { codeSwitcher: false });
  expect(html).not.toContain('scb-switcher');
});
