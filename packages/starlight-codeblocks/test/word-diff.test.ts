import { getColorContrast, onBackground } from '@expressive-code/core';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { splitTokens, wordDiff } from '../src/expressive-code/word-diff.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const worddiff = (html: string) => html.match(/scb-worddiff-(ins|del)/g);

test('splitTokens splits words, whitespace and single punctuation characters', () => {
  expect(splitTokens('foo.bar(1, 2)')).toEqual(['foo', '.', 'bar', '(', '1', ',', ' ', '2', ')']);
});

test('wordDiff marks only the changed tokens, including whitespace between two changed tokens', () => {
  const diff = wordDiff('const timeout = 5000;', 'const timeout = options.timeout ?? 5000;', 0.4);
  expect(diff?.a).toEqual([]);
  const [start, end] = (diff as NonNullable<typeof diff>).b[0] as [number, number];
  expect('const timeout = options.timeout ?? 5000;'.slice(start, end)).toBe('options.timeout ??');
});

test('wordDiff returns null when the lines are too different', () => {
  expect(wordDiff('const a = 1;', 'export function totallyDifferent() {}', 0.4)).toBeNull();
  expect(wordDiff('a', 'a', 0.4)).not.toBeNull();
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

test('highlights ins and del attributes the same way', async () => {
  const { html } = await render(block('js ins={2} del={1}', 'const port = 8080;', 'const port = env.PORT;'));
  expect(worddiff(html)).toEqual(['scb-worddiff-del', 'scb-worddiff-ins']);
  expect(html).toContain('<span class="scb-worddiff-del" role="deletion">');
});

test('highlights [!code --] and [!code ++] the same way', async () => {
  const { html } = await render(
    block('js', 'const port = 8080; // [!code --]', 'const port = env.PORT; // [!code ++]'),
  );
  expect(worddiff(html)).toEqual(['scb-worddiff-del', 'scb-worddiff-ins']);
});

test('keeps whole-line tints only when the pair is less similar than minSimilarity', async () => {
  const { html } = await render(block('diff lang="js"', '-const a = 1;', '+export function totallyDifferent() {}'));
  expect(worddiff(html)).toBeNull();
});

test('minSimilarity is configurable', async () => {
  const md = block('diff lang="js"', '-const a = 1;', '+const b = 2;');
  expect(worddiff((await render(md)).html)).not.toBeNull();
  expect(worddiff((await render(md, { wordDiff: { minSimilarity: 0.9 } })).html)).toBeNull();
});

test('wordDiff=false turns it off for one block', async () => {
  const { html } = await render(block('diff lang="js" wordDiff=false', '-const a = 1;', '+const a = 2;'));
  expect(worddiff(html)).toBeNull();
});

test('renders a block without a del/ins pair the same as without the feature', async () => {
  const md = block('js title="app.js" {2}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { wordDiff: false })).html);
});

test('does not add spans when the feature is off', async () => {
  const md = block('diff lang="js"', '-const a = 1;', '+const a = 2;');
  expect(worddiff((await render(md, { wordDiff: false })).html)).toBeNull();
});

test('every word-diff colour meets 3:1 contrast on the code background', async () => {
  const ec = new ExpressiveCode({ plugins: [pluginCodeblocks()] });
  await ec.getBaseStyles();
  const backgrounds = { dark: ['#23262f', '#24292e'], light: ['#f6f7f9', '#ffffff'] };
  for (const variant of ec.styleVariants) {
    const get = (key: string) => variant.resolvedStyleSettings.get(`codeblocksWordDiff.${key}` as never) as string;
    for (const key of ['insBackground', 'delBackground']) {
      for (const bg of backgrounds[variant.theme.type]) {
        expect(getColorContrast(onBackground(get(key), bg), bg), `${key} on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    }
  }
});
