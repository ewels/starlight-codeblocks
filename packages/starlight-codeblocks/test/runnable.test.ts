import { getColorContrast } from '@expressive-code/core';
import { h, toHtml } from '@expressive-code/core/hast';
import { afterEach, expect, test } from 'vitest';
import { keepCopiedText, pluginCore } from '../src/expressive-code/core.ts';
import { pluginRunnable, runtimeFileName, runtimeModules } from '../src/expressive-code/runnable.ts';
import { runtimePlugins } from '../src/integration.ts';
import { setRegistry } from '../src/registry.ts';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

afterEach(() => setRegistry(undefined));

const js = { runnable: { runtimes: { javascript: '/runtimes/js.js' } } };

test('runnable adds a Run button to the title bar and an empty live output panel', async () => {
  const { html, copyText, warnings } = await render(block('js runnable', 'console.log(1)'), js);
  expect(html).toMatch(
    /<figcaption class="header"><span class="scb-tools"><button type="button" class="scb-btn scb-run scb-no-print scb-needs-js">Run<\/button><\/span><\/figcaption>/,
  );
  expect(html).toContain('<div class="scb-run-output" aria-live="polite"></div></figure>');
  expect(html).toContain('data-scb-runnable="/runtimes/js.js" data-scb-runnable-name="JavaScript"');
  expect(html).toContain('data-scb-runnable-timeout="10000"');
  expect(html).not.toContain('data-scb-code');
  expect(copyText).toBe('console.log(1)');
  expect(warnings).toEqual([]);
  const timeout = await render(block('js runnable', 'x'), { runnable: { ...js.runnable, timeout: 2500 } });
  expect(timeout.html).toContain('data-scb-runnable-timeout="2500"');
});

test('finds the runtime by the language name or its alias, for a pycon session too', async () => {
  const python = { runnable: { runtimes: { python: '/py.js' } } };
  for (const lang of ['py', 'pycon']) {
    const { html, warnings } = await render(block(`${lang} runnable`, '>>> 1 + 1'), python);
    expect(html).toContain('data-scb-runnable="/py.js" data-scb-runnable-name="Python"');
    expect(warnings.filter((w) => w.includes('runnable'))).toEqual([]);
  }
  const byAlias = { runnable: { runtimes: { py: '/alias.js' } } };
  expect((await render(block('python runnable', 'print(1)'), byAlias)).html).toContain('data-scb-runnable="/alias.js"');
  expect((await render(block('py runnable', 'print(1)'), byAlias)).html).toContain('data-scb-runnable="/alias.js"');
});

test('with shell copy off, a session still runs its commands only', async () => {
  const runtimes = { python: '/py.js' };
  const off = await render(block('pycon runnable', '>>> x = (1 +', '... 1)', '>>> x', '2'), {
    shellCopy: false,
    runnable: { runtimes },
  });
  expect(off.html).toContain(`data-scb-runnable-session="x = (1 +\x7F1)\x7Fx"`);
  const on = await render(block('pycon runnable', '>>> x', '2'), { runnable: { runtimes } });
  expect(on.html).not.toContain('data-scb-runnable-session');
});

test('a language without a runtime warns and gets no button, and Object.prototype names are not runtimes', async () => {
  const { html, warnings } = await render(block('rust runnable', 'fn main() {}'), js);
  expect(html).not.toContain('scb-run');
  expect(warnings).toEqual([
    'src/content/docs/example.md, rust code block: `runnable` needs a runtime for rust. Add one to `runnable.runtimes`.',
  ]);
  expect((await render(block('constructor runnable', 'a'), js)).warnings.join('\n')).toContain('needs a runtime');
});

test('with codeblocks(), the block points at the bundled module in the assets folder', async () => {
  setRegistry({ options: {} as never, plugins: [], base: '/docs', assets: '_astro' });
  const { html } = await render(block('py runnable', 'print(1)'), js);
  expect(html).toContain('data-scb-runnable="/docs/_astro/scb-runtime-python.js"');
  setRegistry({ options: {} as never, plugins: [], base: '/', assets: '_assets' });
  expect((await render(block('js runnable', 'x'), js)).html).toContain(
    'data-scb-runnable="/_assets/scb-runtime-javascript.js"',
  );
});

test('the built-in Python runtime comes only with codeblocks(), and site runtimes can replace it', () => {
  expect(runtimeModules({ js: './a.ts' }, false)).toEqual({ javascript: './a.ts' });
  expect(runtimeModules({ js: './a.ts' }, true)).toEqual({
    python: 'starlight-codeblocks/runtimes/pyodide',
    javascript: './a.ts',
  });
  expect(runtimeModules({ py: './py.ts' }, true)).toEqual({ python: './py.ts' });
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

test('blocks without runnable render the same with the feature off', async () => {
  const plain = block('js title="a.js"', 'console.log(1)');
  expect((await render(plain, js)).html).toBe((await render(plain, { runnable: false })).html);
  expect((await render(block('js runnable', 'x'), { runnable: false })).html).not.toContain('scb-run');
});

test('output and error colours meet 4.5:1 in the dark and the light theme', async () => {
  for (const v of await variants([pluginCore(), pluginRunnable()])) {
    for (const key of ['outputForeground', 'errorForeground']) {
      const colour = v.get(`codeblocksRunnable.${key}`);
      expect(getColorContrast(colour, v.get('codeBackground')), `${key}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('the code goes on the figure only when the block has no copy button', () => {
  const withoutButton = h('div', [h('figure', [h('pre', 'a')])]);
  keepCopiedText(withoutButton, 'a\nb');
  expect(toHtml(withoutButton)).toContain('<figure data-scb-code="a\x7Fb">');
});

test('the output panel follows the footnote list, so that it stays under the code', async () => {
  const { html } = await render(block('js runnable', '// [!ref] Logs.', 'console.log(1)'), js);
  expect(html.indexOf('class="scb-footnotes"')).toBeGreaterThan(-1);
  expect(html.indexOf('class="scb-footnotes"')).toBeLessThan(html.indexOf('scb-run-output'));
});
