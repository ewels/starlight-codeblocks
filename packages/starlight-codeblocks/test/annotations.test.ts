import { expect, test } from 'vitest';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

test('turns [!annotate] into a numbered button with a popover after it', async () => {
  const { html, copyText, warnings } = await render(block('py', 'x = 1  # [!annotate] Sets `x`.', 'y = 2'));
  const button = html.match(
    /<button type="button" class="scb-annotation" popovertarget="([\w-]+)" aria-label="Annotation 1" style="anchor-name:--\1">1<\/button>/,
  );
  expect(button).toBeTruthy();
  const id = (button as RegExpMatchArray)[1];
  expect(html).toContain(
    `</button><div id="${id}" popover="auto" class="scb-float scb-annotation-popover" style="position-anchor:--${id}"><p>Sets <code>x</code>.</p></div>`,
  );
  expect(html).not.toContain('[!annotate]');
  expect(copyText).toBe('x = 1\ny = 2');
  expect(warnings).toEqual([]);
});

test('numbers annotations from 1 in line order', async () => {
  const { html } = await render(block('js', 'a() // [!annotate] First', 'b()', 'c() // [!annotate] Second'));
  expect(html.match(/aria-label="Annotation \d"/g)).toEqual(['aria-label="Annotation 1"', 'aria-label="Annotation 2"']);
  expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
});

test('marks the block for the client module and adds a list for print', async () => {
  const { html } = await render(block('js', 'a() // [!annotate] First', 'b() // [!annotate] Second'));
  expect(html).toContain('data-scb-annotations=""');
  expect(html).toContain('<ol class="scb-annotation-list"><li>First</li><li>Second</li></ol>');
});

test('keeps the rest of a comment that has other text', async () => {
  const { copyText } = await render(block('js', 'a() // keep [!annotate] Note'));
  expect(copyText).toBe('a() // keep');
});

test('keeps the directive with a warning when annotations are off', async () => {
  const { html, warnings } = await render(block('js', 'a() // [!annotate] Note'), { annotations: false });
  expect(html).not.toContain('scb-annotation');
  expect(warnings.join('\n')).toContain('is not a known directive');
});

test('renders a block without annotations the same as without the feature', async () => {
  const md = block('js title="a.js"', 'a()', 'b()');
  expect((await render(md)).html).toBe((await render(md, { annotations: false })).html);
});
