import { getColorContrast } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { variants } from './contrast.ts';
import { apiLinks, block, render } from './render.ts';

const session = [
  '$ uv tool install ruff',
  'Resolved 1 package in 180ms',
  'Installed 1 executable: ruff',
  '$ ruff check src/ \\',
  '    --fix',
  'Found 3 errors (3 fixed, 0 remaining).',
];

test('Copy commands copies the commands without prompts or output; the copy button copies everything', async () => {
  const { commandsText, copyText, html } = await render(block('sh frame="terminal"', ...session));
  expect(commandsText).toBe('uv tool install ruff\nruff check src/ \\\n    --fix');
  expect(copyText).toBe(session.join('\n'));
  expect(html).toContain('>Copy commands</button>');
  expect(html).toContain('data-scb-shell-copy');
  expect(html.match(/<span class="scb-shell-prompt">\$ <\/span>/g)).toHaveLength(2);
  expect(html.match(/class="ec-line scb-shell-output"/g)).toHaveLength(3);
});

test('shellCopy.prompts="…" replaces the prompts for one block, and can repeat', async () => {
  const { commandsText, html } = await render(
    block(
      'sh frame="terminal" shellCopy.prompts="% " shellCopy.prompts="❯ "',
      '% npm test',
      'ok',
      '❯ npm run build',
      '$ not a prompt here',
    ),
  );
  expect(commandsText).toBe('npm test\nnpm run build');
  expect(html.match(/class="scb-shell-prompt"/g)).toHaveLength(2);
});

test('shows output lines without syntax colours', async () => {
  const { html } = await render(block('sh', '$ echo "hi"', 'echo "not a command"'));
  expect(html.slice(html.indexOf('scb-shell-output'))).not.toMatch(/<span style="--0/);
});

test('the copy button leaves out comment lines, as Expressive Code does, but keeps `# ` prompts', async () => {
  expect((await render(block('sh', '# set up', '$ ls', 'a.txt'))).copyText).toBe('$ ls\na.txt');
  const lines = ['# apt update', '# apt install curl', '$ # now as a user', '', '$ curl --version', 'curl 8.0'];
  const { copyText } = await render(block('sh', ...lines), { shellCopy: { prompts: ['$ ', '# '] } });
  expect(copyText).toBe('# apt update\n# apt install curl\n$ curl --version\ncurl 8.0');
});

test.each(['sh', 'bash', 'shell', 'powershell', 'console'])('applies to the terminal frame of %s', async (lang) => {
  expect((await render(block(lang, '$ ls', 'a.txt'))).commandsText).toBe('ls');
});

test.each([
  ['sh frame="code"', '$ ls', 'a.txt'],
  ['sh', 'npm install', '# a comment'],
  ['py', 'print(">>> x")', '... = 1'],
  ['py', '"""Add numbers.', '', '>>> add(1, 2)', '3', '"""', '', 'def add(a, b):', '    return a + b'],
])('leaves a block that is not a session alone: %s', async (fence, ...lines) => {
  const md = block(fence, ...lines);
  const on = await render(md);
  expect(on.commandsText).toBeUndefined();
  expect(on.html).toBe((await render(md, { shellCopy: false })).html);
});

test('uses the prompts from the options, and a continuation needs a command above it', async () => {
  const options = { shellCopy: { prompts: ['% '] } };
  expect((await render(block('sh', '% ls', 'a.txt', '$ not a prompt here'), options)).commandsText).toBe('ls');
  expect((await render(block('sh', 'output ending in \\', 'more output', '$ ls'))).commandsText).toBe('ls');
});

test('reads the commands after directives are removed, and includes hidden commands', async () => {
  const { copyText, commandsText, html } = await render(block('sh', '$ npm test # [!code highlight]', 'ok'));
  expect(commandsText).toBe('npm test');
  expect(copyText).toBe('$ npm test\nok');
  expect(html).toContain('class="ec-line highlight mark"');
  expect((await render(block('sh hidden={1}', '$ cd app', '$ npm test', 'ok'))).commandsText).toBe('cd app\nnpm test');
});

test('the prompt colour meets 4.5:1 contrast in both themes', async () => {
  for (const { get, name } of await variants()) {
    const prompt = get('codeblocksShellCopy.promptForeground');
    expect(getColorContrast(prompt, get('codeBackground')), name).toBeGreaterThanOrEqual(4.5);
  }
});

const repl = [
  '>>> from pathlib import Path',
  '>>> for name in ["a", "b"]:',
  '...     print(Path(name).with_suffix(".txt"))',
  '...',
  'a.txt',
  'b.txt',
  '>>> print(">>> not a prompt")',
  '>>> not a prompt',
  '>>> print("...")',
  '...',
  '>>> print(f"{2 + 2}",',
  '...       "done")',
  '4 done',
];

test.each(['python', 'py', 'pycon'])(
  'reads a %s block with >>> prompts as a session, in the editor frame',
  async (lang) => {
    const { commandsText, copyText, html } = await render(block(lang, ...repl));
    expect(commandsText).toBe(
      [
        'from pathlib import Path',
        'for name in ["a", "b"]:',
        '    print(Path(name).with_suffix(".txt"))',
        '',
        'print(">>> not a prompt")',
        'not a prompt',
        'print("...")',
        'print(f"{2 + 2}",',
        '      "done")',
      ].join('\n'),
    );
    expect(copyText).toBe(repl.join('\n'));
    expect(html).not.toContain('is-terminal');
    expect(html.match(/<span class="scb-shell-prompt">(?:>|&#x3E;){3} <\/span>/g)).toHaveLength(6);
    expect(html.match(/<span class="scb-shell-prompt">\.\.\.( )?<\/span>/g)).toHaveLength(3);
    expect(html.match(/class="ec-line scb-shell-output"/g)).toHaveLength(4);
  },
);

test('a line that starts with ... continues a command only while the statement is open', async () => {
  const text = async (lang: string, ...lines: string[]) => (await render(block(lang, ...lines))).commandsText;
  expect(await text('py', '>>> print("x")', 'x', '... still output')).toBe('print("x")');
  expect(await text('py', '>>> x = """a', '... b"""', '... output')).toBe('x = """a\nb"""');
  expect(await text('py', '>>> total = 1 + \\', '...     2', '...')).toBe('total = 1 + \\\n    2');
  expect(await text('py', '>>> @cache', '... def f(): ...', '...', '...')).toBe('@cache\ndef f(): ...\n');
  expect(await text('pycon', 'Text', '>>> 1 + 1', '2')).toBe('1 + 1');
});

test('an unclosed string with many escapes does not stall the build', async () => {
  const started = performance.now();
  await render(block('pycon', `>>> p = "${'a\\t'.repeat(40)}`, '... x'));
  expect(performance.now() - started).toBeLessThan(1000);
});

test('links API names in the commands of a Python session, and not in its output', async () => {
  const { html } = await render(block('py', '>>> import json', '>>> json.loads("[]")', 'json.loads'));
  expect(apiLinks(html).map((link) => link.text)).toEqual(['json', 'json.loads']);
});
