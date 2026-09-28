import { getColorContrast } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { findBrackets } from '../src/expressive-code/brackets.ts';
import { commentSyntaxFor } from '../src/expressive-code/comments.ts';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

const js = commentSyntaxFor('js');

test('findBrackets pairs brackets by nesting depth, deepest first', () => {
  const matches = findBrackets(['const a = (1 + [2, 3]);'], js);
  expect(matches.map((m) => ({ char: 'const a = (1 + [2, 3]);'[m.column], depth: m.depth, pairId: m.pairId }))).toEqual(
    [
      { char: '[', depth: 1, pairId: 'scb-brackets-0' },
      { char: ']', depth: 1, pairId: 'scb-brackets-0' },
      { char: '(', depth: 0, pairId: 'scb-brackets-1' },
      { char: ')', depth: 0, pairId: 'scb-brackets-1' },
    ].sort((a, b) => a.pairId.localeCompare(b.pairId)),
  );
});

test('findBrackets skips brackets in strings and comments', () => {
  expect(findBrackets(['// (comment)', 'const s = "(str)";'], js)).toEqual([]);
});

test('findBrackets skips escaped characters outside strings', () => {
  const lines = ["s.replace(/\\(/g, '');", 'foo(bar);', '/^https?:\\/\\//.test(url) && f(x);'];
  const matches = findBrackets(lines, js);
  expect(matches.map((m) => [m.line, m.column, m.depth])).toEqual([
    [0, 9, 0],
    [0, 19, 0],
    [1, 3, 0],
    [1, 7, 0],
    [2, 19, 0],
    [2, 23, 0],
    [2, 29, 0],
    [2, 31, 0],
  ]);
});

test('findBrackets counts brackets in template literal interpolations, also in a nested template', () => {
  const at = (text: string) => findBrackets([text], js).map((m) => text.slice(0, m.column + 1));
  // biome-ignore lint/suspicious/noTemplateCurlyInString: JavaScript source as test input
  const simple = 'const u = `${base}/${encode(path[0])}`;';
  expect(at(simple).map((s) => s.at(-1))).toEqual(['{', '}', '[', ']', '(', ')', '{', '}']);
  // biome-ignore lint/suspicious/noTemplateCurlyInString: JavaScript source as test input
  const nested = "const s = `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`;";
  const pairs = findBrackets([nested], js);
  expect(pairs).toHaveLength(10);
  expect(pairs.map((m) => nested[m.column]).join('')).not.toContain('<');
});

test('findBrackets leaves an unmatched bracket out', () => {
  expect(findBrackets(['const a = (1;'], js)).toEqual([]);
});

test('colours matching brackets by depth, cycling every 3 levels', async () => {
  const { html, copyText, warnings } = await render(block('js brackets', 'const a = (1 + [2, 3]);'));
  expect(html).toContain('<span class="scb-brackets-1" data-scb-pair="scb-brackets-1">(</span>');
  expect(html).toContain('<span class="scb-brackets-2" data-scb-pair="scb-brackets-0">[</span>');
  expect(html).toContain('<pre data-language="js" data-scb-brackets="">');
  expect(copyText).toBe('const a = (1 + [2, 3]);');
  expect(warnings).toEqual([]);
});

test('leaves brackets in strings and comments with their normal colour', async () => {
  const { html } = await render(block('js brackets', '// (comment)', 'const s = "(str)";'));
  expect(html).not.toContain('scb-brackets');
});

test('turns on for every block of a language with brackets.languages', async () => {
  const { html } = await render(block('js', 'const a = (1);'), { brackets: { languages: ['js'] } });
  expect(html).toContain('scb-brackets-1');
});

test('renders a block without brackets the same as without the feature', async () => {
  const md = block('js title="app.js" {2}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { brackets: false })).html);
});

test('does nothing when the feature is off, even with the attribute', async () => {
  const { html } = await render(block('js brackets', 'const a = (1);'), { brackets: false });
  expect(html).not.toContain('scb-brackets');
});

test('every bracket colour meets 4.5:1 contrast on the code background', async () => {
  for (const v of await variants()) {
    for (const key of ['colour1', 'colour2', 'colour3']) {
      const colour = v.get(`codeblocksBrackets.${key}`);
      expect(getColorContrast(colour, v.get('codeBackground')), `${key}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('findBrackets treats a Rust lifetime as text, not the start of a string', () => {
  const lines = ['impl Foo {', "    fn name<'a>(&'a self) -> &'static str {", "        let c = '{';", '    }', '}'];
  const pairs = findBrackets(lines, commentSyntaxFor('rust'), true);
  const closers = pairs.filter((m) => '}'.includes(lines[m.line]?.[m.column] ?? ''));
  expect(closers.map((m) => m.line)).toEqual([3, 4]);
});

test('findBrackets treats a single quote with no partner on the line as text', () => {
  expect(findBrackets(["it's (fine)"], [])).toHaveLength(2);
});

test('brackets=false turns it off for a language in brackets.languages', async () => {
  const { html } = await render(block('js brackets=false', 'f(a);'), { brackets: { languages: ['js'] } });
  expect(html).not.toContain('scb-brackets-');
});

test('skips comments in the syntax that notation.comments gives', async () => {
  const { html } = await render(block('matlab brackets', 'y = f(a) % see (note', 'z = g(b)'), {
    notation: { comments: { matlab: ['%'] } },
  });
  expect(html.match(/data-scb-pair=/g)).toHaveLength(4);
});

test('findBrackets skips brackets in a triple-quoted string over several lines', () => {
  const lines = ['result = run(', '    """', '    Steps: 1) load', "    ''' [ '''", '    """,', ')'];
  const pairs = findBrackets(lines, commentSyntaxFor('python'));
  expect(pairs.map((m) => m.line)).toEqual([0, 5]);
});

test('turns on for an alias of a language in brackets.languages', async () => {
  const { html } = await render(block('javascript', 'f(1);'), { brackets: { languages: ['js'] } });
  expect(html).toContain('scb-brackets-1');
});

test('keeps a text marker and word diff on a bracket', async () => {
  const marked = (await render(block('js brackets ins="foo(1)"', 'const a = foo(1);'))).html;
  expect(marked).toMatch(/<ins>[\s\S]*scb-brackets-1[\s\S]*<\/ins>/);
  expect(marked).not.toMatch(/<\/ins><span class="scb-brackets/);
  const diff = (await render(block('diff lang="js" brackets', '-const a = f(1, 2);', '+const a = f[1, 2];'))).html;
  expect(diff).toContain('scb-worddiff-del');
  expect(diff).toContain('scb-worddiff-ins');
});

test('findBrackets skips a closing bracket of another type', () => {
  const lines = ['deploy() {', '  case "$1" in', '    prod) run ;;', '  esac', '}'];
  const pairs = findBrackets(lines, commentSyntaxFor('bash'));
  expect(pairs.map(({ line, column }) => [line, column])).toEqual([
    [0, 6],
    [0, 7],
    [0, 9],
    [4, 0],
  ]);
});

test('findBrackets treats a `#` inside a word as text, not a comment', () => {
  const pairs = findBrackets(['count() {', `  n=\${#items[@]} # (note)`, '}'], commentSyntaxFor('bash'));
  expect(pairs).toHaveLength(8);
  expect(pairs.at(-1)).toMatchObject({ line: 2, column: 0, depth: 0 });
});
