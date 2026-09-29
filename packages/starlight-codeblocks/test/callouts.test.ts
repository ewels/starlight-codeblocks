import { expect, test } from 'vitest';
import { calloutMiddle } from '../src/expressive-code/callouts.ts';
import { block, render } from './render.ts';

test('renders a callout above its line, pointing at the middle of the match', async () => {
  const { html, copyText, warnings } = await render(
    block('js', 'const a = 1;', '// [!callout /signal/] Aborts the request.', 'fetch(url, { signal });'),
  );
  expect(html).toContain(
    '<div class="scb-callout" role="note" style="--scb-callout-mid:16;--scb-callout-len:19"><span class="scb-callout-bubble"><span class="scb-callout-text">Aborts the request.</span></span></div><div class="ec-line">',
  );
  expect(html.indexOf('scb-callout')).toBeLessThan(html.indexOf('fetch'));
  expect(html).not.toContain('[!callout');
  expect(copyText).toBe('const a = 1;\nfetch(url, { signal });');
  expect(warnings).toEqual([]);
});

test('calloutMiddle points at the first character that is not whitespace, counting tabs and the shell prompt', async () => {
  expect(calloutMiddle('    run()')).toBe(4.5);
  expect(calloutMiddle('run()')).toBe(0.5);
  expect(calloutMiddle('\tab', 'ab')).toBe(3);
  expect(calloutMiddle('x\tab', 'ab')).toBe(3);
  expect(calloutMiddle('xx\tab', 'ab')).toBe(5);
  expect(calloutMiddle('run()', undefined, '>>> ')).toBe(4.5);
  const { html } = await render(
    block('sh', '# [!callout /install/] Installs it.', '$ npm install foo', 'added 1 package'),
  );
  expect(html).toContain('--scb-callout-mid:9.5');
});

test('stacks callouts above the line directly below in source order, also with hidden lines', async () => {
  const { html } = await render(
    block('py', 'x = 1', '# [!callout /a/] First', '# [!callout /y/] Second', 'y = a', 'z = 3'),
  );
  expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
  expect(html.match(/role="note"/g)).toHaveLength(2);
  const next = html.match(/role="note".*?<\/div><div class="ec-line"><div class="code">(.*?)<\/div><\/div>/)?.[1];
  expect(next?.replace(/<[^>]+>/g, '')).toBe('y = a');
  const hidden = (await render(block('js hidden={1}', 'a()', '// [!callout] Note', 'b()'))).html;
  expect(hidden).toContain('scb-hidden-marker');
  expect(hidden).toContain('role="note"');
});

test('renders inline code and links in the note, and counts the text readers see for the bubble length', async () => {
  const { html } = await render(block('js', '// [!callout] Uses `fetch`, see [MDN](https://example.com).', 'go()'));
  expect(html).toContain('<code>fetch</code>');
  expect(html).toContain('<a href="https://example.com">MDN</a>');
  expect(html).toContain('--scb-callout-len:21"');
});

test('warns when /text/ does not match the line below', async () => {
  const { html, warnings } = await render(block('js', '// [!callout /nope/] Note', 'go()'));
  expect(html).not.toContain('scb-callout"');
  expect(warnings.join('\n')).toContain('does not match');
});

test('renders as without the feature when a block has no callouts, and keeps the directive with a warning when it is off', async () => {
  const md = block('js title="a.js"', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { callouts: false })).html);
  const { html, warnings } = await render(block('js', '// [!callout] Note', 'go()'), { callouts: false });
  expect(html).not.toContain('class="scb-callout"');
  expect(warnings.join('\n')).toContain('is not a known directive');
});

test('between two lines with the same highlight, the callout has it too', async () => {
  const lit = async (...lines: string[]) =>
    (await render(block(...(lines as [string, ...string[]])))).html.match(
      /<div class="(scb-callout[^"]*)" role="note"/,
    )?.[1];
  expect(await lit('js {1-2}', 'a()', '// [!callout] Note', 'b()')).toBe('scb-callout scb-callout-on mark');
  expect(await lit('js ins={1-2}', 'a()', '// [!callout] Note', 'b()')).toBe('scb-callout scb-callout-on ins');
  expect(await lit('js error={1-2}', 'a()', '// [!callout] Note', 'b()')).toBe(
    'scb-callout scb-callout-on scb-state scb-state-error',
  );
  // One side only, or two different highlights.
  expect(await lit('js {2}', 'a()', '// [!callout] Note', 'b()')).toBe('scb-callout');
  expect(await lit('js {1} ins={2}', 'a()', '// [!callout] Note', 'b()')).toBe('scb-callout');
  expect(await lit('js {1}', '// [!callout] Note', 'a()')).toBe('scb-callout');
});
