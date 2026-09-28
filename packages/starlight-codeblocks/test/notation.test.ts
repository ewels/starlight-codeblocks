import { describe, expect, test } from 'vitest';
import { commentSyntaxFor } from '../src/expressive-code/comments.ts';
import { type DirectiveSpecs, parseLine, parseNotation } from '../src/expressive-code/notation.ts';

const specs: DirectiveSpecs = {
  'code focus': { placement: 'end' },
  'code highlight': { placement: 'end' },
  'code error': { placement: 'end', text: true },
  annotate: { placement: 'end', text: true },
  mention: { placement: 'end' },
  callout: { placement: 'own', text: true },
  link: { placement: 'own' },
};
const js = commentSyntaxFor('js');

function parse(text: string, syntaxes = js) {
  const problems: string[] = [];
  const result = parseLine(text, syntaxes, specs, (message) => problems.push(message));
  return { ...result, problems };
}

describe('parseLine', () => {
  test('warns that text before an own-line directive is dropped', () => {
    const { removed, problems } = parse('// Setup: [!callout /x/] Why');
    expect(removed).toBe(true);
    expect(problems).toEqual(['`Setup:` is dropped, because the line holds a directive that removes it.']);
  });

  test('leaves lines without directives unchanged', () => {
    expect(parse('const a = 1 // counter')).toMatchObject({ text: 'const a = 1 // counter', directives: [] });
  });

  test('removes a comment that holds only directives, with the whitespace before it', () => {
    const { text, directives } = parse('const a = 1   // [!code focus]');
    expect(text).toBe('const a = 1');
    expect(directives).toMatchObject([{ name: 'code focus', count: 1 }]);
  });

  test('removes a comment before the code, and keeps the indentation', () => {
    const css = commentSyntaxFor('css');
    expect(parse('/* [!code focus] */ color: red;', css).text).toBe('color: red;');
    expect(parse('  /* [!code focus] */ color: red;', css).text).toBe('  color: red;');
    expect(parse('  /* [!code focus] */', css)).toMatchObject({ text: '', removed: true });
  });

  test('removes a JSX comment with its braces', () => {
    const tsx = commentSyntaxFor('tsx');
    expect(parse('  <Button />{/* [!code focus] */}', tsx).text).toBe('  <Button />');
    expect(parse('  {/* [!callout] Note */}', tsx)).toMatchObject({ removed: true, directives: [{ text: 'Note' }] });
    expect(parse('  {/* [!code focus] */ x', tsx).text).toBe('  { x');
  });

  test('reads a directive after a `[!word]` that is not in a comment', () => {
    expect(parse('log("[!x]"); // [!code focus]')).toMatchObject({
      text: 'log("[!x]");',
      directives: [{ name: 'code focus' }],
    });
    expect(parse('arr[!flag] // [!code focus]').text).toBe('arr[!flag]');
    const md = parse('> [!NOTE] <!-- [!code highlight] -->', commentSyntaxFor('md'));
    expect(md).toMatchObject({ text: '> [!NOTE]', directives: [{ name: 'code highlight' }], problems: [] });
  });

  test('keeps the rest of the comment', () => {
    expect(parse('const a = 1 // counter [!code focus]').text).toBe('const a = 1 // counter');
    expect(parse('const a = 1 // [!code focus] counter').text).toBe('const a = 1 // counter');
  });

  test('reads a count, a message, a name and literal text', () => {
    expect(parse('x // [!code focus:3]').directives[0]).toMatchObject({ count: 3 });
    expect(parse('x // [!code error] Missing `await`').directives[0]).toMatchObject({ text: 'Missing `await`' });
    expect(parse('x // [!mention handler]').directives[0]).toMatchObject({ args: ['handler'] });
    expect(parse('// [!link /fetch(url)/ https://example.com/fetch]').directives[0]).toMatchObject({
      match: 'fetch(url)',
      args: ['https://example.com/fetch'],
    });
    expect(parse('// [!callout /a] b/] Note').directives[0]).toMatchObject({ match: 'a] b', text: 'Note' });
  });

  test('ends a message at the next directive', () => {
    const { directives, text } = parse('x // [!code error] Wrong type [!code focus]');
    expect(text).toBe('x');
    expect(directives).toMatchObject([{ name: 'code error', text: 'Wrong type' }, { name: 'code focus' }]);
  });

  test('marks lines with own-line directives as removed', () => {
    expect(parse('  // [!callout /a/] Note')).toMatchObject({ removed: true, text: '' });
  });

  test('ignores directives outside comments', () => {
    expect(parse('const s = "[!code focus]"')).toMatchObject({ text: 'const s = "[!code focus]"', directives: [] });
    expect(parse('/* a */ x = "[!code focus]"').directives).toEqual([]);
  });

  test('finds the comment after a string that looks like one', () => {
    expect(parse('const url = "https://example.com" // [!code focus]').text).toBe('const url = "https://example.com"');
  });

  test('finds the comment after an unpaired quote when the comment holds an apostrophe', () => {
    const rust = commentSyntaxFor('rust');
    expect(parse(`const S: &'static str = "x"; // don't [!code highlight]`, rust)).toMatchObject({
      text: `const S: &'static str = "x"; // don't`,
      directives: [{ name: 'code highlight' }],
    });
    expect(parse("fn f(x: &'static str) {} // don't [!code focus]", rust).text).toBe(
      "fn f(x: &'static str) {} // don't",
    );
    expect(parse("(setq x 'foo) ; it's [!code focus]", commentSyntaxFor('lisp')).text).toBe("(setq x 'foo) ; it's");
    expect(parse("Don't <!-- it's [!code focus] -->", commentSyntaxFor('md')).text).toBe("Don't <!-- it's -->");
  });

  test('still reads quotes around and inside comments correctly', () => {
    expect(parse("// don't [!code focus]")).toMatchObject({ text: "// don't", directives: [{ name: 'code focus' }] });
    expect(parse(`x = "it's" # [!code focus]`, commentSyntaxFor('python')).text).toBe(`x = "it's"`);
    expect(parse('const s = "// [!code focus]"')).toMatchObject({
      text: 'const s = "// [!code focus]"',
      directives: [],
    });
    expect(parse("fn f<'a>(x: &'a str) -> &'a str { x } // [!code focus]", commentSyntaxFor('rust')).text).toBe(
      "fn f<'a>(x: &'a str) -> &'a str { x }",
    );
    expect(parse('const a = "http://x", b = "[!code focus]";')).toMatchObject({
      text: 'const a = "http://x", b = "[!code focus]";',
      directives: [],
    });
    expect(parse('fetch("http://x") [!code focus]')).toMatchObject({
      text: 'fetch("http://x") [!code focus]',
      directives: [],
    });
    expect(parse("fn f<'a, 'b>(x: &'a str, y: &'b str) // [!code focus]", commentSyntaxFor('rust')).text).toBe(
      "fn f<'a, 'b>(x: &'a str, y: &'b str)",
    );
  });

  test('handles block comments', () => {
    const html = commentSyntaxFor('html');
    expect(parse('<p>Hi</p> <!-- [!code focus] -->', html).text).toBe('<p>Hi</p>');
    expect(parse('<p>Hi</p> <!-- note [!code focus] -->', html).text).toBe('<p>Hi</p> <!-- note -->');
    expect(parse('a /* [!code focus] */ b').text).toBe('a b');
  });

  test('renders escaped directives as literal text', () => {
    expect(parse('x // [\\!code focus]')).toMatchObject({ text: 'x // [!code focus]', directives: [] });
    expect(parse('x // [!code error] Write [\\!code focus] here').directives[0]?.text).toBe('Write [!code focus] here');
  });

  test('renders an escaped own-line directive as literal text, without removing the line', () => {
    expect(parse('// [\\!callout /x/] Note')).toMatchObject({
      text: '// [!callout /x/] Note',
      removed: false,
      directives: [],
    });
  });

  test('reports unknown and malformed directives, and keeps them in the code', () => {
    const unknown = parse('x // [!code fokus]');
    expect(unknown.text).toBe('x // [!code fokus]');
    expect(unknown.problems[0]).toContain('`[!code fokus]` is not a known directive');
    expect(parse('x // [!code]').problems[0]).toContain('needs a name');
    expect(parse('x // [!code focus:0]').problems[0]).toContain('count of 1 or more');
    expect(parse('x // [!code focus:x]').problems[0]).toContain('count of 1 or more');
  });

  test('reads a comment opener inside the comment text as text', () => {
    expect(parse('# fixes #12 [!callout /x/] Why', commentSyntaxFor('py'))).toMatchObject({ removed: true });
    expect(parse('// see https://x.com [!callout /x/] Why')).toMatchObject({ removed: true });
    expect(parse('x // see https://x.com [!callout /x/] Why').problems[0]).toContain('must be on a line of its own');
  });

  test('reports own-line directives at the end of a line of code', () => {
    const result = parse('x // [!callout /x/] Note');
    expect(result).toMatchObject({ removed: false, text: 'x // [!callout /x/] Note', directives: [] });
    expect(result.problems[0]).toContain('must be on a line of its own');
  });
});

