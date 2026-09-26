import { matches, selectAll } from '@expressive-code/core/hast';
import { fromHtml } from 'hast-util-from-html';
import { expect, test } from 'vitest';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

const blocks = [
  block('js', 'a(); // [!code error] Fails', 'b(); // [!code warning]'),
  block('js', 'run(a); // [!annotate] Runs it.', 'done(); // [!ref] The end.'),
  block('js', '// [!callout /signal/] Aborts.', 'fetch(url, { signal });'),
  block('js title="a.js" hidden={1} id="x" playground="typescript" run', 'setup();', 'main();'),
  block('js annotations="side"', 'run(a); // [!annotate] Runs it.'),
  block('sh placeholder="TOKEN"', 'curl -H "Bearer TOKEN"'),
];

/** The text of each rendered line without the marked decorations, as a tool that drops `.scb-deco` reads it. */
function codeText(html: string) {
  const root = fromHtml(html, { fragment: true });
  for (const element of selectAll('.scb-deco, input', root)) element.children = [];
  const text = (node: { type: string; value?: string; children?: unknown[] }): string =>
    node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map((c) => text(c as never)).join('');
  return selectAll('.ec-line', root)
    .map((line) => text(line))
    .join('\n');
}

test.each(blocks)('drops every decoration and keeps the code text: %s', async (markdown) => {
  const { rawHtml, copyText } = await render(markdown);
  expect(codeText(rawHtml)).toBe(copyText);
});

test('marks each decoration for Pagefind too, and leaves the code unmarked', async () => {
  const { rawHtml } = await render(blocks[0] as string);
  const root = fromHtml(rawHtml, { fragment: true });
  const marked = selectAll('.scb-deco', root);
  expect(marked.length).toBeGreaterThan(0);
  expect(marked.every((element) => element.properties.dataPagefindIgnore === '')).toBe(true);
  expect(selectAll('.ec-line, .code', root).some((element) => matches('.scb-deco', element))).toBe(false);
});

test('keeps the text of a placeholder next to its field', async () => {
  const { rawHtml } = await render(blocks[5] as string);
  expect(rawHtml).toContain('<span class="scb-placeholder-text">TOKEN</span>');
});
