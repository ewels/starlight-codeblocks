import { getColorContrast } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { variants } from './contrast.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

const session = [
  '$ uv tool install ruff',
  'Resolved 1 package in 180ms',
  'Installed 1 executable: ruff',
  '$ ruff check src/ \\',
  '    --fix',
  'Found 3 errors (3 fixed, 0 remaining).',
];

test('the Copy commands button copies the commands without prompts or output, and keeps continuation lines', async () => {
  const { commandsText, html } = await render(block('sh frame="terminal"', ...session));
  expect(commandsText).toBe('uv tool install ruff\nruff check src/ \\\n    --fix');
  expect(html).toContain('>Copy commands</button>');
  expect(html).toContain('data-scb-shell-copy');
});

test('the copy button copies the whole block, prompts and output included', async () => {
  const { copyText, html } = await render(block('sh frame="terminal"', ...session));
  expect(copyText).toBe(session.join('\n'));
  expect(html).toContain('title="Copy to clipboard"');
});

test('the copy button leaves out comment lines, as Expressive Code does in terminals', async () => {
  const { copyText } = await render(block('sh', '# set up', '$ ls', 'a.txt'));
  expect(copyText).toBe('$ ls\na.txt');
});

test('moves each prompt into its own span, and marks output lines', async () => {
  const { html } = await render(block('sh', ...session));
  expect(html.match(/<span class="scb-shell-prompt">\$ <\/span>/g)).toHaveLength(2);
  expect(html.match(/class="ec-line scb-shell-output"/g)).toHaveLength(3);
});

test('shows output lines without syntax colours', async () => {
  const { html } = await render(block('sh', '$ echo "hi"', 'echo "not a command"'));
  const output = html.slice(html.indexOf('scb-shell-output'));
  expect(output).not.toMatch(/<span style="--0/);
});

test('applies to the automatic terminal frame of shell languages', async () => {
  for (const lang of ['sh', 'bash', 'shell', 'powershell', 'console']) {
    const { commandsText } = await render(block(lang, '$ ls', 'a.txt'));
    expect(commandsText).toBe('ls');
  }
});

test('leaves blocks that are not terminals alone', async () => {
  const md = block('sh frame="code"', '$ ls', 'a.txt');
  const { copyText, commandsText, html } = await render(md);
  expect(copyText).toBe('$ ls\na.txt');
  expect(commandsText).toBeUndefined();
  expect(html).not.toContain('scb-shell');
});

test('leaves terminal blocks with no prompt alone', async () => {
  const md = block('sh', 'npm install', '# a comment');
  expect((await render(md)).html).toBe((await render(md, { shellCopy: false })).html);
});

test('uses the prompts from the options', async () => {
  const { commandsText } = await render(block('sh', '% ls', 'a.txt', '$ not a prompt here'), {
    shellCopy: { prompts: ['% '] },
  });
  expect(commandsText).toBe('ls');
});

test('a continuation needs a command above it', async () => {
  const { commandsText } = await render(block('sh', 'output ending in \\', 'more output', '$ ls'));
  expect(commandsText).toBe('ls');
});

test('reads the commands after directives are removed', async () => {
  const { copyText, commandsText, html } = await render(block('sh', '$ npm test # [!code highlight]', 'ok'));
  expect(commandsText).toBe('npm test');
  expect(copyText).toBe('$ npm test\nok');
  expect(html).toContain('class="ec-line highlight mark"');
});

test('includes hidden commands in the copied text', async () => {
  const { commandsText } = await render(block('sh hidden={1}', '$ cd app', '$ npm test', 'ok'));
  expect(commandsText).toBe('cd app\nnpm test');
});

test('the prompt colour meets 4.5:1 contrast in both themes', async () => {
  for (const { get, name } of await variants()) {
    const prompt = get('codeblocksShellCopy.promptForeground');
    expect(getColorContrast(prompt, get('codeBackground')), name).toBeGreaterThanOrEqual(4.5);
  }
});
