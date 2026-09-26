import { expect, test } from 'vitest';
import { findPlaceholders } from '../src/expressive-code/placeholders.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

const field = (text: string) =>
  `<input type="text" class="scb-placeholder" data-ph="${text}" placeholder="${text}" aria-label="${text}" spellcheck="false" autocomplete="off" style="width: ${text.length}ch">`;

test('turns every match of each text into a field, named by its text', async () => {
  const { html, copyText, warnings } = await render(
    block(
      'sh placeholder="YOUR_TOKEN,WORKSPACE_ID"',
      'curl -H "Authorization: Bearer YOUR_TOKEN" \\',
      '  https://api.example.com/workspaces/WORKSPACE_ID/runs?token=YOUR_TOKEN',
    ),
  );
  expect(html.split(field('YOUR_TOKEN'))).toHaveLength(3);
  expect(html.split(field('WORKSPACE_ID'))).toHaveLength(2);
  expect(html).toContain('<figure class="frame is-terminal" data-scb-placeholders="local">');
  expect(copyText).toBe(
    'curl -H "Authorization: Bearer YOUR_TOKEN" \\\n  https://api.example.com/workspaces/WORKSPACE_ID/runs?token=YOUR_TOKEN',
  );
  expect(warnings).toEqual([]);
});

test('a field takes the colour of the token it is in', async () => {
  const { html } = await render(block('py placeholder="YOUR_TOKEN"', 'client = Client(token="YOUR_TOKEN")'));
  expect(html).toMatch(new RegExp(`<span style="--0:[^"]+">${field('YOUR_TOKEN')}</span>`));
});

test('the storage option goes on the block for the script', async () => {
  const { html } = await render(block('py placeholder="KEY"', 'key = "KEY"'), { placeholders: { storage: 'session' } });
  expect(html).toContain('data-scb-placeholders="session"');
});

test('prefers the longer text when two texts overlap', () => {
  expect(findPlaceholders('A_B A', ['A', 'A_B'])).toEqual([
    { text: 'A_B', start: 0 },
    { text: 'A', start: 4 },
  ]);
});

test('warns about a text that the code does not contain', async () => {
  const { html, warnings } = await render(block('py placeholder="YOUR_TOKEN, NOPE"', 'token = "YOUR_TOKEN"'));
  expect(html).toContain(field('YOUR_TOKEN'));
  expect(warnings).toEqual([
    'src/content/docs/example.md, py code block: `placeholder` names `NOPE`, but the code does not contain it.',
  ]);
});

test('a TS Playground link in a block with fields loads the playground script', async () => {
  const { html } = await render(
    block('ts placeholder="YOUR_TOKEN" playground="typescript"', 'const token = "YOUR_TOKEN";'),
  );
  expect(html).toContain('data-scb-playground=""');
});

test('other playground links need no playground script', async () => {
  const { html } = await render(block('rust placeholder="YOUR_TOKEN" playground="rust"', 'let t = "YOUR_TOKEN";'));
  expect(html).toContain('class="scb-btn scb-playground scb-no-print"');
  expect(html).not.toContain('data-scb-playground');
});

test('renders a block without placeholder= the same as without the feature', async () => {
  const md = block('py title="a.py"', 'token = "YOUR_TOKEN"');
  expect((await render(md)).html).toBe((await render(md, { placeholders: false })).html);
});
