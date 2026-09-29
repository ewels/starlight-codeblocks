import { getColorContrast } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { findBrackets } from '../src/expressive-code/brackets.ts';
import { commentSyntaxFor } from '../src/expressive-code/comments.ts';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

const js = commentSyntaxFor('js');
const at = (lines: string[], lang: string) =>
  findBrackets(lines, commentSyntaxFor(lang)).map(({ line, column }) => [line, column]);

test('findBrackets pairs brackets by nesting depth, and leaves out unmatched ones and ones in strings and comments', () => {
  const text = 'const a = (1 + [2, 3]);';
  expect(findBrackets([text], js).map((m) => [text[m.column], m.depth, m.pairId])).toEqual([
    ['[', 1, 'scb-brackets-0'],
    [']', 1, 'scb-brackets-0'],
    ['(', 0, 'scb-brackets-1'],
    [')', 0, 'scb-brackets-1'],
  ]);
  expect(findBrackets(['// (comment)', 'const s = "(str)";', 'const a = (1;'], js)).toEqual([]);
});

test('findBrackets skips escaped characters outside strings', () => {
  expect(at(["s.replace(/\\(/g, '');", 'foo(bar);', '/^https?:\\/\\//.test(url) && f(x);'], 'js')).toEqual([
    [0, 9],
    [0, 19],
    [1, 3],
    [1, 7],
    [2, 19],
    [2, 23],
    [2, 29],
    [2, 31],
  ]);
});

test('findBrackets counts brackets in template literal interpolations, also in a nested template', () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: JavaScript source as test input
  const simple = 'const u = `${base}/${encode(path[0])}`;';
  expect(
    findBrackets([simple], js)
      .map((m) => simple[m.column])
      .join(''),
  ).toBe('{}[](){}');
  // biome-ignore lint/suspicious/noTemplateCurlyInString: JavaScript source as test input
  const nested = "const s = `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`;";
  const pairs = findBrackets([nested], js);
  expect(pairs).toHaveLength(10);
  expect(pairs.map((m) => nested[m.column]).join('')).not.toContain('<');
});

test('findBrackets reads quotes, comments and strings per language', () => {
  const rust = ['impl Foo {', "    fn name<'a>(&'a self) -> &'static str {", "        let c = '{';", '    }', '}'];
  const closers = findBrackets(rust, commentSyntaxFor('rust'), true).filter((m) => rust[m.line]?.[m.column] === '}');
  expect(closers.map((m) => m.line)).toEqual([3, 4]);
  expect(findBrackets(["it's (fine)"], [])).toHaveLength(2);
  const python = ['result = run(', '    """', '    Steps: 1) load', "    ''' [ '''", '    """,', ')'];
  expect(at(python, 'python').map(([line]) => line)).toEqual([0, 5]);
  expect(at(['deploy() {', '  case "$1" in', '    prod) run ;;', '  esac', '}'], 'bash')).toEqual([
    [0, 6],
    [0, 7],
    [0, 9],
    [4, 0],
  ]);
  const hash = findBrackets(['count() {', `  n=\${#items[@]} # (note)`, '}'], commentSyntaxFor('bash'));
  expect(hash).toHaveLength(8);
  expect(hash.at(-1)).toMatchObject({ line: 2, column: 0, depth: 0 });
});

test('colours matching brackets by depth, cycling every 3 levels', async () => {
  const { html, copyText, warnings } = await render(block('js brackets', 'const a = (1 + [2, 3]);'));
  expect(html).toContain('<span class="scb-brackets-1" data-scb-pair="scb-brackets-1">(</span>');
  expect(html).toContain('<span class="scb-brackets-2" data-scb-pair="scb-brackets-0">[</span>');
  expect(html).toContain('data-scb-brackets=""');
  expect(copyText).toBe('const a = (1 + [2, 3]);');
  expect(warnings).toEqual([]);
});

test('brackets.languages turns it on for a language and its aliases, and brackets=false turns it off', async () => {
  const options = { brackets: { languages: ['js'] } };
  expect((await render(block('js', 'f(1);'), options)).html).toContain('scb-brackets-1');
  expect((await render(block('javascript', 'f(1);'), options)).html).toContain('scb-brackets-1');
  expect((await render(block('js brackets=false', 'f(1);'), options)).html).not.toContain('scb-brackets-');
});

test('renders the same as without the feature when a block does not use it or the feature is off', async () => {
  const md = block('js title="app.js" {2}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { brackets: false })).html);
  expect((await render(block('js brackets', 'f(1);'), { brackets: false })).html).not.toContain('scb-brackets');
});

test('skips comments in the syntax that notation.comments gives', async () => {
  const { html } = await render(block('matlab brackets', 'y = f(a) % see (note', 'z = g(b)'), {
    notation: { comments: { matlab: ['%'] } },
  });
  expect(html.match(/data-scb-pair=/g)).toHaveLength(4);
});

test('keeps a text marker and word diff on a bracket', async () => {
  const marked = (await render(block('js brackets ins="foo(1)"', 'const a = foo(1);'))).html;
  expect(marked).toMatch(/<ins>[\s\S]*scb-brackets-1[\s\S]*<\/ins>/);
  expect(marked).not.toMatch(/<\/ins><span class="scb-brackets/);
  const diff = (await render(block('diff lang="js" brackets', '-const a = f(1, 2);', '+const a = f[1, 2];'))).html;
  expect(diff).toContain('scb-worddiff-del');
  expect(diff).toContain('scb-worddiff-ins');
});

test('every bracket colour meets 4.5:1 contrast on the code background', async () => {
  for (const v of await variants()) {
    for (const key of ['colour1', 'colour2', 'colour3']) {
      const colour = v.get(`codeblocksBrackets.${key}`);
      expect(getColorContrast(colour, v.get('codeBackground')), `${key}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
