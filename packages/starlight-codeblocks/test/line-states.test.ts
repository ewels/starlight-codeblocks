import { getColorContrast, onBackground } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { variants } from './contrast.ts';
import { block, lineClasses, render } from './render.ts';

const todo = { todo: { label: 'To do', colour: { dark: '#c792ea', light: '#7c3aed' } } };

test('tints lines from error, warning and info ranges, with a hidden prefix and a visible name', async () => {
  const { html, copyText, warnings } = await render(
    block('js error={1} warning={2} info={3}', 'a()', 'b()', 'c()', 'd()'),
  );
  expect(lineClasses(html)).toEqual([
    'ec-line scb-state scb-state-error',
    'ec-line scb-state scb-state-warning',
    'ec-line scb-state scb-state-info',
    'ec-line',
  ]);
  expect(html).toContain('<div class="code"><span class="scb-state-prefix scb-sr-only">Error:</span>');
  expect(html).toContain('<span class="scb-state-prefix scb-sr-only">Note:</span>');
  expect(html).toContain('<span class="scb-state-label"><strong aria-hidden="true">Warning</strong></span></div>');
  expect(html.match(/scb-state-label/g)).toHaveLength(3);
  expect(copyText).toBe('a()\nb()\nc()\nd()');
  expect(warnings).toEqual([]);
});

test('renders directive messages as labels, with inline code, links and bold only, and leaves them out of the copied text', async () => {
  const { html, copyText } = await render(
    block(
      'js',
      'a() // [!code error] SyntaxError: expected `:`',
      'b() // keep [!code warning] **Slow** <b>x</b>',
      'c() // [!code info:2] Two lines',
      'd()',
      'e()',
    ),
  );
  expect(html).toContain(
    '<span class="scb-state-label"><strong aria-hidden="true">Error</strong> SyntaxError: expected <code>:</code></span></div>',
  );
  expect(html).toContain('<strong>Slow</strong> &#x3C;b>x&#x3C;/b>');
  expect(html.match(/scb-state-label/g)).toHaveLength(3);
  expect(lineClasses(html)).toEqual([
    'ec-line scb-state scb-state-error',
    'ec-line scb-state scb-state-warning',
    'ec-line scb-state scb-state-info',
    'ec-line scb-state scb-state-info',
    'ec-line',
  ]);
  expect(copyText).toBe('a()\nb() // keep\nc()\nd()\ne()');
});

test('shows the name on the first visible line of a run that starts on a hidden line', async () => {
  const { html } = await render(block('js error={2-4} hidden={2}', 'a()', 'b()', 'c()', 'd()'));
  expect(html.match(/<strong aria-hidden="true">Error<\/strong>/g)).toHaveLength(2);
  const lines = html.split('<div class="ec-line');
  expect(lines[3]).toContain('>c<');
  expect(lines[3]).toContain('<strong aria-hidden="true">Error</strong>');
});

test('combines states on one line', async () => {
  const { html } = await render(block('js error={1}', 'a() // [!code warning] Also slow'));
  expect(lineClasses(html)).toEqual(['ec-line scb-state scb-state-error scb-state-warning']);
  expect(html).toContain('<span class="scb-state-prefix scb-sr-only">Error, Warning:</span>');
});

test('supports custom states by attribute and directive, and new labels for built-in ones', async () => {
  const options = { lineStates: { states: todo } };
  const { html, copyText } = await render(block('js todo={1}', 'a()', 'b() // [!code todo] Add retries'), options);
  expect(lineClasses(html)).toEqual(['ec-line scb-state scb-state-todo', 'ec-line scb-state scb-state-todo']);
  expect(html).toContain('<span class="scb-state-prefix scb-sr-only">To do:</span>');
  expect(html).toContain('<strong aria-hidden="true">To do</strong> Add retries');
  expect(copyText).toBe('a()\nb()');
  const tip = { lineStates: { states: { info: { label: 'Tip', colour: { dark: '#6cb8ff', light: '#2369c0' } } } } };
  expect((await render(block('js info={1}', 'a()'), tip)).html).toContain('>Tip:</span>');
});

