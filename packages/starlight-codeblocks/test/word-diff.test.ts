import { expect, test } from 'vitest';
import { splitTokens, wordDiff } from '../src/expressive-code/word-diff.ts';
import { baseStyles, block, render } from './render.ts';

const worddiff = (html: string) => html.match(/scb-worddiff-(ins|del)/g);

test('splitTokens splits words, whitespace and punctuation, and keeps an emoji whole', () => {
  expect(splitTokens('foo.bar(1, 2)')).toEqual(['foo', '.', 'bar', '(', '1', ',', ' ', '2', ')']);
  expect(splitTokens('ok 😀')).toEqual(['ok', ' ', '😀']);
  expect(wordDiff('Status: 😀 ok', 'Status: 😃 ok', 0.4)).toMatchObject({ a: [[8, 10]], b: [[8, 10]] });
});

test('wordDiff marks only the changed tokens, and returns null for lines too different or too long', () => {
  const after = 'const timeout = options.timeout ?? 5000;';
  const diff = wordDiff('const timeout = 5000;', after, 0.4);
  expect(diff?.a).toEqual([]);
  expect(diff?.b.map(([start, end]) => after.slice(start, end))).toEqual(['options.timeout ??']);
  expect(wordDiff('a', 'a', 0.4)).not.toBeNull();
  expect(wordDiff('const a = 1;', 'export function totallyDifferent() {}', 0.4)).toBeNull();
  const indent = ' '.repeat(12);
  expect(wordDiff(`${indent}return a`, `${indent}throw new Error(msg)`, 0.4)).toBeNull();
  expect(wordDiff('a '.repeat(600), `${'a '.repeat(600)}b`, 0.4)).toBeNull();
  expect(wordDiff('a '.repeat(200), `${'a '.repeat(200)}b`, 0.4)).not.toBeNull();
});

test('highlights the changed words of a diff block, and keeps the underlying syntax colours', async () => {
  const { html, copyText, warnings } = await render(
    block('diff lang="js"', '-const timeout = 5000;', '+const timeout = options.timeout ?? 5000;'),
  );
  expect(worddiff(html)).toEqual(['scb-worddiff-ins']);
  expect(html).toContain('<span class="scb-worddiff-ins" role="insertion"><span style=');
  expect(copyText).toBe('const timeout = 5000;\nconst timeout = options.timeout ?? 5000;');
  expect(warnings).toEqual([]);
});

test.each([
  ['js ins={2} del={1}', 'const port = 8080;', 'const port = env.PORT;'],
  ['js', 'const port = 8080; // [!code --]', 'const port = env.PORT; // [!code ++]'],
])('highlights %s the same way', async (fence, ...lines) => {
  const { html } = await render(block(fence, ...lines));
  expect(worddiff(html)).toEqual(['scb-worddiff-del', 'scb-worddiff-ins']);
  expect(html).toContain('<span class="scb-worddiff-del" role="deletion">');
});

test('keeps whole-line tints when the pair is less similar than minSimilarity', async () => {
  expect(worddiff((await render(block('diff lang="js"', '-const a = 1;', '+export function x() {}'))).html)).toBeNull();
  const md = block('diff lang="js"', '-const a = 1;', '+const b = 2;');
  expect(worddiff((await render(md)).html)).not.toBeNull();
  expect(worddiff((await render(md, { wordDiff: { minSimilarity: 0.9 } })).html)).toBeNull();
});

test('adds nothing when the feature is off, with wordDiff=false, or with inline ins and del markers', async () => {
  const plain = block('js title="app.js" {2}', 'a()', 'b()');
  expect((await render(plain)).html).toBe((await render(plain, { wordDiff: false })).html);
  const pair = block('diff lang="js"', '-const a = 1;', '+const a = 2;');
  expect(worddiff((await render(pair, { wordDiff: false })).html)).toBeNull();
  expect(worddiff((await render(block('diff lang="js" wordDiff=false', '-a = 1;', '+a = 2;'))).html)).toBeNull();
  const markers = block(
    'js del="old" ins="neu"',
    'const old = f({ method: "GET" });',
    'const neu = f({ method: "POST" });',
  );
  expect((await render(markers)).html).not.toContain('scb-worddiff');
});

test('marks changed words with a bar, and removed words with a line-through too, so that the tint does not carry the meaning alone', async () => {
  const css = await baseStyles();
  expect(css).not.toMatch(/\.scb-worddiff-ins\{[^}]*text-decoration/);
  expect(css).toMatch(/\.scb-worddiff-ins\{[^}]*box-shadow:inset 0 -2px 0/);
  expect(css).toMatch(/\.scb-worddiff-del\{[^}]*text-decoration:line-through/);
});
