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
