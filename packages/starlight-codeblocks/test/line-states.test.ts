import { getColorContrast, onBackground } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const lineClasses = (html: string) => html.match(/<div class="ec-line[^"]*"/g)?.map((m) => m.slice(12, -1));
const todo = { todo: { label: 'To do', colour: { dark: '#c792ea', light: '#7c3aed' } } };

test('tints lines from error, warning and info ranges, with a hidden prefix', async () => {
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
  expect(html).not.toContain('scb-state-label');
  expect(copyText).toBe('a()\nb()\nc()\nd()');
  expect(warnings).toEqual([]);
});

test('renders a directive message as a label and leaves it out of the copied text', async () => {
  const { html, copyText } = await render(
    block('py', 'for x in y  # [!code error] SyntaxError: expected `:`', '    print(x)  # [!code warning]'),
  );
  expect(html).toContain(
    '<span class="scb-state-label"><strong aria-hidden="true">Error</strong> SyntaxError: expected <code>:</code></span></div>',
  );
  expect(html.match(/scb-state-label/g)).toHaveLength(1);
  expect(lineClasses(html)).toEqual(['ec-line scb-state scb-state-error', 'ec-line scb-state scb-state-warning']);
  expect(copyText).toBe('for x in y\n    print(x)');
});

test('applies [!code info:N] to N lines, with the message on the first', async () => {
  const { html } = await render(block('js', 'a() // [!code info:2] Two lines', 'b()', 'c()'));
  expect(lineClasses(html)).toEqual([
    'ec-line scb-state scb-state-info',
    'ec-line scb-state scb-state-info',
    'ec-line',
  ]);
  expect(html.match(/scb-state-label/g)).toHaveLength(1);
});

test('keeps the rest of a comment and renders only inline code, links and bold', async () => {
  const { html, copyText } = await render(block('js', 'a() // keep [!code warning] **Slow** <b>x</b>'));
  expect(copyText).toBe('a() // keep');
  expect(html).toContain('<strong>Slow</strong> &#x3C;b>x&#x3C;/b>');
});

test('combines states on one line', async () => {
  const { html } = await render(block('js error={1}', 'a() // [!code warning] Also slow'));
  expect(lineClasses(html)).toEqual(['ec-line scb-state scb-state-error scb-state-warning']);
  expect(html).toContain('<span class="scb-state-prefix scb-sr-only">Error, Warning:</span>');
});

test('supports custom states by attribute and directive', async () => {
  const options = { lineStates: { states: todo } };
  const { html, copyText } = await render(block('js todo={1}', 'a()', 'b() // [!code todo] Add retries'), options);
  expect(lineClasses(html)).toEqual(['ec-line scb-state scb-state-todo', 'ec-line scb-state scb-state-todo']);
  expect(html).toContain('<span class="scb-state-prefix scb-sr-only">To do:</span>');
  expect(html).toContain('<strong aria-hidden="true">To do</strong> Add retries');
  expect(copyText).toBe('a()\nb()');
});

test('lets sites change the label of a built-in state', async () => {
  const options = { lineStates: { states: { info: { label: 'Tip', colour: { dark: '#6cb8ff', light: '#2369c0' } } } } };
  const { html } = await render(block('js info={1}', 'a()'), options);
  expect(html).toContain('>Tip:</span>');
});

test('warns about unknown states and lines outside the block', async () => {
  const { warnings } = await render(block('js error={3}', 'a() // [!code todo]'));
  expect(warnings).toEqual([
    'src/content/docs/example.md, js code block, line 1: `[!code todo]` is not a known directive. The line renders without it.',
    'src/content/docs/example.md, js code block: `error={3}` names line 3, but the block has 1 lines. The plugin ignores it.',
  ]);
});

test('renders a block without states as without the feature', async () => {
  const md = block('js title="app.js" {2}', 'a()', 'b() // [!code ++]');
  expect((await render(md)).html).toBe((await render(md, { lineStates: false })).html);
});

test('leaves state directives in the code when the feature is off', async () => {
  const { copyText } = await render(block('js', 'a() // [!code error] Oops'), { lineStates: false });
  expect(copyText).toBe('a() // [!code error] Oops');
});

test('every state colour meets its contrast target in the dark and the light theme', async () => {
  const ec = new ExpressiveCode({ plugins: [pluginCodeblocks({ lineStates: { states: todo } })] });
  await ec.getBaseStyles();
  const backgrounds = { dark: ['#23262f', '#24292e'], light: ['#f6f7f9', '#ffffff'] };
  for (const variant of ec.styleVariants) {
    const get = (key: string) => variant.resolvedStyleSettings.get(`codeblocksLineStates.${key}` as never) as string;
    for (const state of ['error', 'warning', 'info']) {
      for (const bg of backgrounds[variant.theme.type]) {
        expect(getColorContrast(get(state), bg), `${state} bar on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    }
    const codeBg = variant.resolvedStyleSettings.get('codeBackground') as string;
    for (const state of ['error', 'warning', 'info', 'todo']) {
      const lineBg = onBackground(get(`${state}Background`), codeBg);
      const labelBg = onBackground(get(`${state}LabelBackground`), lineBg);
      expect(getColorContrast(get(`${state}LabelForeground`), labelBg), `${state} label`).toBeGreaterThanOrEqual(4.5);
      expect(
        getColorContrast(variant.resolvedStyleSettings.get('codeForeground') as string, lineBg),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});
