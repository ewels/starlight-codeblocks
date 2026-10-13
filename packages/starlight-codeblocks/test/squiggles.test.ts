import { getColorContrast } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

/** The squiggles in the HTML: severity, the code text under the wave, and the message in the popover. */
function squiggles(html: string) {
  return [
    ...html.matchAll(
      /<span class="scb-squiggle scb-squiggle-(\w+)" tabindex="0"[^>]*>(.*?)<span class="scb-sr-only">(.*?)<\/span><span class="scb-float[^>]*><span class="scb-squiggle-label">(\w+)<\/span>(.*?)<\/span><\/span>/g,
    ),
  ].map(([, severity, code, sr, label, message]) => ({
    severity,
    code: code?.replace(/<[^>]+>/g, ''),
    sr,
    label,
    message,
  }));
}

test('draws a squiggle under /text/ with its message, and leaves the copied text alone', async () => {
  const { html, copyText, warnings } = await render(
    block('ts', "import { join } from 'node:path'; // [!warning /join/] Unused `join`."),
  );
  expect(squiggles(html)).toEqual([
    {
      severity: 'warning',
      code: 'join',
      sr: ' (Warning: Unused join.)',
      label: 'Warning',
      message: 'Unused <code>join</code>.',
    },
  ]);
  expect(html).toContain('data-scb-squiggles=""');
  expect(html).toContain('popover="manual"');
  expect(copyText).toBe("import { join } from 'node:path';");
  expect(warnings).toEqual([]);
});

test('wraps every token of the range in one element, so that the wave runs on', async () => {
  const { html } = await render(
    block('ts', "const c = await readFle('config.json'); // [!error /readFle('config.json')/] Nope"),
  );
  const [squiggle] = squiggles(html);
  expect(squiggle?.code).toBe("readFle('config.json')");
  expect(html.match(/class="scb-squiggle /g)).toHaveLength(1);
});

test('reads each severity and its other names', async () => {
  const lines = ['a(); // [!error]', 'b(); // [!warning]', 'c(); // [!info]', 'd(); // [!warn]', 'e(); // [!note]'];
  const { html, warnings } = await render(block('js', ...lines));
  expect(squiggles(html).map((s) => [s.severity, s.label])).toEqual([
    ['error', 'Error'],
    ['warning', 'Warning'],
    ['info', 'Info'],
    ['warning', 'Warning'],
    ['info', 'Info'],
  ]);
  expect(warnings).toEqual([]);
});

test('without /text/, underlines the line from its first character that is not a space', async () => {
  const { html } = await render(block('py', 'def f():', '    return x  # [!error] `x` is not defined.'));
  expect(squiggles(html)[0]?.code).toBe('return x');
  expect(squiggles(html)[0]?.sr).toBe(' (Error: x is not defined.)');
});

test('a squiggle with no message still names its severity', async () => {
  const { html } = await render(block('rs', 'let unused = 42; // [!warning /unused/]'));
  expect(squiggles(html)).toEqual([
    { severity: 'warning', code: 'unused', sr: ' (Warning)', label: 'Warning', message: '' },
  ]);
});

test('a directive on its own line applies to the line below, and several stack in source order', async () => {
  const above = await render(
    block('js', '// [!error /lenght/] Typo', '// [!warning /var/] Old', 'for (var i = 0; i < a.lenght; i++) {}'),
  );
  expect(squiggles(above.html).map((s) => [s.severity, s.code])).toEqual([
    ['warning', 'var'],
    ['error', 'lenght'],
  ]);
  expect(above.copyText).toBe('for (var i = 0; i < a.lenght; i++) {}');
  const inline = await render(block('js', 'go(signal); // [!info /signal/] Note'));
  const own = await render(block('js', '// [!info /signal/] Note', 'go(signal);'));
  expect(inline.html.replace(/--scb-squiggle-\w+-/g, '')).toBe(own.html.replace(/--scb-squiggle-\w+-/g, ''));
});

test('gives each squiggle its own anchor', async () => {
  const { html } = await render(block('js', 'a(b); // [!error /a/] One', 'c(d); // [!error /d/] Two'));
  const anchors = [...html.matchAll(/anchor-name:(--[\w-]+)/g)].map((m) => m[1]);
  expect(new Set(anchors).size).toBe(2);
  for (const anchor of anchors) expect(html).toContain(`position-anchor:${anchor}`);
});

test('lists the messages under the block for print', async () => {
  const { html } = await render(block('js', 'a();', 'b(); // [!error /b/] Not defined.', 'c(); // [!note]'));
  expect(html).toContain(
    '<ul class="scb-squiggle-list"><li>Line 2, error: Not defined.</li><li>Line 3, info</li></ul>',
  );
});

test('renders inline code and links in the message', async () => {
  const { html } = await render(block('js', 'go(); // [!info /go/] See [the docs](https://example.com) for `go`.'));
  expect(squiggles(html)[0]?.message).toBe('See <a href="https://example.com">the docs</a> for <code>go</code>.');
});

test('warns about a directive with no code to underline', async () => {
  const { html, warnings } = await render(block('js', 'go(); // [!error /nope/] Missing'));
  expect(html).not.toContain('scb-squiggle');
  expect(warnings.join('\n')).toContain('does not match');
});

test('leaves line states alone', async () => {
  const { html } = await render(block('js', 'a(); // [!code error] Fails', 'b(); // [!error /b/] Fails'));
  expect(html).toContain('scb-state-error');
  expect(squiggles(html).map((s) => s.code)).toEqual(['b']);
});

test('renders as without the feature when a block has no squiggles, and keeps the directive with a warning when it is off', async () => {
  const md = block('js title="a.js"', 'a()', 'b() // [!code error] Fails');
  expect((await render(md)).html).toBe((await render(md, { squiggles: false })).html);
  const { html, copyText, warnings } = await render(block('js', 'go(); // [!error /go/] Nope'), { squiggles: false });
  expect(html).not.toContain('scb-squiggle');
  expect(copyText).toBe('go(); // [!error /go/] Nope');
  expect(warnings.join('\n')).toContain('is not a known directive');
});

test('every squiggle colour meets 3:1 on the code and on the popover, in the dark and the light theme', async () => {
  for (const v of await variants(pluginCodeblocks())) {
    for (const severity of ['error', 'warning', 'info']) {
      const colour = v.get(`codeblocksSquiggles.${severity}`);
      expect(getColorContrast(colour, v.get('codeBackground')), `${severity}, ${v.name}`).toBeGreaterThanOrEqual(3);
      expect(
        getColorContrast(colour, v.get('codeblocks.popoverBackground')),
        `${severity}, ${v.name}`,
      ).toBeGreaterThanOrEqual(3);
    }
  }
});
