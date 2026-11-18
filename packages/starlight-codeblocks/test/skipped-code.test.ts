import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { fromHtml } from 'hast-util-from-html';
import { expect, test } from 'vitest';
import { readTokens } from '../src/components/tokens.ts';
import { markDecorations } from '../src/expressive-code/core.ts';
import { block, render } from './render.ts';

const skipLines = (html: string) =>
  html.match(/<div class="ec-line[^"]*scb-skip-line[^"]*"[^>]*>.*?<\/div><\/div>/g) ?? [];

test('draws a [!code skip] line as a marker, and copies it as a comment', async () => {
  const { html, copyText, warnings } = await render(
    block('js', 'function connect() {', '  // [!code skip]', '  return socket;', '}'),
  );
  expect(skipLines(html)).toEqual([
    '<div class="ec-line scb-skip-line"><div class="code">  <span class="scb-skip-source" aria-hidden="true">// ...</span><span class="scb-skip-marker"><span class="scb-skip-text">Code not shown</span></span></div></div>',
  ]);
  expect(copyText).toBe('function connect() {\n  // ...\n  return socket;\n}');
  expect(warnings).toEqual([]);
});

test('takes the marker text from the directive, with inline Markdown, and copies the text in the comment', async () => {
  const { html, copyText } = await render(block('py', 'import os', '# [!code skip] The `main()` function', 'main()'));
  expect(skipLines(html)).toEqual([expect.stringContaining('The <code>main()</code> function</span>')]);
  expect(copyText).toBe('import os\n# The `main()` function\nmain()');
});

test('counts a [!code skip] line in line numbers and ranges', async () => {
  const { html } = await render(block('js {3}', 'a();', '// [!code skip]', 'b();'));
  expect(html).toMatch(/<div class="ec-line highlight[^"]*"><div class="code">.*?b<\/span>/);
  const numbered = await render(block('js showLineNumbers', 'a();', '// [!code skip]', 'b();'), {}, [
    pluginLineNumbers(),
  ]);
  expect(skipLines(numbered.html)).toEqual([expect.stringMatching(/class="ln"[^>]*>2</)]);
  const end = await render(block('js', 'a();', '// [!code skip] More'));
  expect(end.html).toMatch(/>a<.*scb-skip-line.*More<\/span><\/span><\/div><\/div><\/code>/);
});

test('hides a [!code skip] line in a hidden run with the run', async () => {
  const { html } = await render(block('js hidden={2-4}', 'a();', 'b();', '// [!code skip] Inside', 'c();', 'd();'));
  expect(skipLines(html)).toEqual([expect.stringContaining('scb-skip-line scb-hidden-line scb-no-print')]);
});

test('warns about a [!code skip] on a line with code, with a count, or in output', async () => {
  const { html, warnings } = await render(block('js', 'a(); // [!code skip]', '// [!code skip:2]', 'b();'));
  expect(skipLines(html)).toEqual([]);
  expect(warnings).toEqual([
    expect.stringContaining('goes on a line of its own'),
    expect.stringContaining('`[!code skip:2]` takes no count'),
  ]);
  const output = await render(block('sh', 'make', '# [!output]', 'built', '# [!code skip]'));
  expect(output.warnings).toEqual([expect.stringContaining('is not in the code, so it shows as a comment')]);
});

test('keeps a [!code skip] line before [!output] in the code', async () => {
  const { html, warnings } = await render(block('sh', 'make', '# [!code skip] More', '# [!output]', 'built'));
  expect(warnings).toEqual([]);
  expect(skipLines(html)).toEqual([expect.stringContaining('More')]);
});

test('keeps the diff prefix and indentation of a [!code skip] line', async () => {
  const short = await render(block('diff lang="js"', ' function f() {', '+  // ...', '+  return 1;', ' }'));
  expect(skipLines(short.html)).toEqual([expect.stringContaining('<div class="code">  <span class="scb-skip-source"')]);
  expect(short.copyText).toBe('function f() {\n  // ...\n  return 1;\n}');
  const real = await render(
    block(
      'diff lang="js"',
      '--- a/x.js',
      '+++ b/x.js',
      '@@ -1 +1 @@',
      ' function f() {',
      '+  // [!code skip]',
      '+  return 1;',
    ),
  );
  expect(skipLines(real.html)).toEqual([expect.stringContaining('<div class="code">+  <span class="scb-skip-source"')]);
  expect(real.copyText).toContain('\n+  // ...\n');
});

