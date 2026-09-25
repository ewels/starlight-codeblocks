import { markdownToHtml } from 'satteri';
import { expect, test } from 'vitest';
import { encodeVariant } from '../src/expressive-code/code-switcher.ts';
import { resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { render } from './render.ts';

const variant = (index: number, labels: string[]) => `scbSwitcher="${encodeVariant({ index, labels })}"`;

test('renders the menu in the title bar, with the variant selected', async () => {
  const { html, copyText } = await render([`\`\`\`sh ${variant(1, ['npm', 'pnpm'])}`, 'pnpm add x', '```'].join('\n'));
  expect(html).toContain('<select class="scb-btn scb-switcher-menu" aria-label="Variant">');
  expect(html).toContain('<option value="0">npm</option><option value="1" selected>pnpm</option>');
  expect(html).toContain('class="scb-tools"');
  expect(copyText).toBe('pnpm add x');
});

test('hides every variant after the first, for readers without JavaScript', async () => {
  expect((await render([`\`\`\`sh ${variant(1, ['a', 'b'])}`, 'x', '```'].join('\n'))).html).toMatch(
    /^<div class="expressive-code" hidden>/,
  );
  expect((await render([`\`\`\`sh ${variant(0, ['a', 'b'])}`, 'x', '```'].join('\n'))).html).not.toContain(' hidden>');
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
});

test('a switcher without sync gets an empty key', async () => {
  const { html } = await directive([':::code-switcher', '```js', 'a()', '```', ':::'].join('\n'));
  expect(html).toContain('data-scb-code-switcher=""');
});

test('fails the build for anything but code blocks inside the directive', async () => {
  await expect(
    directive([':::code-switcher', 'Some text.', '', '```js', 'a()', '```', ':::'].join('\n')),
  ).rejects.toThrow('page.md: `:::code-switcher` can contain only fenced code blocks');
});

test('leaves the directive alone with the feature off', async () => {
  const { html } = await directive(npm.join('\n'), { codeSwitcher: false });
  expect(html).not.toContain('scb-switcher');
});
