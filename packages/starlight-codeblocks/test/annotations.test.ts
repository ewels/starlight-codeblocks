import { getColorContrast, getLuminance } from '@expressive-code/core';
import { expect, test } from 'vitest';
import { variants } from './contrast.ts';
import { block, render } from './render.ts';

test('turns [!annotate] into a numbered button with a popover after it', async () => {
  const { html, copyText, warnings } = await render(block('py', 'x = 1  # [!annotate] Sets `x`.', 'y = 2'));
  const button = html.match(
    /<button type="button" class="scb-annotation" popovertarget="([\w-]+)" aria-label="Annotation 1" style="anchor-name:--\1">1<\/button>/,
  );
  expect(button).toBeTruthy();
  const id = (button as RegExpMatchArray)[1];
  expect(html).toContain(
    `</button><div id="${id}" popover="manual" class="scb-float scb-annotation-popover scb-no-print" style="position-anchor:--${id}"><span class="scb-annotation-badge" aria-hidden="true">1</span><p>Sets <code>x</code>.</p></div>`,
  );
  expect(html).not.toContain('[!annotate]');
  expect(copyText).toBe('x = 1\ny = 2');
  expect(warnings).toEqual([]);
});

test('numbers annotations from 1 in line order, keeps the rest of a comment, and adds a list for print', async () => {
  const { html, copyText } = await render(
    block('js', 'a() // keep [!annotate] First', 'b()', 'c() // [!annotate] Second'),
  );
  expect(html.match(/aria-label="Annotation \d"/g)).toEqual(['aria-label="Annotation 1"', 'aria-label="Annotation 2"']);
  expect(html).toContain('data-scb-annotations=""');
  expect(html).toContain('<ol class="scb-annotation-list"><li>First</li><li>Second</li></ol>');
  expect(copyText).toBe('a() // keep\nb()\nc()');
});

test('renders as without the feature when a block has no annotations, and keeps the directive with a warning when it is off', async () => {
  const md = block('js title="a.js"', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { annotations: false })).html);
  const { html, warnings } = await render(block('js', 'a() // [!annotate] Note'), { annotations: false });
  expect(html).not.toContain('scb-annotation');
  expect(warnings.join('\n')).toContain('is not a known directive');
});

test('annotations="side" puts the notes in a column beside the block, with numbers on the lines', async () => {
  const { html, copyText } = await render(
    block('py annotations="side"', 'x = 1  # [!annotate] Sets `x`.', 'y = 2  # [!annotate] Sets y.'),
  );
  expect(html).toMatch(
    /^<div class="expressive-code"><div class="scb-side scb-side-600 not-content" data-scb-annotations=""><div class="scb-side-grid"><figure/,
  );
  expect(html).toContain('<div class="ec-line" data-scb-anno="1">');
  expect(html).toContain('<span class="scb-annotation scb-annotation-num" aria-hidden="true">1</span>');
  expect(html).toContain(
    '</figure><ol class="scb-annotation-notes"><li tabindex="0" data-scb-anno="1"><span class="scb-annotation-note-num" aria-hidden="true">1</span><span class="scb-sr-only">Note 1, for line 1: </span>Sets <code>x</code>.</li><li tabindex="0" data-scb-anno="2"><span class="scb-annotation-note-num" aria-hidden="true">2</span><span class="scb-sr-only">Note 2, for line 2: </span>Sets y.</li></ol></div></div>',
  );
  expect(html).not.toContain('popover');
  expect(copyText).toBe('x = 1\ny = 2');
});

test('annotations="side" lists every note of a line with several notes on the line', async () => {
  const { html } = await render(block('js annotations="side"', 'a() // [!annotate] One [!annotate] Two'));
  expect(html).toContain('<div class="ec-line" data-scb-anno="1 2">');
});

test('annotations="side" needs a wider container for the columns when the lines are longer', async () => {
  const size = async (chars: number) => {
    const { html } = await render(block('py annotations="side"', `x = ${'1'.repeat(chars - 4)}  # [!annotate] Note`));
    return html.match(/scb-side-(\d+)/)?.[1];
  };
  expect(await size(30)).toBe('600');
  expect(await size(55)).toBe('800');
  expect(await size(80)).toBe('1000');
  expect(await size(200)).toBe('1000');
});

test('codeSide="right" puts the code in the right column, and bad annotations or codeSide values warn', async () => {
  const note = 'x = 1  # [!annotate] Note';
  const right = await render(block('py annotations="side" codeSide="right"', note));
  expect(right.html).toContain('class="scb-side scb-side-600 scb-side-code-right not-content"');
  expect(right.warnings).toEqual([]);
  const left = await render(block('py annotations="side" codeSide="left"', note));
  expect(left.html).not.toContain('scb-side-code-right');
  expect(left.warnings).toEqual([]);
  const bad = await render(block('py annotations="side" codeSide="top"', note));
  expect(bad.warnings.join('\n')).toContain('`codeSide="top"`');
  expect(bad.html).not.toContain('scb-side-code-right');
  const list = await render(block('py annotations="list"', note));
  expect(list.warnings.join('\n')).toContain('`annotations="list"` must be `"side"`');
  expect(list.html).toContain('popovertarget');
});

test('the hover colour of a marker comes from the theme and keeps the number readable', async () => {
  for (const v of await variants()) {
    const hover = v.get('codeblocksAnnotations.markerHoverBackground');
    const bg = v.get('codeBackground');
    expect(hover, v.name).not.toBe(v.get('codeblocksAnnotations.markerBackground'));
    expect(getColorContrast(v.get('codeblocksAnnotations.markerForeground'), hover), v.name).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(getColorContrast(hover, bg), v.name).toBeGreaterThanOrEqual(3);
    // Lighter than the marker in dark themes, darker in light themes: towards the code text.
    const lighter = getLuminance(hover) > getLuminance(v.get('codeblocksAnnotations.markerBackground'));
    expect(lighter, v.name).toBe(v.type === 'dark');
  }
});

test('startNoteNumber starts the numbers of markers, popovers and lists, in both layouts', async () => {
  const lines = ['a() // [!annotate] First', 'b() // [!annotate] Second'];
  const popover = await render(block('js startNoteNumber={12}', ...lines));
  expect(popover.html.match(/aria-label="Annotation \d+"/g)).toEqual([
    'aria-label="Annotation 12"',
    'aria-label="Annotation 13"',
  ]);
  expect(popover.html).toContain('<ol class="scb-annotation-list" start="12">');
  expect(popover.warnings).toEqual([]);
  const side = await render(block('js annotations="side" startNoteNumber={12}', ...lines));
  expect(side.html).toContain('<div class="ec-line" data-scb-anno="12">');
  expect(side.html).toContain('<ol class="scb-annotation-notes" start="12">');
  expect(side.html).toContain('Note 13, for line 2: ');
});
