import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import codeblocks from '../src/index.ts';
import { getRegistry, setRegistry } from '../src/registry.ts';

afterEach(() => setRegistry(undefined));

async function setup(ecConfig?: string, expressiveCode: unknown = {}, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'scb-'));
  if (ecConfig) writeFileSync(join(root, 'ec.config.mjs'), ecConfig);
  const updates: Record<string, unknown>[] = [];
  const integrations: { name: string }[] = [];
  const hook = codeblocks(options).hooks['config:setup'];
  await hook?.({
    config: { expressiveCode },
    updateConfig: (update: Record<string, unknown>) => updates.push(update),
    addIntegration: (integration: { name: string }) => integrations.push(integration),
    astroConfig: { root: pathToFileURL(`${root}/`), cacheDir: pathToFileURL(`${root}/node_modules/.astro/`) },
  } as never);
  return { updates, integrations };
}

test('adds its plugins with only the name visible, and fills the registry', async () => {
  const { updates, integrations } = await setup(undefined, { plugins: [{ name: 'other' }] });
  const plugins = (updates[0] as { expressiveCode: { plugins: object[] } }).expressiveCode.plugins;
  expect(plugins[0]).toEqual({ name: 'other' });
  expect(JSON.parse(JSON.stringify(plugins[1]))).toEqual({ name: 'starlight-codeblocks:core' });
  expect(getRegistry()?.plugins[0]?.name).toBe('starlight-codeblocks:core');
  expect(getRegistry()?.clientAssets).toBe(true);
  expect(getRegistry()?.cacheDir).toMatch(/node_modules\/\.astro\/?$/);
  expect(integrations.map((i) => i.name)).toEqual(['starlight-codeblocks']);
});

test('adds its plugins when ec.config.mjs has no plugins list', async () => {
  const { updates } = await setup('export default { styleOverrides: {} };');
  expect(updates).toHaveLength(1);
});

test('fails when ec.config.mjs has a plugins list without the preset', async () => {
  await expect(setup("export default { plugins: [{ name: 'other' }] };")).rejects.toThrow(
    '`ec.config.mjs` has its own `plugins` list',
  );
});

test('defaults tabWidth to 0, so a real tab is not expanded to spaces', async () => {
  const { updates } = await setup();
  expect((updates[0] as { expressiveCode: { tabWidth: number } }).expressiveCode.tabWidth).toBe(0);
});

test('keeps a tabWidth the site already chose', async () => {
  const { updates } = await setup(undefined, { tabWidth: 4 });
  expect((updates[0] as { expressiveCode: { tabWidth: number } }).expressiveCode.tabWidth).toBe(4);
});

test('adds only the inline code stylesheet when ec.config.mjs has the preset', async () => {
  const { updates, integrations } = await setup(
    "export default { plugins: [[{ name: 'starlight-codeblocks:core' }]] };",
  );
  expect(updates).toEqual([{ customCss: ['virtual:starlight-codeblocks/inline-code.css'] }]);
  expect(integrations).toHaveLength(1);
});

test('adds no stylesheet with inline highlighting off', async () => {
  const { updates } = await setup(undefined, {}, { inlineHighlighting: false });
  expect(updates[0]).not.toHaveProperty('customCss');
});

test('keeps the site Expressive Code options for inline highlighting', async () => {
  await setup('export default { themeCssRoot: "html" };', { useStarlightDarkModeSwitch: false });
  expect(getRegistry()?.expressiveCode).toEqual({ themeCssRoot: 'html', useStarlightDarkModeSwitch: false });
});

test('fails when Expressive Code is off', async () => {
  await expect(setup(undefined, false)).rejects.toThrow('needs Expressive Code');
});

test('validates options when the plugin is created', () => {
  expect(() => codeblocks({ fokus: {} } as never)).toThrow('unknown option `fokus`');
});
