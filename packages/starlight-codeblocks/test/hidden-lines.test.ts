import { getColorContrast, onBackground, setAlpha } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { variants } from './contrast.ts';
import { block, render, styleVariants } from './render.ts';

test('hides lines named by hidden={range}, replaced by a marker', async () => {
  const { html, copyText, warnings } = await render(block('js hidden={2-3}', 'a()', 'b()', 'c()', 'd()'));
  expect(html).toContain('class="scb-hidden-marker scb-no-print"');
  expect(html).toContain('<span>2 hidden lines</span>');
  expect(html.match(/class="ec-line scb-hidden-line scb-no-print"/g)).toHaveLength(2);
  expect(copyText).toBe('a()\nb()\nc()\nd()');
  expect(warnings).toEqual([]);
});

test('hides lines with [!code hide] and [!code hide:N]', async () => {
  const { html, copyText } = await render(
    block('js', 'a()', 'b() // [!code hide]', 'c() // [!code hide:2]', 'd()', 'e()'),
  );
  expect(html.match(/class="ec-line scb-hidden-line scb-no-print"/g)).toHaveLength(3);
  expect(copyText).toBe('a()\nb()\nc()\nd()\ne()');
});

test('groups consecutive hidden lines into one run, each with its own marker', async () => {
  const { html } = await render(block('js hidden={1-2,4}', 'a()', 'b()', 'c()', 'd()'));
  expect(html.match(/class="scb-hidden-marker scb-no-print"/g)).toHaveLength(2);
  expect(html).toContain('<span>2 hidden lines</span>');
  expect(html).toContain('<span>1 hidden line</span>');
});

test('adds a title bar button that shows every run at once', async () => {
  const { html } = await render(block('js title="a.js" hidden={1,3}', 'a()', 'b()', 'c()'));
  expect(html).toContain('class="scb-btn scb-hidden-toggle scb-no-print scb-needs-js"');
  expect(html).toContain('Show 2 hidden lines');
  expect(html).not.toContain('aria-pressed');
});

test('names the figure after its title, not after the controls in the title bar', async () => {
  expect((await render(block('js title="a.js" hidden={1}', 'a()', 'b()'))).html).toContain('aria-label="a.js"');
  expect((await render(block('sh hidden={1}', 'a', 'b'))).html).toContain('aria-label="Terminal window"');
  expect((await render(block('js hidden={1}', 'a()', 'b()'))).html).toContain('aria-label="Code block"');
});

test('forces a header for the toggle button even without a title', async () => {
  const { html } = await render(block('js hidden={1}', 'a()', 'b()'));
  expect(html).toMatch(
    /<figure class="frame" data-scb-hidden-lines="" aria-label="Code block"><figcaption class="header">/,
  );
});

test('markers and the toggle use aria-expanded and aria-controls', async () => {
  const { html } = await render(block('js hidden={2}', 'a()', 'b()', 'c()'));
  const marker = html.match(
    /<button type="button" id="(scb-hidden-[\w-]+)" class="scb-hidden-marker scb-no-print" aria-expanded="false" aria-controls="([\w -]+)">/,
  );
  expect(marker).toBeTruthy();
  const [, markerId, lineIds] = marker as RegExpMatchArray;
  for (const id of lineIds.split(' ')) expect(html).toContain(`id="${id}"`);
  expect(html).toContain(`aria-controls="${markerId}"`);
});

test('renders a block without hidden={range} the same as without the feature', async () => {
  const md = block('js title="a.js" {1}', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { hiddenLines: false })).html);
});

test('warns about lines outside the block', async () => {
  const { warnings } = await render(block('js hidden={1,5}', 'a()', 'b()'));
  expect(warnings).toEqual([
    'src/content/docs/example.md, js code block: `hidden={1,5}` names line 5, but the block has 2 lines. The plugin ignores it.',
  ]);
});

test('leaves [!code hide] in the code when hidden lines are off', async () => {
  const { copyText, warnings } = await render(block('js', 'a() // [!code hide]'), { hiddenLines: false });
  expect(copyText).toBe('a() // [!code hide]');
  expect(warnings).toHaveLength(1);
});

test('does nothing when the feature is off, even with the attribute', async () => {
  const { html } = await render(block('js hidden={1}', 'a()'), { hiddenLines: false });
  expect(html).not.toContain('scb-hidden');
});

test('the marker text meets 4.5:1 contrast on its badge background, in both themes', async () => {
  const all = await styleVariants();
  expect(all.map((v) => v.theme.type).sort()).toEqual(['dark', 'light']);
  for (const variant of all) {
    const get = (key: string) => variant.resolvedStyleSettings.get(key as never) as string;
    expect(
      getColorContrast(get('codeblocks.mutedForeground'), get('codeblocksHiddenLines.badgeBackground')),
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('the rule is brighter under the pointer and fainter while its lines show', async () => {
  for (const v of await variants()) {
    const bg = v.get('codeBackground');
    const rule = (key: string) => getColorContrast(onBackground(v.get(`codeblocksHiddenLines.${key}`), bg), bg);
    expect(rule('ruleHover'), v.name).toBeGreaterThan(rule('rule'));
    expect(rule('ruleOpen'), v.name).toBeLessThan(rule('rule'));
  }
});

// The user chose the mockup's dimmed lines knowingly: at 0.75 opacity, syntax colours that Expressive Code
// corrected to just 4.5:1 fall to about 3.1:1 to 3.5:1. This keeps them from falling further.
test('the code of a hidden line that shows keeps at least 3:1 contrast', async () => {
  for (const v of await variants()) {
    const opacity = Number(v.get('codeblocksHiddenLines.openOpacity'));
    const bg = onBackground(v.get('codeblocksHiddenLines.openBackground'), v.get('codeBackground'));
    for (const c of v.text) {
      expect(getColorContrast(onBackground(setAlpha(c, opacity), bg), bg), `${v.name} ${c}`).toBeGreaterThanOrEqual(3);
    }
  }
});