describe('parseNotation', () => {
  function block(lines: string[]) {
    const problems: [string, number][] = [];
    const parsed = parseNotation(lines, js, specs, (message, line) => problems.push([message, line]));
    return { parsed, problems };
  }

  test('moves own-line directives to the line below, in order', () => {
    const { parsed } = block(['// [!callout /a/] One', '// [!callout /b/] Two', 'a + b']);
    expect(parsed.map((line) => line.removed)).toEqual([true, true, false]);
    expect(parsed[2]?.directives.map((d) => d.text)).toEqual(['One', 'Two']);
  });

  test('moves the directives of a line with no code to the line below, as own-line directives', () => {
    const { parsed } = block(['// [!code highlight:2]', 'a()', 'b()']);
    expect(parsed.map((line) => line.removed)).toEqual([true, false, false]);
    expect(parsed[1]?.directives).toMatchObject([{ name: 'code highlight', count: 2 }]);
  });

  test('reports literal text with no match on the target line', () => {
    const { parsed, problems } = block(['// [!callout /c/] One', 'a + b']);
    expect(parsed[1]?.directives).toEqual([]);
    expect(problems).toEqual([[expect.stringContaining('does not match'), 1]]);
  });

  test('reports an own-line directive with no line below it', () => {
    const { problems } = block(['a', '// [!callout] Last']);
    expect(problems).toEqual([[expect.stringContaining('has no line below it'), 2]]);
  });
});

describe('commentSyntaxFor', () => {
  test('uses the built-in map, case-insensitive', () => {
    expect(commentSyntaxFor('Python')).toEqual([{ open: '#', close: undefined }]);
    expect(commentSyntaxFor('css')).toEqual([{ open: '/*', close: '*/' }]);
    expect(commentSyntaxFor('json')).toEqual([]);
  });

  test('resolves Shiki ids and aliases of listed languages', () => {
    expect(commentSyntaxFor('pwsh')).toEqual(commentSyntaxFor('powershell'));
    expect(commentSyntaxFor('shellsession')).toEqual([{ open: '#', close: undefined }]);
    expect(commentSyntaxFor('pwsh', { powershell: ['//'] })).toEqual([{ open: '//', close: undefined }]);
  });

  test('lets options add, replace and remove languages', () => {
    expect(commentSyntaxFor('cypher', { cypher: ['//'] })).toEqual([{ open: '//', close: undefined }]);
    expect(commentSyntaxFor('python', { python: [] })).toEqual([]);
  });
});
