import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintText } from './lint-docs.mjs';

const rules = (text) => lintText(text).map((p) => `${p.line}:${p.rule}`);

test('clean prose passes', () => {
  const text = [
    '---',
    'title: Focus, simply',
    '---',
    "import { Aside } from '@astrojs/starlight/components';",
    '',
    '## Syntax in Expressive Code',
    '',
    'Add `focus={4-7}` to the fence line. The plugin blurs the other lines.',
    '',
    '```js',
    '// just a comment, color: gray',
    '```',
    '',
    '<Example code={`',
    '```js',
    'const colour = "just this"',
    '```',
    '`} />',
    '',
    '<Aside type="tip">You can turn off the feature.</Aside>',
  ].join('\n');
  assert.deepEqual(rules(text), []);
});

test('each rule reports the right line', () => {
  const long = Array.from({ length: 26 }, () => 'word').join(' ');
  const text = [
    'You can simply add it.',
    'Note that it works.',
    'The color is gray.',
    'A dash — here and “quotes”.',
    '- **Bold** lead.',
    '## What Is This?',
    `${long}.`,
    '',
    `1. ${Array.from({ length: 21 }, () => 'step').join(' ')}.`,
    '',
    'One. Two. Three. Four. Five. Six. Seven.',
    '',
    'You should click it.',
  ].join('\n');
  assert.deepEqual(rules(text), [
    '1:banned-word',
    '2:banned-phrase',
    '3:spelling',
    '3:spelling',
    '4:character',
    '4:character',
    '5:bold-list',
    '6:heading',
    '6:heading',
    '13:modal',
    '13:modal',
    '7:sentence-length',
    '9:sentence-length',
    '11:paragraph-length',
  ]);
});

test('skips examples in export template literals', () => {
  const text = [
    'export const basic = `',
    '\\`\\`\\`py',
    '# [!callout] Creates the file.',
    '\\`\\`\\`',
    '`;',
    '',
    'Prose, simply.',
  ];
  assert.deepEqual(rules(text.join('\n')), ['7:banned-word']);
});
