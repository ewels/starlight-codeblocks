import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { expect, test } from 'vitest';
import { scrollycoding } from '../src/components/scrolly.ts';
import { codeWalkthrough, plainSteps } from '../src/components/steps.ts';
import { encodeVariant, SWITCHER_META } from '../src/expressive-code/code-switcher.ts';
import type { CodeblocksOptions } from '../src/options.ts';
import { baseStyles, block, render } from './render.ts';

const many = (n: number) => Array.from({ length: n }, (_, i) => `line(${i})`);

const auto = { expandable: { lines: 6, auto: 10 } };

test.each([
  ['js expandable', 20, {}, 12, 20],
  ['py title="report.py" expandable={8}', 15, {}, 8, 15],
  ['js expandable', 10, { expandable: { lines: 6 } }, 6, 10],
  ['js hidden={1-8} expandable={5}', 20, {}, 5, 12],
  ['js', 11, auto, 6, 11],
  ['js expandable={8}', 20, auto, 8, 20],
  ['py expandable expandable.lines=4', 20, {}, 4, 20],
  ['js expandable.lines=7', 11, auto, 7, 11],
])('caps %s with %i lines', async (fence, n, options, cap, total) => {
  const { html, copyText, warnings } = await render(block(fence, ...many(n)), options);
  expect(html).toContain(`data-scb-expandable="${cap}"`);
  expect(html.includes('data-scb-expandable-auto')).toBe(fence === 'js' || fence === 'js expandable.lines=7');
  expect(html).toContain('class="scb-expandable-bar scb-no-print"');
  expect(html).toContain(`Show all ${total} lines`);
  expect(copyText.split('\n')).toHaveLength(n);
  expect(warnings).toEqual([]);
});

test.each<[string, number, CodeblocksOptions]>([
  ['js expandable={10}', 12, {}],
  ['js expandable={10}', 5, {}],
  ['js expandable={5}', 10, { expandable: false }],
  ['js hidden={1-8} expandable={10}', 20, {}],
  ['js collapse={5-20} expandable={8}', 40, {}],
  ['js', 40, {}],
  ['js', 10, auto],
  ['js expandable=false', 20, auto],
  [`js ${SWITCHER_META}="${encodeVariant({ index: 0, labels: ['JS', 'TS'] })}"`, 20, auto],
  ['py runnable', 20, auto],
  ['js collapse={2-5}', 20, auto],
])('does not cap %s with %i lines', async (fence, n, options) => {
  const { html } = await render(block(fence, ...many(n)), options, [pluginCollapsibleSections()]);
  expect(html).not.toContain('scb-expandable');
});

test('renders a block without expandable the same as without the feature', async () => {
  const md = block('js title="a.js" {1}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { expandable: false })).html);
});

test('skips blocks in <CodeWalkthrough> and <Scrollycoding>, and keeps expandable on the fence line there', async () => {
  const automatic = (await render(block('js', ...many(20)), auto)).html;
  const explicit = (await render(block('js expandable', ...many(20)), auto)).html;
  for (const build of [codeWalkthrough, plainSteps]) {
    expect(build(automatic)).not.toContain('scb-expandable');
    expect(build(explicit)).toContain('scb-expandable-bar');
  }
  const steps = '<div class="scb-scrolly-step" data-focus="1"><p>Step</p></div>';
  expect(scrollycoding(automatic + steps)).not.toContain('scb-expandable');
  expect(scrollycoding(explicit + steps)).toContain('data-scb-expandable="6"');
});

test('a collapsed tail prints, but not its no-print lines', async () => {
  const css = await baseStyles();
  expect(css).toContain('.ec-line[hidden]:not(.scb-no-print){display:grid !important}');
  expect(css).toContain('.scb-callout[hidden]:not(.scb-no-print){display:flex !important}');
});
