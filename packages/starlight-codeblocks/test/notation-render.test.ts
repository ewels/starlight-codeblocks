import { expect, test } from 'vitest';
import type { CodeblocksPlugin } from '../src/expressive-code/core.ts';
import { getDirectives } from '../src/expressive-code/notation.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

test('renders a block without directives exactly as without the plugin', async () => {
  const md = block('js title="app.js" {2}', 'const a = 1', 'console.log(a) // log it');
  const withPlugin = await render(md);
  const without = await render(md, { notation: false });
  expect(withPlugin.html).toBe(without.html);
});

test('removes directives from the rendered and the copied text', async () => {
  const { html, copyText, warnings } = await render(
    block('js', 'const a = 1 // [!code highlight]', 'const b = 2 // sum [!code ++]', 'const c = 3 // [!code --:1]'),
  );
  expect(copyText).toBe('const a = 1\nconst b = 2 // sum\nconst c = 3');
  expect(html).not.toContain('[!code');
  expect(html).toContain('ec-line highlight mark');
  expect(html).toContain('ec-line highlight ins');
  expect(html).toContain('ec-line highlight del');
  expect(warnings).toEqual([]);
});

test('applies :N to the following lines', async () => {
  const { html } = await render(block('js', 'a() // [!code ++:2]', 'b()', 'c()'));
  expect(html.match(/ec-line highlight ins/g)).toHaveLength(2);
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
  const lines = html.match(/<div class="ec-line[^"]*"/g);
  expect(lines).toEqual([
    '<div class="ec-line"',
    '<div class="ec-line highlight mark del"',
    '<div class="ec-line highlight ins"',
  ]);
  expect(seen).toEqual(['About two on two()']);
});

test('renders an escaped directive as text', async () => {
  const { copyText } = await render(block('js', 'const a = 1 // [\\!code focus]'));
  expect(copyText).toBe('const a = 1 // [!code focus]');
});

test('warns about unknown directives with the file and line, and keeps them', async () => {
  const { copyText, warnings } = await render(block('js title="app.js"', 'a()', 'b() // [!code fokus]'));
  expect(copyText).toBe('a()\nb() // [!code fokus]');
  expect(warnings).toEqual([
    'src/content/docs/example.md, js code block "app.js", line 2: `[!code fokus]` is not a known directive. The line renders without it.',
  ]);
});

test('reads directives in the comment syntax of each language', async () => {
  expect((await render(block('py', 'x = 1  # [!code ++]'))).copyText).toBe('x = 1');
  expect((await render(block('sql', 'SELECT 1; -- [!code ++]'))).copyText).toBe('SELECT 1;');
  expect((await render(block('html', '<p>Hi</p> <!-- [!code ++] -->'))).copyText).toBe('<p>Hi</p>');
  expect((await render(block('json', '{"a": 1} // [!code ++]'))).copyText).toBe('{"a": 1} // [!code ++]');
});

test('uses the comment syntax from the options', async () => {
  const options = { notation: { comments: { cypher: ['//'] } } };
  expect((await render(block('cypher', 'MATCH (n) // [!code ++]'), options)).copyText).toBe('MATCH (n)');
});

test('leaves directives alone when notation is off', async () => {
  const { copyText } = await render(block('js', 'a() // [!code ++]'), { notation: false });
  expect(copyText).toBe('a() // [!code ++]');
});

test('keeps diff syntax working', async () => {
  const { copyText, html } = await render(block('diff lang="js"', '-a() // [!code focus]', '+b() // [!code ++]'));
  expect(copyText).toBe('a()\nb()');
  expect(html).toContain('ec-line highlight ins');
});
