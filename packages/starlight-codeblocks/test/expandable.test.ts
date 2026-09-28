import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { describe, expect, test } from 'vitest';
import { scrollycoding } from '../src/components/scrolly.ts';
import { codeWalkthrough, plainSteps } from '../src/components/steps.ts';
import { encodeVariant, SWITCHER_META } from '../src/expressive-code/code-switcher.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const many = (n: number) => Array.from({ length: n }, (_, i) => `line(${i})`);

test('caps a block at the site default of 12 lines with expandable', async () => {
  const { html, copyText, warnings } = await render(block('js expandable', ...many(20)));
  expect(html).toContain('data-scb-expandable="12"');
  expect(html).toContain('class="scb-expandable-bar scb-no-print"');
  expect(html).toContain('Show all 20 lines');
  expect(copyText.split('\n')).toHaveLength(20);
  expect(warnings).toEqual([]);
});

test('caps a block at N lines with expandable={N}', async () => {
  const { html } = await render(block('py title="report.py" expandable={8}', ...many(15)));
  expect(html).toContain('data-scb-expandable="8"');
  expect(html).toContain('Show all 15 lines');
});

test('does not collapse a block where fewer than 3 lines would be hidden', async () => {
  const { html } = await render(block('js expandable={10}', ...many(12)));
  expect(html).not.toContain('scb-expandable');
});

test('does not collapse a block shorter than the cap', async () => {
  const { html } = await render(block('js expandable={10}', ...many(5)));
  expect(html).not.toContain('scb-expandable');
});

test('renders a block without expandable the same as without the feature', async () => {
  const md = block('js title="a.js" {1}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { expandable: false })).html);
});

test('respects the expandable.lines site default', async () => {
  const { html } = await render(block('js expandable', ...many(10)), { expandable: { lines: 6 } });
  expect(html).toContain('data-scb-expandable="6"');
});

test('does nothing when the feature is off, even with the attribute', async () => {
  const { html } = await render(block('js expandable={5}', ...many(10)), { expandable: false });
  expect(html).not.toContain('scb-expandable');
});

describe('the auto option', () => {
  const auto = { expandable: { lines: 6, auto: 10 } };

  test('makes a block with more lines than auto expandable, at the lines option', async () => {
    const { html } = await render(block('js', ...many(11)), auto);
    expect(html).toContain('data-scb-expandable="6" data-scb-expandable-auto');
    expect(html).toContain('Show all 11 lines');
    expect((await render(block('js', ...many(10)), auto)).html).not.toContain('scb-expandable');
  });

  test('gives way to expandable=false and expandable={N} on the fence line', async () => {
    expect((await render(block('js expandable=false', ...many(20)), auto)).html).not.toContain('scb-expandable');
    const { html } = await render(block('js expandable={8}', ...many(20)), auto);
    expect(html).toContain('data-scb-expandable="8"');
    expect(html).not.toContain('data-scb-expandable-auto');
  });

  test('is off by default', async () => {
    expect((await render(block('js', ...many(40)))).html).not.toContain('scb-expandable');
  });

  test.each([
    ['a code switcher variant', `js ${SWITCHER_META}="${encodeVariant({ index: 0, labels: ['JS', 'TS'] })}"`],
    ['a runnable block', 'py runnable'],
    ['a block with collapsed sections', 'js collapse={2-5}'],
  ])('skips %s', async (_, fence) => {
    const { html } = await render(block(fence, ...many(20)), auto, [pluginCollapsibleSections()]);
    expect(html).not.toContain('scb-expandable');
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
});
