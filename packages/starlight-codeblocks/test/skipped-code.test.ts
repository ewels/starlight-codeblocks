import { expect, test } from 'vitest';
import { block, render } from './render.ts';

const marker = (html: string) => html.match(/<div class="scb-skip-marker">.*?<\/div>/g) ?? [];

test('puts a marker where a [!code skip] line was, and leaves it out of the copied text', async () => {
  const { html, copyText, warnings } = await render(
    block('js', 'function connect() {', '  // [!code skip]', '  return socket;', '}'),
  );
  expect(marker(html)).toEqual([
    '<div class="scb-skip-marker"><span class="scb-skip-indent">  </span><span class="scb-skip-text">Code not shown</span></div>',
  ]);
  expect(html.indexOf('scb-skip-marker')).toBeLessThan(html.indexOf('return'));
  expect(html.indexOf('scb-skip-marker')).toBeGreaterThan(html.indexOf('connect'));
  expect(copyText).toBe('function connect() {\n  return socket;\n}');
  expect(warnings).toEqual([]);
});

test('takes the marker text from the directive, with inline Markdown', async () => {
  const { html } = await render(block('py', 'import os', '# [!code skip] The `main()` function', 'main()'));
  expect(marker(html)).toEqual([
    '<div class="scb-skip-marker"><span class="scb-skip-text">The <code>main()</code> function</span></div>',
  ]);
});

test('puts a marker after the last line, from a [!code skip] line at the end', async () => {
  const { html, copyText, warnings } = await render(block('js', 'const a = 1;', '// [!code skip] More'));
  expect(html).toMatch(/>1<.*<div class="scb-skip-marker"><span class="scb-skip-text">More<\/span><\/div><\/code>/);
  expect(copyText).toBe('const a = 1;');
  expect(warnings).toEqual([]);
});

test('puts a marker above a line with a trailing [!code skip]', async () => {
  const { html } = await render(block('js', 'a();', 'b(); // [!code skip]'));
  expect(html).toMatch(/>a<.*scb-skip-marker.*>b</);
});

test('renders as without the feature when a block skips nothing, and leaves the directive when it is off', async () => {
  const md = block('js title="a.js" {1}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { skippedCode: false })).html);
  const { copyText, warnings } = await render(block('js', 'a() // [!code skip]'), { skippedCode: false });
  expect(copyText).toBe('a() // [!code skip]');
  expect(warnings).toHaveLength(1);
});
