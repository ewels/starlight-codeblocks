import { expect, test } from 'vitest';
import type { CodeblocksPlugin } from '../src/expressive-code/core.ts';
import { getDirectives } from '../src/expressive-code/notation.ts';
import { block, lineClasses, render } from './render.ts';

test('renders a block without directives exactly as without the plugin', async () => {
  const md = block('js title="app.js" {2}', 'const a = 1', 'console.log(a) // log it');
  expect((await render(md)).html).toBe((await render(md, { notation: false })).html);
});

test('removes directives from the rendered and the copied text, and applies them', async () => {
  const { html, copyText, warnings } = await render(
    block(
      'js',
      '// [!code highlight:2]',
      'const a = 1',
      'const b = 2 // sum [!code ++:2]',
      'const c = 3',
      'const d = 4 // [!code --]',
      'const e = 5 // [\\!code focus]',
    ),
  );
  expect(copyText).toBe('const a = 1\nconst b = 2 // sum\nconst c = 3\nconst d = 4\nconst e = 5 // [!code focus]');
  expect(lineClasses(html)).toEqual([
    'ec-line highlight mark',
    'ec-line highlight mark ins',
    'ec-line highlight ins',
    'ec-line highlight del',
    'ec-line',
  ]);
  expect(warnings).toEqual([]);
  const off = await render(block('js', 'a() // [!code ++]'), { notation: false });
  expect(off.copyText).toBe('a() // [!code ++]');
});

test.each([
  ['py', 'x = 1  # [!code ++]', 'x = 1', {}],
  ['sql', 'SELECT 1; -- [!code ++]', 'SELECT 1;', {}],
  ['html', '<p>Hi</p> <!-- [!code ++] -->', '<p>Hi</p>', {}],
  ['json', '{"a": 1} // [!code ++]', '{"a": 1} // [!code ++]', {}],
  ['sh', 'echo "# [!code focus]"', 'echo "# [!code focus]"', {}],
  ['cypher', 'MATCH (n) // [!code ++]', 'MATCH (n)', { notation: { comments: { cypher: ['//'] } } }],
])('reads directives in the comment syntax of %s', async (lang, line, copy, options) => {
  expect((await render(block(lang, line), options)).copyText).toBe(copy);
});

test('counts the lines that readers see in Expressive Code ranges and in directives', async () => {
  const seen: string[] = [];
  const note: CodeblocksPlugin = {
    name: 'test:note',
    directives: { note: { placement: 'own', text: true } },
    hooks: {
      annotateCode({ codeBlock }) {
        for (const d of getDirectives(codeBlock, 'note')) seen.push(`${d.text} on ${d.lines.map((l) => l.text)}`);
      },
    },
  };
  const { html, copyText } = await render(
    block('js {2} ins={3}', 'one()', '// [!note] About two', 'two() // [!code --]', 'three()'),
    {},
    [note],
  );
  expect(copyText).toBe('one()\ntwo()\nthree()');
  expect(lineClasses(html)).toEqual(['ec-line', 'ec-line highlight mark del', 'ec-line highlight ins']);
  expect(seen).toEqual(['About two on two()']);
});

test('applies every name in one `[!code …]`, and gives the text to the first name that takes text', async () => {
  const { html, copyText, warnings } = await render(
    block(
      'js',
      "import a from 'a' // [!code focus ++] Load the plugin",
      'const b = a() // [!code focus ++:2]',
      'const c = 1',
      'const d = 2 // [!code error warn] Bad',
    ),
  );
  expect(copyText).toBe("import a from 'a'\nconst b = a()\nconst c = 1\nconst d = 2");
  expect(lineClasses(html)).toEqual([
    'ec-line highlight ins',
    'ec-line highlight ins',
    'ec-line highlight ins scb-focus-out',
    'ec-line scb-focus-out scb-state scb-state-error scb-state-warning',
  ]);
  expect(html.match(/scb-state-label-ins">([^<]*)/)?.[1]).toBe('Load the plugin');
  expect(html).toContain('Error</strong> Bad<');
  expect(warnings).toEqual([]);
  expect((await render(block('js', 'a() // [!code focus fokus]'))).warnings.join()).toContain(
    'is not a known directive',
  );
});

test('warns about unknown directives with the file and line, and keeps them', async () => {
  const { copyText, warnings } = await render(block('js title="app.js"', 'a()', 'b() // [!code fokus]'));
  expect(copyText).toBe('a()\nb() // [!code fokus]');
  expect(warnings).toEqual([
    'src/content/docs/example.md, js code block "app.js", line 2: `[!code fokus]` is not a known directive. The line renders without it.',
  ]);
  const proto = await render(block('js', 'a() // [!constructor]'));
  expect(proto.html).toContain('[!constructor]');
  expect(proto.warnings.join('\n')).toContain('is not a known directive');
  expect((await render(block('constructor', 'a() // [!code focus]'))).html).toContain('[!code focus]');
});

test('works with diff syntax and diff-prefixed directive lines', async () => {
  const diff = await render(block('diff lang="js"', '-a() // [!code focus]', '+b() // [!code ++]'));
  expect(diff.copyText).toBe('a()\nb()');
  expect(diff.html).toContain('ec-line highlight ins');
  const unprefixed = await render(block('diff lang="js"', '// [!code highlight]', '+a()', '-b()', ' c()'));
  expect(unprefixed.copyText).toBe('a()\nb()\nc()');
  const highlight = await render(block('diff lang="js"', '+ // [!code highlight]', '+ foo()', '  bar()'));
  expect(highlight.copyText).toBe('foo()\nbar()');
  expect(highlight.html.match(/ec-line highlight mark ins/g)).toHaveLength(1);
  const callout = await render(block('diff lang="js"', '+ // [!callout] Why', '+ foo()', '  bar()'));
  expect(callout).toMatchObject({ copyText: 'foo()\nbar()', warnings: [] });
  expect(callout.html).toContain('Why');
  const meta = await render(block('js useDiffSyntax', '  const a = 1', '+ // [!code highlight]', '+ const b = 2'));
  expect(meta.copyText).toBe('const a = 1\nconst b = 2');
  expect(meta.html).not.toContain('[!code');
});
