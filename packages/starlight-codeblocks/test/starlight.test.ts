import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import codeblocks from '../src/index.ts';
import { getRegistry, setRegistry } from '../src/registry.ts';

afterEach(() => setRegistry(undefined));

async function setup(ecConfig?: string, expressiveCode: unknown = {}, options = {}, markdown?: object) {
  const root = mkdtempSync(join(tmpdir(), 'scb-'));
  if (ecConfig) writeFileSync(join(root, 'ec.config.mjs'), ecConfig);
  const updates: Record<string, unknown>[] = [];
  const integrations: { name: string }[] = [];
  const hook = codeblocks(options).hooks['config:setup'];
  await hook?.({
    config: { expressiveCode },
    updateConfig: (update: Record<string, unknown>) => updates.push(update),
    addIntegration: (integration: { name: string }) => integrations.push(integration),
    astroConfig: {
      root: pathToFileURL(`${root}/`),
      cacheDir: pathToFileURL(`${root}/node_modules/.astro/`),
      markdown,
    },
  } as never);
  return { updates, integrations };
}

test('adds its plugins with only the name visible, and fills the registry', async () => {
  const { updates, integrations } = await setup(undefined, { plugins: [{ name: 'other' }] });
  const plugins = (updates[0] as { expressiveCode: { plugins: object[] } }).expressiveCode.plugins;
  expect(plugins[0]).toEqual({ name: 'other' });
  expect(JSON.parse(JSON.stringify(plugins[1]))).toEqual({ name: 'starlight-codeblocks:core' });
  expect(getRegistry()?.plugins[0]?.name).toBe('starlight-codeblocks:core');
  expect(getRegistry()?.cacheDir).toMatch(/node_modules\/\.astro\/?$/);
  expect(integrations.map((i) => i.name)).toEqual(['starlight-codeblocks']);
});

test('adds its plugins when ec.config.mjs has no plugins list, and fails when it has one without the preset', async () => {
  expect((await setup('export default { styleOverrides: {} };')).updates).toHaveLength(1);
  await expect(setup("export default { plugins: [{ name: 'other' }] };")).rejects.toThrow(
    '`ec.config.mjs` has its own `plugins` list',
  );
});

test('defaults tabWidth to 0, so a real tab is not expanded to spaces, and keeps one the site chose', async () => {
  const tabWidth = async (expressiveCode = {}) =>
    ((await setup(undefined, expressiveCode)).updates[0] as { expressiveCode: { tabWidth: number } }).expressiveCode
      .tabWidth;
  expect(await tabWidth()).toBe(0);
  expect(await tabWidth({ tabWidth: 4 })).toBe(4);
});

test('adds only the page stylesheets when ec.config.mjs has the preset, and keeps its tabWidth', async () => {
  const { updates, integrations } = await setup(
    "export default { plugins: [[{ name: 'starlight-codeblocks:core' }]] };",
  );
  expect(updates).toEqual([
    {
      customCss: ['virtual:starlight-codeblocks/inline-code.css', 'virtual:starlight-codeblocks/api-card.css'],
      expressiveCode: { tabWidth: 0 },
    },
  ]);
  expect(integrations).toHaveLength(1);
  const withTabWidth = await setup(
    "export default { tabWidth: 4, plugins: [[{ name: 'starlight-codeblocks:core' }]] };",
  );
  expect(withTabWidth.updates[0]).not.toHaveProperty('expressiveCode');
});

test('adds no stylesheet with inline highlighting and API links off', async () => {
  const { updates } = await setup(undefined, {}, { inlineHighlighting: false, apiLinks: false });
  expect(updates[0]).not.toHaveProperty('customCss');
});

test('keeps the site Expressive Code options for inline highlighting, merging shiki as astro-expressive-code does', async () => {
  await setup('export default { themeCssRoot: "html" };', { useStarlightDarkModeSwitch: false });
  expect(getRegistry()?.expressiveCode).toEqual({
    themeCssRoot: 'html',
    useStarlightDarkModeSwitch: false,
    shiki: {},
  });
  await setup('export default { shiki: { engine: "javascript", langs: ["b"], langAlias: { b: "c" } } };', {
    shiki: { langs: ['a'], langAlias: { a: 'c' } },
  });
  expect(getRegistry()?.expressiveCode?.shiki).toEqual({
    engine: 'javascript',
    langs: ['a', 'b'],
    langAlias: { a: 'c', b: 'c' },
  });
  const shikiConfig = { langs: ['m'], langAlias: { nf: 'groovy' } };
  await setup(undefined, {}, {}, { shikiConfig });
  expect(getRegistry()?.expressiveCode?.shiki).toEqual(shikiConfig);
  await setup(undefined, { shiki: { langs: ['own'] } }, {}, { shikiConfig });
  expect(getRegistry()?.expressiveCode?.shiki).toEqual({ langs: ['own'], langAlias: { nf: 'groovy' } });
});

test('fails when Expressive Code is off, with a hint that an earlier plugin can have turned it off', async () => {
  await expect(setup(undefined, false)).rejects.toMatchObject({
    message: expect.stringContaining('needs Expressive Code'),
    hint: expect.stringContaining('A plugin listed before starlight-codeblocks'),
  });
});

test('validates options when the plugin is created', () => {
  expect(() => codeblocks({ fokus: {} } as never)).toThrow('unknown option `fokus`');
});

// A public contract: starlight-pydocs reads this to decide whether to add `{:py}` to inline code in docstrings,
// and whether its links get the API card instead of a `title` tooltip.
const read = () =>
  (globalThis as Record<symbol, { options: { inlineHighlighting: unknown; apiLinks: unknown } } | undefined>)[
    Symbol.for('starlight-codeblocks')
  ];

test('publishes its registry at Symbol.for("starlight-codeblocks"), with inlineHighlighting and apiLinks truthy only when on', async () => {
  await setup();
  expect(read()?.options.inlineHighlighting).toBeTruthy();
  expect(read()?.options.apiLinks).toBeTruthy();
  await setup(undefined, {}, { inlineHighlighting: { defaultLanguage: 'py' } });
  expect(read()?.options.inlineHighlighting).toBeTruthy();
  await setup(undefined, {}, { inlineHighlighting: false, apiLinks: false });
  expect(read()?.options.inlineHighlighting).toBe(false);
  expect(read()?.options.apiLinks).toBe(false);
});
