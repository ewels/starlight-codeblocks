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

test('runnable adds a Run code button under the block, after an empty live output panel', async () => {
  const { html, copyText, warnings } = await render(block('js runnable', 'console.log(1)'), js);
  expect(html).toContain(
    '<div class="scb-run-output" aria-live="polite"></div><div class="scb-run-controls scb-no-print"><button type="button" class="scb-run scb-no-print scb-needs-js" data-scb-run-again="Run again">Run code</button></div></figure>',
  );
  expect(html).not.toContain('scb-tools');
  expect(html).toContain('data-scb-runnable="/runtimes/js.js" data-scb-runnable-name="JavaScript"');
  expect(html).toContain('data-scb-runnable-timeout="10000"');
  expect(html).not.toContain('data-scb-code');
  expect(copyText).toBe('console.log(1)');
  expect(warnings).toEqual([]);
  const timeout = await render(block('js runnable', 'x'), { runnable: { ...js.runnable, timeout: 2500 } });
  expect(timeout.html).toContain('data-scb-runnable-timeout="2500"');
  const labels = await render(block('js runnable', 'x'), {
    runnable: { ...js.runnable, label: 'Ausführen', againLabel: 'Erneut ausführen' },
  });
  expect(labels.html).toContain('data-scb-run-again="Erneut ausführen">Ausführen</button>');
  const own = await render(
    block('js runnable runnable.label="Try it" runnable.againLabel="Once more" runnable.timeout=500', 'x'),
    js,
  );
  expect(own.html).toContain('data-scb-run-again="Once more">Try it</button>');
  expect(own.html).toContain('data-scb-runnable-timeout="500"');
  const bad = await render(block('js runnable runnable.timeout=0 runnable.label=" "', 'x'), js);
  expect(bad.html).toContain('data-scb-runnable-timeout="10000"');
  expect(bad.html).toContain('>Run code</button>');
  expect(bad.warnings).toHaveLength(2);
});

test('runnable.button puts the button in the title bar, under the block, or both', async () => {
  const titleButton =
    '<span class="scb-tools"><button type="button" class="scb-run scb-btn scb-no-print scb-needs-js" data-scb-run-again="Run again">Run code</button></span>';
  const title = await render(block('js runnable', 'x'), { runnable: { ...js.runnable, button: 'title' } });
  expect(title.html).toContain(titleButton);
  expect(title.html).not.toContain('scb-run-controls');
  const both = await render(block('js runnable runnable.button=both', 'x'), js);
  expect(both.html).toContain(titleButton);
  expect(both.html).toContain('scb-run-controls');
  const bad = await render(block('js runnable runnable.button=top', 'x'), js);
  expect(bad.html).not.toContain('scb-tools');
  expect(bad.warnings).toEqual([
    'src/content/docs/example.md, js code block: `runnable.button=top` must be one of `below`, `title`, `both`. The block uses the site setting.',
  ]);
});

test('runnable.output prints scripted output with no runtime, at the line delay', async () => {
  const { html, copyText, warnings } = await render(
    block('sh runnable.output="Pulling…\\nDone \\"ok\\"" runnable.outputDelay=0', 'nextflow run hello'),
  );
  expect(html).toContain(
    'data-scb-runnable="" data-scb-runnable-output="Pulling…\x7FDone &#x22;ok&#x22;" data-scb-runnable-delay="0"',
  );
  expect(html).toContain('scb-run-controls');
  expect(html).not.toContain('data-scb-runnable-name');
  expect(copyText).toBe('nextflow run hello');
  expect(warnings).toEqual([]);
  const site = await render(block('sh runnable.output="x"', 'y'), { runnable: { outputDelay: 50 } });
  expect(site.html).toContain('data-scb-runnable-delay="50"');
  expect((await render(block('sh runnable.output="x"', 'y'))).html).toContain('data-scb-runnable-delay="200"');
  const bad = await render(block('sh runnable.output="x" runnable.outputDelay=-1', 'y'));
  expect(bad.html).toContain('data-scb-runnable-delay="200"');
  expect(bad.warnings).toHaveLength(1);
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

test('[!output] takes the lines after it out of the code, up to [!output end] or the end', async () => {
  const toEnd = await render(block('sh', 'nextflow run hello.nf', '# [!output]', 'Pulling # [!wait 1500]', 'Done'));
  expect(toEnd.html).toContain(
    'data-scb-runnable="" data-scb-runnable-output="Pulling\x7FDone" data-scb-runnable-waits="{&#x22;0&#x22;:1500}" data-scb-runnable-delay="200"',
  );
  expect(toEnd.html).toContain('scb-run-controls');
  expect(toEnd.copyText).toBe('nextflow run hello.nf');
  expect(toEnd.warnings).toEqual([]);
  const ended = await render(block('sh', 'make', '# [!output]', 'built', '# [!output end]', 'make test'));
  expect(ended.html).toContain('data-scb-runnable-output="built"');
  expect(ended.html).not.toContain('data-scb-runnable-waits');
  expect(ended.copyText).toBe('make\nmake test');
  const bad = await render(block('sh', 'make', '# [!output end]', 'x # [!wait soon]'));
  expect(bad.html).not.toContain('scb-run');
  expect(bad.warnings.join('\n')).toContain('`[!output end]` needs an `[!output]` line before it.');
  const badWait = await render(block('sh', 'make # [!wait 5]', '# [!output]', 'x'));
  expect(badWait.warnings.join('\n')).toContain('`[!wait]` needs milliseconds, on a line of `[!output]`.');
});

test('a block with only output has the button in its code area, and no copy button', async () => {
  const { html, warnings } = await render(block('sh', '# [!output]', 'Hello'));
  expect(html).toContain('class="frame is-terminal scb-run-empty"');
  expect(html).toContain(
    '<pre data-language="sh"><code></code><button type="button" class="scb-run scb-run-start scb-no-print scb-needs-js" data-scb-run-again="Run again">Run code</button></pre>',
  );
  expect(html).not.toContain('class="copy"');
  expect(html).not.toContain('scb-run-controls');
  expect(warnings).toEqual([]);
  const title = await render(block('sh runnable.button=title', '# [!output]', 'Hello'));
  expect(title.html).not.toContain('scb-run-start');
});

test('blocks without runnable render the same with the feature off', async () => {
  const plain = block('js title="a.js"', 'console.log(1)');
  expect((await render(plain, js)).html).toBe((await render(plain, { runnable: false })).html);
  expect((await render(block('js runnable', 'x'), { runnable: false })).html).not.toContain('scb-run');
  expect((await render(block('sh runnable.output="x"', 'y'), { runnable: false })).html).not.toContain('scb-run');
});

test('output and error colours meet 4.5:1, and the button border 3:1, in the dark and the light theme', async () => {
  for (const v of await variants([pluginCore(), pluginRunnable()])) {
    for (const key of ['outputForeground', 'errorForeground']) {
      const colour = v.get(`codeblocksRunnable.${key}`);
      expect(getColorContrast(colour, v.get('codeBackground')), `${key}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
    }
    const border = v.get('codeblocksRunnable.buttonBorder');
    expect(getColorContrast(border, v.get('codeBackground')), v.name).toBeGreaterThanOrEqual(3);
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
