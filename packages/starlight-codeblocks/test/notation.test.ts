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
  test('leaves lines without directives unchanged', () => {
    expect(parse('const a = 1 // counter')).toMatchObject({ text: 'const a = 1 // counter', directives: [] });
  });

  test('removes a comment that holds only directives, with the whitespace before it', () => {
    const { text, directives } = parse('const a = 1   // [!code focus]');
    expect(text).toBe('const a = 1');
    expect(directives).toMatchObject([{ name: 'code focus', count: 1 }]);
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

  test('lets options add, replace and remove languages', () => {
    expect(commentSyntaxFor('cypher', { cypher: ['//'] })).toEqual([{ open: '//', close: undefined }]);
    expect(commentSyntaxFor('python', { python: [] })).toEqual([]);
  });
});
