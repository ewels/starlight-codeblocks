import { getColorContrast } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { afterEach, expect, test } from 'vitest';
import { pluginCore } from '../src/expressive-code/core.ts';
import { pluginRunnable, runtimeFileName } from '../src/expressive-code/runnable.ts';
import { runtimePlugins } from '../src/integration.ts';
import { setRegistry } from '../src/registry.ts';
import { render } from './render.ts';

afterEach(() => setRegistry(undefined));

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const js = { runnable: { runtimes: { javascript: '/runtimes/js.js' } } };

test('runnable adds a Run button to the title bar and an empty live output panel', async () => {
  const { html, warnings } = await render(block('js runnable', 'console.log(1)'), js);
  expect(html).toMatch(
    /<figcaption class="header"><span class="scb-tools"><button type="button" class="scb-btn scb-run scb-no-print">Run<\/button><\/span><\/figcaption>/,
  );
  expect(html).toContain('<div class="scb-run-output" aria-live="polite"></div></figure>');
  expect(html).toContain('data-scb-runnable="/runtimes/js.js" data-scb-runnable-name="JavaScript"');
  expect(html).toContain('data-scb-runnable-timeout="10000"');
  expect(warnings).toEqual([]);
});

test('finds the runtime by the language name or its alias, and shows the display name', async () => {
  const options = { runnable: { runtimes: { python: '/py.js' } } };
  expect((await render(block('py runnable', 'print(1)'), options)).html).toContain(
    'data-scb-runnable="/py.js" data-scb-runnable-name="Python"',
  );
  const byAlias = { runnable: { runtimes: { py: '/alias.js' } } };
  expect((await render(block('python runnable', 'print(1)'), byAlias)).html).not.toContain('data-scb-runnable=');
  expect((await render(block('py runnable', 'print(1)'), byAlias)).html).toContain('data-scb-runnable="/alias.js"');
});

test('the timeout option reaches the block', async () => {
  const { html } = await render(block('js runnable', 'x'), { runnable: { ...js.runnable, timeout: 2500 } });
  expect(html).toContain('data-scb-runnable-timeout="2500"');
});

test('a language without a runtime warns and gets no button', async () => {
  const { html, warnings } = await render(block('rust runnable', 'fn main() {}'), js);
  expect(html).not.toContain('scb-run');
  expect(warnings).toEqual([
    'src/content/docs/example.md, rust code block: `runnable` needs a runtime for rust. Add one to `runnable.runtimes`.',
  ]);
});

test('with codeblocks(), the block points at the bundled module in the assets folder', async () => {
  setRegistry({ options: {} as never, plugins: [], clientAssets: true, base: '/docs', assets: '_astro' });
  const { html } = await render(block('js runnable', 'x'), js);
  expect(html).toContain('data-scb-runnable="/docs/_astro/scb-runtime-javascript.js"');
  setRegistry({ options: {} as never, plugins: [], clientAssets: true, base: '/', assets: '_assets' });
  expect((await render(block('js runnable', 'x'), js)).html).toContain(
    'data-scb-runnable="/_assets/scb-runtime-javascript.js"',
  );
});

test('runtime file names are safe for any language name', () => {
  expect(runtimeFileName('c++')).toBe('scb-runtime-c__.js');
});

test('the Vite plugin emits each runtime as a chunk in the client build, and serves it in dev', async () => {
  const [serve, build] = runtimePlugins(
    { python: 'starlight-codeblocks/runtimes/pyodide', javascript: './src/js.ts' },
    new URL('file:///site/'),
    '_astro',
  );
  const emitted: unknown[] = [];
  build?.buildStart?.call({ environment: { name: 'prerender' }, emitFile: (f) => emitted.push(f) });
  expect(emitted).toEqual([]);
  build?.buildStart?.call({ environment: { name: 'client' }, emitFile: (f) => emitted.push(f) });
  expect(emitted).toEqual([
    {
      type: 'chunk',
      id: 'starlight-codeblocks/runtimes/pyodide',
      fileName: '_astro/scb-runtime-python.js',
      preserveSignature: 'strict',
    },
    { type: 'chunk', id: '/site/src/js.ts', fileName: '_astro/scb-runtime-javascript.js', preserveSignature: 'strict' },
  ]);
  const resolve = async (id: string) => ({ id: `resolved:${id}` });
  expect(await serve?.resolveId?.call({ resolve }, '/_astro/scb-runtime-javascript.js?import')).toBe(
    'resolved:/site/src/js.ts',
  );
  expect(await serve?.resolveId?.call({ resolve }, '/_astro/other.js')).toBeUndefined();
});

test('copied text is unchanged, and blocks without runnable render the same with the feature off', async () => {
  const md = block('js runnable', 'console.log(1)');
  expect((await render(md, js)).copyText).toBe('console.log(1)');
  const plain = block('js title="a.js"', 'console.log(1)');
  expect((await render(plain, js)).html).toBe((await render(plain, { runnable: false })).html);
  expect((await render(md, { runnable: false })).html).not.toContain('scb-run');
});

test('output and error colours meet 4.5:1 in the dark and the light theme', async () => {
  const backgrounds = { dark: ['#23262f', '#24292e'], light: ['#f6f7f9', '#ffffff'] };
  const ec = new ExpressiveCode({ plugins: [pluginCore(), pluginRunnable()] });
  await ec.getBaseStyles();
  for (const variant of ec.styleVariants) {
    for (const key of ['outputForeground', 'errorForeground']) {
      const colour = variant.resolvedStyleSettings.get(`codeblocksRunnable.${key}` as never) as string;
      for (const bg of backgrounds[variant.theme.type])
        expect(getColorContrast(colour, bg)).toBeGreaterThanOrEqual(4.5);
    }
  }
});