test('reads `// ...` in every language with comments, and bare `...` in JSON, by default, and copies them as written', async () => {
  const js = await render(block('js', 'function connect() {', '  // ...', '  return socket;', '}'));
  const directive = await render(block('js', 'function connect() {', '  // [!code skip]', '  return socket;', '}'));
  expect(js.html).toBe(directive.html);
  const json = await render(block('json', '{', '  "a": 1,', '  ...', '}'));
  expect(skipLines(json.html)).toHaveLength(1);
  expect(json.copyText).toBe('{\n  "a": 1,\n  ...\n}');
  expect(json.warnings).toEqual([]);
});

test('leaves `...` with no alias for its language, or with more text, as written', async () => {
  for (const md of [
    block('py', 'def f():', '    ...'),
    block('yaml', 'a: 1', '...'),
    block('js', 'f(...args) // ...', '// ... more', '// [...]', '...'),
    block('json', '[', '  "..."', ']'),
  ]) {
    expect(skipLines((await render(md)).html)).toEqual([]);
  }
});

test('takes aliases by language, with `*` for the others, merged over the defaults', async () => {
  const skippedCode = { commentAliases: { '*': ['…'], py: [] }, bareAliases: { yml: ['...'] } };
  const lines = async (md: string) => skipLines((await render(md, { skippedCode })).html).length;
  expect(await lines(block('js', 'a();', '// …', '// ...', 'b();'))).toBe(1);
  expect(await lines(block('py', 'a()', '# …'))).toBe(0);
  expect(await lines(block('yaml', 'a: 1', '...', '# …'))).toBe(2);
  expect(await lines(block('json', '{', '  ...', '}'))).toBe(1);
  const custom = await render(block('js', 'a();', '// …', 'b();'), { skippedCode });
  expect(custom.copyText).toBe('a();\n// …\nb();');
});

test('renders as without the feature when a block skips nothing, and leaves the directive when it is off', async () => {
  const md = block('js title="a.js" {1}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { skippedCode: false })).html);
  const { copyText, warnings } = await render(block('js', 'a() // [!code skip]'), { skippedCode: false });
  expect(copyText).toBe('a() // [!code skip]');
  expect(warnings).toHaveLength(1);
});

test('keeps the line state message of a [!code skip] line', async () => {
  const { html } = await render(block('js', 'a();', '// [!code warn] Careful', '// [!code skip]', 'b();'));
  expect(skipLines(html)).toEqual([
    '<div class="ec-line scb-state scb-state-warning scb-skip-line"><div class="code"><span class="scb-state-prefix scb-sr-only">Warning:</span><span class="scb-skip-source" aria-hidden="true">// ...</span><span class="scb-skip-marker"><span class="scb-skip-text">Code not shown</span></span><span class="scb-state-label"><strong aria-hidden="true">Warning</strong> Careful</span></div></div>',
  ]);
});

test('reads no diff prefix in a line that the diff syntax already shortened', async () => {
  const { html, warnings } = await render(block('diff lang="yaml"', ' a:', ' - # [!code highlight]', '+  b: 1'));
  expect(html).not.toContain('[!code');
  expect(warnings).toEqual([]);
});

test('gives no warning for an alias in output, and leaves it as written', async () => {
  const sh = await render(block('sh', 'make', '# [!output]', 'built', '# ...'));
  expect(sh.warnings).toEqual([]);
  expect(sh.copyText).toBe('make');
  expect(sh.html).toContain('# ...');
});

test('gives the text of a dropped [!code skip] to the next directive that takes text', async () => {
  const { html, warnings } = await render(block('js', 'a(); // [!code skip error] Bad call'));
  expect(skipLines(html)).toEqual([]);
  expect(html).toMatch(/scb-state-label[^>]*>.*Bad call/);
  expect(warnings).toEqual([expect.stringContaining('goes on a line of its own')]);
});

test('reads the comment of a [!code skip] line as its tokens', async () => {
  const { html } = await render(block('js', 'a();', '  // [!code skip]', 'b();'));
  const tree = fromHtml(html, { fragment: true });
  markDecorations(tree);
  expect(readTokens(tree as never).code).toBe('a();\n  // ...\nb();');
});