test('has a success state, and note and warn as other names for info and warning', async () => {
  const { html, warnings } = await render(
    block('js success={1} note={2}', 'a()', 'b()', 'c() // [!code warn] Slow', 'd() // [!code success] Done'),
  );
  expect(lineClasses(html)).toEqual([
    'ec-line scb-state scb-state-success',
    'ec-line scb-state scb-state-info',
    'ec-line scb-state scb-state-warning',
    'ec-line scb-state scb-state-success',
  ]);
  expect(html).toContain('<strong aria-hidden="true">Warning</strong> Slow');
  expect(html).toContain('<strong aria-hidden="true">Success</strong> Done');
  expect(warnings).toEqual([]);
});

test('with prefix off, a message has no name, and a line with no message still shows the name', async () => {
  const { html } = await render(block('js error={1}', 'a()', 'b() // [!code warning] Slow'), {
    lineStates: { prefix: false },
  });
  expect(html).toContain('<span class="scb-state-label">Slow</span>');
  expect(html).toContain('<span class="scb-state-label"><strong aria-hidden="true">Error</strong></span>');
  expect(html).toContain('<span class="scb-state-prefix scb-sr-only">Warning:</span>');
});

test('shows a message after ++, -- and highlight directives in a label, and leaves the text in the comment without the feature', async () => {
  const md = block(
    'js',
    'a() // [!code ++] Load the `plugin`',
    'b() // [!code --] Old',
    'c() // [!code highlight:2] Here',
    'd()',
  );
  const { html, copyText, warnings } = await render(md);
  expect(html).toContain('<span class="scb-state-label scb-state-label-ins">Load the <code>plugin</code></span>');
  expect(html).toContain('<span class="scb-state-label scb-state-label-del">Old</span>');
  expect(html.match(/scb-state-label-mark/g)).toHaveLength(1);
  expect(lineClasses(html)).toEqual([
    'ec-line highlight ins',
    'ec-line highlight del',
    'ec-line highlight mark',
    'ec-line highlight mark',
  ]);
  expect(copyText).toBe('a()\nb()\nc()\nd()');
  expect(warnings).toEqual([]);
  const off = await render(md, { lineStates: false });
  expect(off.copyText).toBe('a() // Load the `plugin`\nb() // Old\nc() // Here\nd()');
  expect(off.html).not.toContain('scb-state-label');
});

test('warns about unknown states and lines outside the block', async () => {
  const { warnings } = await render(block('js error={3}', 'a() // [!code todo]'));
  expect(warnings).toEqual([
    'src/content/docs/example.md, js code block, line 1: `[!code todo]` is not a known directive. The line renders without it.',
    'src/content/docs/example.md, js code block: `error={3}` names line 3, but the block has 1 lines. The plugin ignores it.',
  ]);
});

test('renders as without the feature when a block has no states, and leaves directives when it is off', async () => {
  const md = block('js title="app.js" {2}', 'a()', 'b() // [!code ++]');
  expect((await render(md)).html).toBe((await render(md, { lineStates: false })).html);
  const { copyText } = await render(block('js', 'a() // [!code error] Oops'), { lineStates: false });
  expect(copyText).toBe('a() // [!code error] Oops');
});

test('every state colour meets its contrast target in the dark and the light theme', async () => {
  for (const v of await variants(pluginCodeblocks({ lineStates: { states: todo } }))) {
    const get = (key: string) => v.get(`codeblocksLineStates.${key}`);
    const codeBg = v.get('codeBackground');
    for (const state of ['error', 'warning', 'info', 'success']) {
      expect(getColorContrast(get(state), codeBg), `${state} bar, ${v.name}`).toBeGreaterThanOrEqual(3);
    }
    for (const state of ['error', 'warning', 'info', 'success', 'todo']) {
      const lineBg = onBackground(get(`${state}Background`), codeBg);
      const labelBg = onBackground(get(`${state}LabelBackground`), lineBg);
      // The code on the line is checked as rendered, in test/tints.test.ts.
      expect(getColorContrast(get(`${state}LabelForeground`), labelBg), `${state} label`).toBeGreaterThanOrEqual(4.5);
    }
    for (const marker of ['ins', 'del', 'mark']) {
      const lineBg = onBackground(v.get(`textMarkers.${marker}Background`), codeBg);
      const labelBg = onBackground(get(`${marker}LabelBackground`), lineBg);
      expect(
        getColorContrast(get(`${marker}LabelForeground`), labelBg),
        `${marker} label, ${v.name}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});
