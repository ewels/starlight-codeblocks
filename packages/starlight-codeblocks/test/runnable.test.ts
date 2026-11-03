import { getColorContrast } from '@expressive-code/core';
import { h, toHtml } from '@expressive-code/core/hast';
import { afterEach, expect, test } from 'vitest';
import { keepCopiedText, pluginCore } from '../src/expressive-code/core.ts';
import { builtInStates } from '../src/expressive-code/line-states.ts';
import { pluginRunnable, runtimeFileName, runtimeModules } from '../src/expressive-code/runnable.ts';
import { runtimePlugins } from '../src/integration.ts';
import { setRegistry } from '../src/registry.ts';
import { tinted, variants } from './contrast.ts';
import { block, lineClasses, render } from './render.ts';

afterEach(() => setRegistry(undefined));

const js = { runnable: { runtimes: { javascript: '/runtimes/js.js' } } };

test('runnable adds a Run code button under the block, after an empty live output panel', async () => {
  const { html, copyText, warnings } = await render(block('js runnable', 'console.log(1)'), js);
  expect(html).toMatch(
    /<div class="scb-run-output" aria-live="polite" data-scb-texts="[^"]*"><\/div><div class="scb-run-controls scb-no-print"><button type="button" class="scb-run scb-no-print scb-needs-js" data-scb-run-again="Run again">Run code<\/button><\/div><\/figure>/,
  );
  expect(html).not.toContain('scb-tools');
  expect(html).toContain('data-scb-runnable="/runtimes/js.js"');
  expect(html).toContain('Loading the JavaScript runtime…');
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
  expect(html).not.toContain('data-scb-runnable-timeout');
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
    expect(html).toContain('data-scb-runnable="/py.js"');
    expect(html).toContain('Loading the Python runtime…');
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

test('the built-in runtimes come only with codeblocks(), and site runtimes can replace them', () => {
  const builtIn = {
    python: 'starlight-codeblocks/runtimes/pyodide',
    javascript: 'starlight-codeblocks/runtimes/javascript',
    typescript: 'starlight-codeblocks/runtimes/typescript',
  };
  expect(runtimeModules({ js: './a.ts' }, false)).toEqual({ javascript: './a.ts' });
  expect(runtimeModules(undefined, true)).toEqual(builtIn);
  expect(runtimeModules({ js: './a.ts', py: './py.ts' }, true)).toEqual({
    ...builtIn,
    javascript: './a.ts',
    python: './py.ts',
  });
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

test('[!output] keeps backslashes and the lines that other plugins delete, and gives way to runnable.output', async () => {
  const backslash = await render(block('sh', 'dir', '# [!output]', 'C:\\new\\dir # [!wait 500]', 'next'));
  expect(backslash.html).toContain(
    'data-scb-runnable-output="C:\\new\\dir\x7Fnext" data-scb-runnable-waits="{&#x22;0&#x22;:500}"',
  );
  // The frames plugin takes a file name comment in the first lines as the title.
  const title = await render(block('sh', '# [!output]', '# config.sh', 'Hello'));
  expect(title.html).toContain('data-scb-runnable-output="# config.sh\x7FHello"');
  const empty = await render(block('sh', '# [!output]', '# [!output end]', 'make'));
  expect(empty.copyText).toBe('make');
  const fence = await render(
    block('sh runnable.output="x"', 'make', '# [!output]', 'a # [!wait 500] [!code highlight]'),
  );
  expect(fence.html).toContain('data-scb-runnable-output="x"');
  expect(fence.html).not.toContain('data-scb-runnable-waits');
  expect(fence.html).not.toContain('scb-run-marks');
});

test('[!output stderr] and [!output stdout] start parts of standard error and standard output', async () => {
  const { html, copyText, warnings } = await render(
    block(
      'sh',
      'nextflow run hello.nf',
      '# [!output]',
      'executor >  local (1) # [!wait 1000]',
      '# [!output stderr]',
      'ERROR ~ Error executing process # [!wait 500]',
      'Caused by:',
      '# [!output stdout]',
      'Done',
      '# [!output end]',
      'ls',
    ),
  );
  expect(html).toContain(
    'data-scb-runnable-output="executor >  local (1)\x7FERROR ~ Error executing process\x7FCaused by:\x7FDone" data-scb-runnable-waits="{&#x22;0&#x22;:1000,&#x22;1&#x22;:500}" data-scb-runnable-streams="{&#x22;1&#x22;:&#x22;stderr&#x22;,&#x22;3&#x22;:&#x22;stdout&#x22;}"',
  );
  expect(copyText).toBe('nextflow run hello.nf\nls');
  expect(warnings).toEqual([]);
  const first = await render(block('sh', 'make', '# [!output stderr]', 'make: *** No targets.'));
  expect(first.html).toContain('data-scb-runnable-streams="{&#x22;0&#x22;:&#x22;stderr&#x22;}"');
  expect(first.copyText).toBe('make');
  // A switch to the stream that already prints starts no part.
  const same = await render(block('sh', 'make', '# [!output stdout]', 'a', '# [!output]', 'b'));
  expect(same.html).toContain('data-scb-runnable-output="a\x7Fb"');
  expect(same.html).not.toContain('data-scb-runnable-streams');
  expect(same.warnings).toEqual([]);
});

test('[!output] warns about other arguments and about a second output, and prints without them', async () => {
  const bad = await render(
    block('sh', 'make', '# [!output]', 'a', '# [!output sterr]', 'b', '# [!output end now]', 'c'),
  );
  expect(bad.html).toContain('data-scb-runnable-output="a\x7Fb\x7Fc"');
  expect(bad.html).not.toContain('data-scb-runnable-streams');
  expect(bad.copyText).toBe('make');
  expect(bad.warnings).toEqual([
    'src/content/docs/example.md, sh code block, line 4: `[!output]` takes nothing, `stdout`, `stderr` or `end`.',
    'src/content/docs/example.md, sh code block, line 6: `[!output]` takes nothing, `stdout`, `stderr` or `end`.',
  ]);
  const unknown = await render(block('sh', 'make', '# [!output now]', 'a'));
  expect(unknown.html).not.toContain('scb-run');
  expect(unknown.warnings).toHaveLength(1);
  const second = await render(
    block('sh', 'make', '# [!output]', 'a', '# [!output end]', 'make test', '# [!output stderr]', 'b'),
  );
  expect(second.html).toContain('data-scb-runnable-output="a"');
  expect(second.copyText).toBe('make\nmake test\nb');
  expect(second.warnings).toEqual([
    'src/content/docs/example.md, sh code block, line 6: A block has one output, so `[!output]` after `[!output end]` leaves its lines in the code.',
  ]);
});

test('[!code highlight] and line states on a line of output mark it in the output, as in the code', async () => {
  const { html, rawHtml, copyText, warnings } = await render(
    block(
      'sh',
      'nextflow run hello.nf',
      '# [!output]',
      'executor: local (1)',
      '[a8/1f6ead] sayHello (1) | 0 of 1 # [!code highlight]',
      'Cached: 2 # [!code info]',
      'Version 25.04 # [!code warning] Update to 26.04',
      'Done # [!code success]',
      '# [!output stderr]',
      'ERROR ~ Error executing process # [!code error]',
      'Caused by: # [!code error]',
    ),
  );
  const name = (label: string) => `<span class="scb-state-prefix scb-sr-only">${label}:</span>`;
  expect(html).toContain(
    `<div class="scb-run-marks" hidden><span class="scb-run-line scb-state-mark" data-scb-run-line="1">[a8/1f6ead] sayHello (1) | 0 of 1</span><span class="scb-run-line scb-state scb-state-info" data-scb-run-line="2">${name('Note')}Cached: 2<span class="scb-state-label"><strong aria-hidden="true">Note</strong></span></span><span class="scb-run-line scb-state scb-state-warning" data-scb-run-line="3">${name('Warning')}Version 25.04<span class="scb-state-label"><strong aria-hidden="true">Warning</strong> Update to 26.04</span></span><span class="scb-run-line scb-state scb-state-success" data-scb-run-line="4">${name('Success')}Done<span class="scb-state-label"><strong aria-hidden="true">Success</strong></span></span><span class="scb-run-line scb-state scb-state-error" data-scb-run-line="5">${name('Error')}ERROR ~ Error executing process<span class="scb-state-label"><strong aria-hidden="true">Error</strong></span></span><span class="scb-run-line scb-state scb-state-error" data-scb-run-line="6">${name('Error')}Caused by:</span></div>`,
  );
  expect(html).toContain(
    'data-scb-runnable-output="executor: local (1)\x7F[a8/1f6ead] sayHello (1) | 0 of 1\x7FCached: 2\x7FVersion 25.04\x7FDone\x7FERROR ~ Error executing process\x7FCaused by:"',
  );
  expect(html).toContain('data-scb-runnable-streams="{&#x22;5&#x22;:&#x22;stderr&#x22;}"');
  expect(lineClasses(html)).toEqual(['ec-line']);
  // Tools that read the HTML, and Pagefind, leave the marked lines out.
  expect(rawHtml).toContain('<div class="scb-run-marks scb-deco" hidden data-pagefind-ignore="">');
  expect(copyText).toBe('nextflow run hello.nf');
  expect(warnings).toEqual([]);
  const plain = await render(block('sh', 'make', '# [!output]', 'Done # [!wait 100]'));
  expect(plain.html).not.toContain('scb-run-marks');
  // Output has no inserted or deleted lines.
  const ins = await render(block('sh', 'ls', '# [!output]', 'a # [!code ++] added'));
  expect(ins.html).not.toContain('scb-run-marks');
});

test('[!wait] and a mark share one comment, in either order', async () => {
  const { html, warnings } = await render(
    block(
      'sh',
      'make',
      '# [!output]',
      'Compiling # [!wait 1500] [!code highlight]',
      'Failed # [!code error] Exit 2 [!wait 500]',
      'x',
    ),
  );
  expect(html).toContain(
    'data-scb-runnable-output="Compiling\x7FFailed\x7Fx" data-scb-runnable-waits="{&#x22;0&#x22;:1500,&#x22;1&#x22;:500}"',
  );
  expect(html).toContain('<span class="scb-run-line scb-state-mark" data-scb-run-line="0">Compiling</span>');
  expect(html).toContain(
    'Failed<span class="scb-state-label"><strong aria-hidden="true">Error</strong> Exit 2</span></span></div>',
  );
  expect(warnings).toEqual([]);
  const message = await render(block('sh', 'make', '# [!output]', 'Linking # [!code highlight] The slow step'));
  expect(message.html).toContain(
    '<span class="scb-run-line scb-state-mark" data-scb-run-line="0">Linking<span class="scb-state-label scb-state-label-mark">The slow step</span></span>',
  );
});

test('fence ranges and counts skip the lines of output, so they count the code lines only', async () => {
  const lines = ['one', '# [!output]', 'out a', 'out b', '# [!output end]', 'two', 'three'];
  const marked = await render(block('sh {3}', ...lines));
  expect(lineClasses(marked.html)).toEqual(['ec-line', 'ec-line', 'ec-line highlight mark']);
  expect(marked.html).not.toContain('scb-run-marks');
  const state = await render(block('sh error={2}', ...lines));
  expect(lineClasses(state.html)).toEqual(['ec-line', 'ec-line scb-state scb-state-error', 'ec-line']);
  const after = await render(block('sh', 'one', '# [!output]', 'out', '# [!output end]', 'two # [!code highlight]'));
  expect(lineClasses(after.html)).toEqual(['ec-line', 'ec-line highlight mark']);
  expect(after.html).not.toContain('scb-run-marks');
  const outside = await render(block('sh error={4}', ...lines));
  expect(outside.warnings).toEqual([
    'src/content/docs/example.md, sh code block: `error={4}` names line 4, but the block has 3 lines. The plugin ignores it.',
  ]);
  const count = await render(block('sh', 'one # [!code error:2]', '# [!output]', 'out'));
  expect(count.html).not.toContain('scb-run-marks');
  expect(count.warnings).toEqual([
    'src/content/docs/example.md, sh code block, line 1: `:2` runs past the last line of the block.',
  ]);
});

test('with line states off, marks on lines of output warn, and the lines print without them', async () => {
  const { html, warnings } = await render(
    block('sh', 'make', '# [!output]', 'Compiling # [!code highlight]', 'Failed # [!code error]'),
    { lineStates: false },
  );
  expect(html).not.toContain('scb-run-marks');
  expect(html).toContain('data-scb-runnable-output="Compiling\x7FFailed # [!code error]"');
  expect(warnings).toEqual([
    'src/content/docs/example.md, sh code block, line 4: `[!code error]` is not a known directive. The line renders without it.',
    'src/content/docs/example.md, sh code block, line 3: `[!code highlight]` on a line of output needs line states. The line prints without it.',
  ]);
});

test('the text of a marked line of output meets 4.5:1 on its tint, in the dark and the light theme', async () => {
  const pairs = [
    ...Object.keys(builtInStates).map((s) => [
      `codeblocksLineStates.${s}LabelForeground`,
      `codeblocksLineStates.${s}Background`,
    ]),
    ['codeblocksLineStates.markLabelForeground', 'textMarkers.markBackground'],
  ];
  for (const v of await variants()) {
    for (const [fg = '', bg = ''] of pairs) {
      expect(getColorContrast(v.get(fg), tinted(v, [v.get(bg)])), `${fg}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
    }
  }
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

test('runnable.packages lists the packages to install, with single spaces', async () => {
  const { html, warnings } = await render(block('py runnable runnable.packages=" python-slugify   tabulate "', 'x'), {
    runnable: { runtimes: { python: '/py.js' } },
  });
  expect(html).toContain('data-scb-runnable-packages="python-slugify tabulate"');
  expect(warnings).toEqual([]);
  const none = await render(block('py runnable', 'x'), { runnable: { runtimes: { python: '/py.js' } } });
  expect(none.html).not.toContain('data-scb-runnable-packages');
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
