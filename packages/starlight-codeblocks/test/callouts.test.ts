import { expect, test } from 'vitest';
import { calloutMiddle } from '../src/expressive-code/callouts.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

test('renders a callout above its line, pointing at the middle of the match', async () => {
  const { html, copyText, warnings } = await render(
    block('js', 'const a = 1;', '// [!callout /signal/] Aborts the request.', 'fetch(url, { signal });'),
  );
  expect(html).toContain(
    '<div class="scb-callout" role="note" style="--scb-callout-mid:16"><span class="scb-callout-bubble">Aborts the request.</span></div><div class="ec-line">',
  );
  expect(html.indexOf('scb-callout')).toBeLessThan(html.indexOf('fetch'));
  expect(html).not.toContain('[!callout');
  expect(copyText).toBe('const a = 1;\nfetch(url, { signal });');
  expect(warnings).toEqual([]);
});

test('without /text/, points at the first character that is not whitespace', () => {
  expect(calloutMiddle('    run()')).toBe(4.5);
  expect(calloutMiddle('run()')).toBe(0.5);
});

test('counts a tab to the next multiple of 8 columns', () => {
  expect(calloutMiddle('\tab', 'ab')).toBe(9);
  expect(calloutMiddle('x\tab', 'ab')).toBe(9);
});

test('stacks two callouts above one line in source order', async () => {
  const { html } = await render(block('py', '# [!callout /a/] First', '# [!callout /b/] Second', 'a = b'));
  expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
  expect(html.match(/role="note"/g)).toHaveLength(2);
});

test('applies only to the line directly below', async () => {
  const { html } = await render(block('py', 'x = 1', '# [!callout] Note', 'y = 2', 'z = 3'));
  expect(html.match(/role="note"/g)).toHaveLength(1);
  const next = html.match(/role="note".*?<\/div><div class="ec-line"><div class="code">(.*?)<\/div><\/div>/)?.[1];
  expect(next?.replace(/<[^>]+>/g, '')).toBe('y = 2');
});

test('renders inline code, bold and links in the note', async () => {
  const { html } = await render(block('js', '// [!callout] Uses `fetch`, see [MDN](https://example.com).', 'go()'));
  expect(html).toContain('<code>fetch</code>');
  expect(html).toContain('<a href="https://example.com">MDN</a>');
});

test('warns when /text/ does not match the line below', async () => {
  const { html, warnings } = await render(block('js', '// [!callout /nope/] Note', 'go()'));
  expect(html).not.toContain('scb-callout"');
  expect(warnings.join('\n')).toContain('does not match');
});

test('keeps the directive with a warning when callouts are off', async () => {
  const { html, warnings } = await render(block('js', '// [!callout] Note', 'go()'), { callouts: false });
  expect(html).not.toContain('class="scb-callout"');
  expect(warnings.join('\n')).toContain('is not a known directive');
});

test('keeps callouts in place with hidden lines in the block', async () => {
  const { html } = await render(block('js hidden={1}', 'a()', '// [!callout] Note', 'b()'));
  expect(html).toContain('scb-hidden-marker');
  expect(html).toContain('role="note"');
});

test('renders a block without callouts the same as without the feature', async () => {
  const md = block('js title="a.js"', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { callouts: false })).html);
});
