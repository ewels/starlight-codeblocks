import type { ExpressiveCodePlugin } from '@expressive-code/core';
import { type Element, select, selectAll, toText } from '@expressive-code/core/hast';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { codeLines } from '../src/components/tokens.ts';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';

// Another plugin's `postprocessRenderedBlock` runs before ours and moves lines into `<details>`.
async function renderAfter(before: ExpressiveCodePlugin[], meta: string, ...lines: string[]) {
  const ec = new ExpressiveCode({ plugins: [...before, pluginCodeblocks()] });
  const { renderedGroupAst } = await ec.render({ code: lines.join('\n'), language: 'js', meta });
  return renderedGroupAst;
}

const text = (el: Element | undefined) => (el ? toText(el).trim() : undefined);
const lineWith = (root: Element, selector: string) =>
  selectAll('.ec-line', root).find((line) => select(selector, line));
const previous = (root: Element, el: Element) => {
  const parent = selectAll('*', root).find((p) => p.children.includes(el));
  return parent?.children[parent.children.indexOf(el) - 1] as Element | undefined;
};

const code = [
  "import a from 'a';",
  "import b from 'b';",
  "import c from 'c';",
  'run(a, b); // [!annotate] Runs both',
  '// [!callout] Calls it',
  'call(c);',
  '// [!ref] The end',
  'done();',
  'secret(); // [!code hide]',
];

test('line features find their line after collapsible sections moved lines', async () => {
  const root = await renderAfter([pluginCollapsibleSections()], 'collapse={1-3}', ...code);
  expect(text(lineWith(root, '.scb-annotation'))).toMatch(/^run\(a, b\);/);
  expect(text(lineWith(root, '.scb-footnote-badge'))).toMatch(/^done\(\);/);
  const callout = select('.scb-callout', root) as Element;
  const calledLine = selectAll('.ec-line', root).find((line) => text(line) === 'call(c);') as Element;
  expect(previous(root, calledLine)).toBe(callout);
});

test('hidden lines keep the other plugin’s markup and put the marker before the run', async () => {
  const root = await renderAfter([pluginCollapsibleSections()], 'collapse={1-3}', ...code);
  const details = select('details', root) as Element;
  expect(details).toBeTruthy();
  expect(selectAll('.ec-line', details).map(text)).toContain("import b from 'b';");
  const hidden = select('.scb-hidden-line', root) as Element;
  expect(text(hidden)).toBe('secret();');
  expect(previous(root, hidden)?.properties.className).toContain('scb-hidden-marker');
});

test('components count code lines without a collapsed section’s summary', async () => {
  const root = await renderAfter([pluginCollapsibleSections()], 'collapse={1-2}', 'a()', 'b()', 'c()');
  expect(selectAll('.ec-line', root)).toHaveLength(4);
  expect(codeLines(root).map(text)).toEqual(['a()', 'b()', 'c()']);
});
