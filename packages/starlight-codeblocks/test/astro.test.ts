import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { markdownToHtml } from 'satteri';
import { afterEach, expect, test } from 'vitest';
import codeblocks, { type AstroCodeblocksOptions } from '../src/astro.ts';
import { resolveOptions } from '../src/options.ts';
import { getRegistry, setRegistry } from '../src/registry.ts';
import { mdastPlugins, restoreDirectives } from '../src/satteri/index.ts';

afterEach(() => setRegistry(undefined));

type Processor = { name: string; options: { features?: { directive?: boolean }; mdastPlugins: unknown[] } };

async function setup(options: AstroCodeblocksOptions = {}, ecConfig?: string, others: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'scb-'));
  if (ecConfig) writeFileSync(join(root, 'ec.config.mjs'), ecConfig);
  const [ours, ec] = codeblocks(options);
  const processor: Processor = { name: 'satteri', options: { mdastPlugins: [] } };
  const config = {
    root: pathToFileURL(`${root}/`),
    cacheDir: pathToFileURL(`${root}/node_modules/.astro/`),
    base: '/',
    build: { assets: '_astro' },
    markdown: { processor },
    integrations: [ours, ec, ...others.map((name) => ({ name }))],
  };
  const scripts: string[] = [];
  const updates: unknown[] = [];
  await ours?.hooks['astro:config:setup']?.({
    config,
    command: 'build',
    injectScript: (_: string, script: string) => scripts.push(script),
    updateConfig: (update: unknown) => updates.push(update),
    logger: { warn() {} },
  } as never);
  await ours?.hooks['astro:config:done']?.({ config } as never);
  return { ec, processor, scripts, updates };
}

test('returns its setup and Expressive Code, in that order, so that both sit where the site lists codeblocks()', () => {
  expect(codeblocks().map((i) => i.name)).toEqual(['starlight-codeblocks', 'astro-expressive-code']);
});

test('fills the registry with the theme selectors of Expressive Code, not of Starlight', async () => {
  await setup({ expressiveCode: { themes: ['github-dark'] } });
  expect(getRegistry()?.plugins[0]?.name).toBe('starlight-codeblocks:core');
  expect(getRegistry()?.expressiveCode).toMatchObject({ useStarlightDarkModeSwitch: false, themes: ['github-dark'] });
});

test('changes nothing outside code blocks unless the site turns on code tabs or inline code highlighting', async () => {
  const { processor, scripts } = await setup();
  expect(scripts).toEqual([]);
  expect(processor.options.features?.directive).toBeUndefined();
  expect(processor.options.mdastPlugins).toHaveLength(1);
  expect(getRegistry()?.options).toMatchObject({ codeTabs: false, inlineHighlighting: false });
});

test('adds the inline code stylesheet on every page, and never the API card page styles', async () => {
  const { scripts } = await setup({ inlineHighlighting: {} });
  expect(scripts).toEqual(['import "virtual:starlight-codeblocks/inline-code.css";']);
});

test('turns on directives for code tabs, with a plugin that gives back the ones nobody claims', async () => {
  const { processor } = await setup({ codeTabs: {} });
  expect(processor.options.features?.directive).toBe(true);
  expect(processor.options.mdastPlugins.at(-1)).toMatchObject({ name: 'starlight-codeblocks:directives' });
});

test('fails with a fix when the site also lists expressiveCode(), lists mdx() first, or has its own plugins list', async () => {
  await expect(setup({}, undefined, ['astro-expressive-code'])).rejects.toThrow('has `expressiveCode()` as well');
  const [ours, ec] = codeblocks();
  const mdxFirst = { integrations: [{ name: '@astrojs/mdx' }, ours, ec] };
  await expect(ours?.hooks['astro:config:setup']?.({ config: mdxFirst } as never)).rejects.toThrow(
    'must come before `mdx()`',
  );
  await expect(setup({}, "export default { plugins: [{ name: 'other' }] };")).rejects.toThrow(
    '`ec.config.mjs` has its own `plugins` list',
  );
  await expect(setup({}, "export default { plugins: [{ name: 'starlight-codeblocks:core' }] };")).resolves.toBeTruthy();
});

test('validates options when the integration is created', () => {
  expect(() => codeblocks({ fokus: {} } as never)).toThrow('unknown option `fokus`');
});

test('gives back the source of unclaimed directives, and keeps code tabs', async () => {
  const markdown = [
    'Ünïcödé 16:9, note:this and :abbr[HTML]{title="x"}.',
    '',
    '::leaf[text]',
    '',
    ':::other',
    'Inside',
    ':::',
    '',
    ':::code-tabs',
    '```sh label="npm"',
    'npm i x',
    '```',
    ':::',
  ].join('\n');
  const { html } = await markdownToHtml(markdown, {
    mdastPlugins: [...mdastPlugins(resolveOptions(), { warn() {} }), restoreDirectives()],
    features: { directive: true },
    fileURL: new URL('file:///site/page.md'),
  });
  expect(html).toContain('<p>Ünïcödé 16:9, note:this and :abbr[HTML]{title="x"}.</p>');
  expect(html).toContain('<p>::leaf[text]</p>');
  expect(html).toContain('<div><p>Inside</p></div>');
  expect(html).toContain('npm i x');
});
