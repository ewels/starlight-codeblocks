import { getColorContrast } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
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

test('copies the commands without prompts or output, and keeps continuation lines', async () => {
  const { copyText, html } = await render(block('sh frame="terminal"', ...session));
  expect(copyText).toBe('uv tool install ruff\nruff check src/ \\\n    --fix');
  expect(html).toContain('title="Copy commands"');
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
    const { copyText } = await render(block(lang, '$ ls', 'a.txt'));
    expect(copyText).toBe('ls');
  }
});

test('leaves blocks that are not terminals alone', async () => {
  const md = block('sh frame="code"', '$ ls', 'a.txt');
  const { copyText, html } = await render(md);
  expect(copyText).toBe('$ ls\na.txt');
  expect(html).not.toContain('scb-shell');
});

test('leaves terminal blocks with no prompt alone', async () => {
  const md = block('sh', 'npm install', '# a comment');
  expect((await render(md)).html).toBe((await render(md, { shellCopy: false })).html);
});

test('uses the prompts from the options', async () => {
  const { copyText } = await render(block('sh', '% ls', 'a.txt', '$ not a prompt here'), {
    shellCopy: { prompts: ['% '] },
  });
  expect(copyText).toBe('ls');
});

test('a continuation needs a command above it', async () => {
  const { copyText } = await render(block('sh', 'output ending in \\', 'more output', '$ ls'));
  expect(copyText).toBe('ls');
});

test('reads the commands after directives are removed', async () => {
  const { copyText, html } = await render(block('sh', '$ npm test # [!code highlight]', 'ok'));
  expect(copyText).toBe('npm test');
  expect(html).toContain('class="ec-line highlight mark"');
});

test('includes hidden commands in the copied text', async () => {
  const { copyText } = await render(block('sh hidden={1}', '$ cd app', '$ npm test', 'ok'));
  expect(copyText).toBe('cd app\nnpm test');
});

test('the prompt colour meets 4.5:1 contrast in both themes', async () => {
  const ec = new ExpressiveCode({ plugins: [pluginCodeblocks()] });
  await ec.getBaseStyles();
  const backgrounds = { dark: ['#23262f', '#24292e'], light: ['#f6f7f9', '#ffffff'] };
  for (const variant of ec.styleVariants) {
    const prompt = variant.resolvedStyleSettings.get('codeblocksShellCopy.promptForeground' as never) as string;
    for (const bg of backgrounds[variant.theme.type]) expect(getColorContrast(prompt, bg)).toBeGreaterThanOrEqual(4.5);
  }
});
