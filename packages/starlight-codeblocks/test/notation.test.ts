import { describe, expect, test } from 'vitest';
import { commentSyntaxFor } from '../src/expressive-code/comments.ts';
import { type DirectiveSpecs, parseLine, parseNotation } from '../src/expressive-code/notation.ts';

const specs: DirectiveSpecs = {
  'code focus': {},
  'code highlight': {},
  'code error': { text: true },
  annotate: { text: true },
  mention: {},
  callout: { text: true },
  link: {},
};
const js = commentSyntaxFor('js');

function parse(text: string, syntaxes = js) {
  const problems: string[] = [];
  const result = parseLine(text, syntaxes, specs, (message) => problems.push(message));
  return { ...result, problems };
}

describe('parseLine', () => {
  test.each([
    ['js', 'const a = 1   // [!code focus]', 'const a = 1'],
    ['js', 'const a = 1 // counter [!code focus]', 'const a = 1 // counter'],
    ['js', 'const a = 1 // [!code focus] counter', 'const a = 1 // counter'],
    ['js', 'a /* [!code focus] */ b', 'a b'],
    ['css', '/* [!code focus] */ color: red;', 'color: red;'],
    ['css', '  /* [!code focus] */ color: red;', '  color: red;'],
    ['tsx', '  <Button />{/* [!code focus] */}', '  <Button />'],
    ['tsx', '  {/* [!code focus] */ x', '  { x'],
    ['html', '<p>Hi</p> <!-- [!code focus] -->', '<p>Hi</p>'],
    ['html', '<p>Hi</p> <!-- note [!code focus] -->', '<p>Hi</p> <!-- note -->'],
    ['js', 'log("[!x]"); // [!code focus]', 'log("[!x]");'],
    ['js', 'arr[!flag] // [!code focus]', 'arr[!flag]'],
    ['md', '> [!NOTE] <!-- [!code highlight] -->', '> [!NOTE]'],
    ['js', 'const url = "https://example.com" // [!code focus]', 'const url = "https://example.com"'],
    ['js', "// don't [!code focus]", "// don't"],
    ['python', `x = "it's" # [!code focus]`, `x = "it's"`],
    ['rust', `const S: &'static str = "x"; // don't [!code highlight]`, `const S: &'static str = "x"; // don't`],
    ['rust', "fn f(x: &'static str) {} // don't [!code focus]", "fn f(x: &'static str) {} // don't"],
    ['rust', "fn f<'a>(x: &'a str) -> &'a str { x } // [!code focus]", "fn f<'a>(x: &'a str) -> &'a str { x }"],
    ['rust', "fn f<'a, 'b>(x: &'a str, y: &'b str) // [!code focus]", "fn f<'a, 'b>(x: &'a str, y: &'b str)"],
    ['lisp', "(setq x 'foo) ; it's [!code focus]", "(setq x 'foo) ; it's"],
    ['md', "Don't <!-- it's [!code focus] -->", "Don't <!-- it's -->"],
  ])('%s: reads and removes the directive in %j', (lang, input, text) => {
    const result = parse(input, commentSyntaxFor(lang));
    expect(result).toMatchObject({ text, removed: false, problems: [] });
    expect(result.directives).toHaveLength(1);
  });

  test.each([
    'const a = 1 // counter',
    'const s = "[!code focus]"',
    '/* a */ x = "[!code focus]"',
    'const s = "// [!code focus]"',
    'const a = "http://x", b = "[!code focus]";',
    'arr[!flag]',
  ])('leaves %j unchanged', (input) => {
    expect(parse(input)).toMatchObject({ text: input, directives: [], problems: [] });
  });

  test('reports a known directive outside a comment, and keeps it', () => {
    expect(parse('fetch("http://x") [!code focus]')).toMatchObject({
      text: 'fetch("http://x") [!code focus]',
      directives: [],
      problems: ['`[!code focus]` is not in a comment that this block reads. Use `//` or `/* */`. It shows as text.'],
    });
  });

  test('reads a count, a message, a name and literal text, and ends a message at the next directive', () => {
    expect(parse('x // [!code focus:3]').directives[0]).toMatchObject({ count: 3 });
    expect(parse('x // [!code error] Missing `await`').directives[0]).toMatchObject({ text: 'Missing `await`' });
    expect(parse('x // [!mention handler]').directives[0]).toMatchObject({ args: ['handler'] });
    expect(parse('// [!link /fetch(url)/ https://example.com/fetch]').directives[0]).toMatchObject({
      match: 'fetch(url)',
      args: ['https://example.com/fetch'],
    });
    expect(parse('// [!callout /a] b/] Note').directives[0]).toMatchObject({ match: 'a] b', text: 'Note' });
    expect(parse('x // [!code error] Wrong type [!code focus]')).toMatchObject({
      text: 'x',
      directives: [{ name: 'code error', text: 'Wrong type' }, { name: 'code focus' }],
    });
  });

  test('removes lines that hold only directives', () => {
    expect(parse('  // [!callout /a/] Note')).toMatchObject({ removed: true, text: '' });
    expect(parse('  /* [!code focus] */', commentSyntaxFor('css'))).toMatchObject({ text: '', removed: true });
    const jsx = parse('  {/* [!callout] Note */}', commentSyntaxFor('tsx'));
    expect(jsx).toMatchObject({ removed: true, directives: [{ text: 'Note' }] });
  });

  test('applies every directive at the end of a line to that line', () => {
    expect(parse('x // [!callout /x/] Note')).toMatchObject({
      removed: false,
      text: 'x',
      directives: [{ name: 'callout', match: 'x', text: 'Note' }],
      problems: [],
    });
    expect(parse('x // see https://x.com [!callout /x/] Why')).toMatchObject({ text: 'x // see https://x.com' });
  });

  test('keeps a comment with other text, and applies its directives to it', () => {
    expect(parse('// Setup: [!callout /Setup/] Why')).toMatchObject({
      removed: false,
      text: '// Setup:',
      directives: [{ name: 'callout', text: 'Why' }],
      problems: [],
    });
    expect(parse('# fixes #12 [!callout /x/] Why', commentSyntaxFor('py'))).toMatchObject({
      removed: false,
      text: '# fixes #12',
    });
  });

  test('renders escaped directives as literal text', () => {
    expect(parse('x // [\\!code focus]')).toMatchObject({ text: 'x // [!code focus]', directives: [] });
    expect(parse('x // [!code error] Write [\\!code focus] here').directives[0]?.text).toBe('Write [!code focus] here');
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
});

describe('parseNotation', () => {
  function parseBlock(lines: string[]) {
    const problems: [string, number][] = [];
    const parsed = parseNotation(lines, js, specs, (message, line) => problems.push([message, line]));
    return { parsed, problems };
  }

  test('moves the directives of lines with no code to the line below, in order', () => {
    const { parsed } = parseBlock(['// [!callout /a/] One', '// [!callout /b/] Two', 'a + b']);
    expect(parsed.map((line) => line.removed)).toEqual([true, true, false]);
    expect(parsed[2]?.directives.map((d) => d.text)).toEqual(['One', 'Two']);
    const end = parseBlock(['// [!code highlight:2]', 'a()', 'b()']).parsed;
    expect(end.map((line) => line.removed)).toEqual([true, false, false]);
    expect(end[1]?.directives).toMatchObject([{ name: 'code highlight', count: 2 }]);
  });

  test('reports literal text with no match, and a directive with no line below', () => {
    const { parsed, problems } = parseBlock(['// [!callout /c/] One', 'a + b']);
    expect(parsed[1]?.directives).toEqual([]);
    expect(problems).toEqual([[expect.stringContaining('does not match'), 1]]);
    expect(parseBlock(['a', '// [!callout] Last']).problems).toEqual([
      [expect.stringContaining('has no line below it'), 2],
    ]);
  });
});

test('commentSyntaxFor uses the built-in map, Shiki aliases and the options', () => {
  expect(commentSyntaxFor('Python')).toEqual([{ open: '#', close: undefined }]);
  expect(commentSyntaxFor('css')).toEqual([{ open: '/*', close: '*/' }]);
  expect(commentSyntaxFor('json')).toEqual([]);
  expect(commentSyntaxFor('pwsh')).toEqual(commentSyntaxFor('powershell'));
  expect(commentSyntaxFor('shellsession')).toEqual([{ open: '#', close: undefined }]);
  expect(commentSyntaxFor('pwsh', { powershell: ['//'] })).toEqual([{ open: '//', close: undefined }]);
  expect(commentSyntaxFor('cypher', { cypher: ['//'] })).toEqual([{ open: '//', close: undefined }]);
  expect(commentSyntaxFor('python', { python: [] })).toEqual([]);
});
